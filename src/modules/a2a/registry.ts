/**
 * A2A registry pull — fetch agent cards from a configured upstream registry.
 *
 * The presets in `./presets.ts` are an offline default and remain the source
 * of truth when nothing else is reachable. Real deployments should set
 * `A2A_REGISTRY_URL` (a JSON endpoint that returns `{ agents: AgentManifest[] }`)
 * to a directory the operator controls. Caching keeps each pull under a
 * configurable TTL so the dashboard doesn't refetch on every page load.
 */

import { A2AAgentManifest } from "@/types/a2a";
import { A2A_AGENT_PRESETS } from "./presets";
import { logger } from "@/lib/logger";

export interface RegistryConfig {
  /** Base URL of the upstream A2A registry (returns `{ agents: [...] }`). */
  registryUrl?: string;
  /** Bearer token to attach to registry requests (optional). */
  authToken?: string;
  /** Cache TTL in ms. Default 5 minutes. */
  cacheTtlMs?: number;
}

interface RegistryResponse {
  agents?: A2AAgentManifest[];
}

interface CacheEntry {
  manifests: A2AAgentManifest[];
  fetchedAt: number;
  source: "registry" | "presets";
}

const CACHE_TTL_DEFAULT = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;

let cached: CacheEntry | null = null;

export function resetA2ARegistryCache(): void {
  cached = null;
}

/**
 * Pull a list of A2A agent manifests. Tries the configured upstream first, then
 * falls back to the static presets so the UI is never empty. Invalid manifests
 * from the upstream are skipped, not silently adopted.
 */
export async function fetchA2ARegistry(
  config: RegistryConfig = {},
): Promise<{ manifests: A2AAgentManifest[]; source: "registry" | "presets" }> {
  const ttl = config.cacheTtlMs ?? CACHE_TTL_DEFAULT;

  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return { manifests: cached.manifests, source: cached.source };
  }

  if (config.registryUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(config.registryUrl, {
        headers: {
          Accept: "application/json",
          ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const body = (await res.json()) as RegistryResponse;
        const manifests = (body.agents ?? []).filter(isValidManifest);
        if (manifests.length > 0) {
          cached = { manifests, fetchedAt: Date.now(), source: "registry" };
          return { manifests, source: "registry" };
        }
        logger.warn(
          { url: config.registryUrl },
          "A2A registry returned no valid manifests — falling back to presets",
        );
      } else {
        logger.warn(
          { url: config.registryUrl, status: res.status },
          "A2A registry fetch returned non-OK status — falling back to presets",
        );
      }
    } catch (err) {
      logger.warn(
        { url: config.registryUrl, err },
        "A2A registry fetch failed — falling back to presets",
      );
    }
  }

  cached = { manifests: A2A_AGENT_PRESETS, fetchedAt: Date.now(), source: "presets" };
  return { manifests: A2A_AGENT_PRESETS, source: "presets" };
}

function isValidManifest(value: unknown): value is A2AAgentManifest {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  if (typeof m.name !== "string" || !m.name) return false;
  if (!m.endpoints || typeof m.endpoints !== "object") return false;
  const ep = m.endpoints as Record<string, unknown>;
  if (typeof ep.tasks !== "string" || !ep.tasks) return false;
  if (!Array.isArray(m.capabilities)) return false;
  return true;
}