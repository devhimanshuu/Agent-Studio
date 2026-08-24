import { VaultService } from "@/services/VaultService";

/**
 * Shared secret-handling helpers.
 *
 *  - `VAULT_REF` / `isVaultRef` / `resolveVaultPlaceholders`: inject Vault
 *    secrets into integration configs at execution time via `${vault.KEY}`
 *    placeholders. Secrets are fetched per-run, scoped to the owning user,
 *    and never serialized into DTOs or logs.
 *  - `REDACTED` / `isRedactedValue` / `redactSecrets`: sentinel + masking for
 *    anything that crosses the API boundary (MCP headers, OpenAPI auth
 *    configs). Clients send the sentinel back untouched on edit; services
 *    treat it as "keep existing value".
 */

const vaultService = new VaultService();

export const VAULT_REF = /\$\{vault\.([A-Za-z0-9_.-]+)\}/g;
export const REDACTED = "__REDACTED__";

export function isRedactedValue(value: unknown): boolean {
  return typeof value === "string" && value === REDACTED;
}

export function isVaultRef(value: string): boolean {
  return VAULT_REF.test(value);
}

/**
 * Recursively resolve `${vault.KEY}` placeholders in a config object.
 * Unknown keys resolve to "" so downstream validation fails loudly instead
 * of shipping a literal placeholder to an external API.
 */
export async function resolveVaultPlaceholders(
  userId: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const referencedKeys = new Set<string>();
  collectRefs(input, referencedKeys);

  if (referencedKeys.size === 0) return input;

  const raw = await vaultService.getRawValues(userId, [...referencedKeys]).catch(() => ({}) as Record<string, string>);

  const out = replaceDeep(input, (value) => {
    if (typeof value !== "string") return value;
    return value.replace(VAULT_REF, (match, key: string) => raw[key] ?? "");
  }) as Record<string, unknown>;

  return out;
}

function collectRefs(value: unknown, keys: Set<string>): void {
  if (typeof value === "string") {
    for (const match of value.matchAll(VAULT_REF)) {
      keys.add(match[1]);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, keys);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectRefs(v, keys);
  }
}

function replaceDeep(value: unknown, fn: (v: unknown) => unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => replaceDeep(item, fn));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = replaceDeep(v, fn);
    }
    return out;
  }
  return fn(value);
}

/** True when a header name is one that commonly carries credentials. */
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "api-key",
  "apikey",
  "x-auth-token",
  "x-access-token",
  "cookie",
]);

export function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADERS.has(name.toLowerCase());
}

/**
 * Mask secret-looking values in a headers map for API responses.
 * Every value is masked — headers on MCP server configs are credentials by
 * definition — with sensitive names fully masked and others lightly masked.
 */
export function redactHeaders(headers: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!headers) return null;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = isRedactedValue(value)
      ? REDACTED
      : isSensitiveHeader(name)
        ? REDACTED
        : `${value.slice(0, 3)}***`;
  }
  return out;
}

// ─── OpenAPI auth-config masking ────────────────────────────────────────────

/** Secret-bearing fields of OpenApiAuthConfig (values never leave the server). */
const AUTH_SECRET_FIELDS = ["bearerToken", "apiKeyValue", "basicPassword"] as const;

/**
 * Mask an auth config for API responses: secret fields become the REDACTED
 * sentinel, custom header values become the sentinel, non-secret routing
 * fields (header/query names, username) stay visible so the UI can render.
 */
export function redactAuthConfig<T extends Record<string, unknown>>(config: T | null | undefined): T | null {
  if (!config) return null;
  const out: Record<string, unknown> = { ...config };
  for (const field of AUTH_SECRET_FIELDS) {
    const value = out[field];
    if (typeof value === "string" && value.length > 0 && !isRedactedValue(value)) {
      out[field] = REDACTED;
    }
  }
  if (out.customHeaders && typeof out.customHeaders === "object") {
    out.customHeaders = redactHeaders(out.customHeaders as Record<string, string>);
  }
  return out as T;
}

/**
 * Merge an incoming (possibly sentinel-containing) auth config over the
 * existing PLAINTEXT one. Sentinels mean "keep the stored value"; anything
 * else replaces it. Returns the full plaintext config to persist.
 */
export function mergeRedactedAuthConfig<T extends Record<string, unknown>>(
  existingPlain: T | null | undefined,
  incoming: Partial<T>
): T {
  const base: Record<string, unknown> = { ...(existingPlain ?? {}) };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    if (isRedactedValue(value)) continue; // keep existing
    if (
      key === "customHeaders" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const existingHeaders =
        base.customHeaders && typeof base.customHeaders === "object"
          ? (base.customHeaders as Record<string, string>)
          : {};
      const merged: Record<string, string> = { ...existingHeaders };
      for (const [hName, hVal] of Object.entries(value as Record<string, string>)) {
        if (isRedactedValue(hVal)) continue;
        merged[hName] = hVal;
      }
      base[key] = merged;
      continue;
    }
    base[key] = value;
  }
  return base as T;
}
