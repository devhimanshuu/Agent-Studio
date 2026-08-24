import { Tool, ToolHealth } from "@/modules/tools";
import { ToolCategory, ToolType } from "@/types/tool";
import {
  OpenApiAuthConfig,
  OpenApiAuthType,
  OpenApiEndpointDefinition,
  OpenApiToolTestResult,
} from "@/types/openapi";
import { endpointToInputSchema } from "./schemaConverter";

export interface CreateOpenApiToolOptions {
  integrationId: string;
  integrationName: string;
  baseUrl: string;
  authType: OpenApiAuthType;
  authConfig?: OpenApiAuthConfig | null;
  timeoutMs?: number;
}

const DEFAULT_OPENAPI_TIMEOUT_MS = 20_000;

/**
 * Generate a deterministic registry-safe tool name for an OpenAPI endpoint.
 */
export function openApiToolRegistryName(integrationId: string, operationId: string): string {
  const safeIntegrationId = integrationId.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const safeOpId = operationId.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  return `openapi_${safeIntegrationId}_${safeOpId}`;
}

/**
 * Wraps an OpenAPI endpoint definition into a first-class executable `Tool` instance.
 */
export function createOpenApiTool(
  endpoint: OpenApiEndpointDefinition,
  options: CreateOpenApiToolOptions
): Tool {
  const registryName = openApiToolRegistryName(options.integrationId, endpoint.operationId);
  const { jsonSchema, zodSchema } = endpointToInputSchema(endpoint);

  // Category determination
  let category: ToolCategory = "TASK";
  if (endpoint.method === "GET") {
    category = endpoint.path.includes("search") || endpoint.path.includes("find") ? "SEARCH" : "DATA";
  }

  return {
    id: registryName,
    name: registryName,
    displayName: endpoint.customName || endpoint.summary || endpoint.operationId,
    description:
      endpoint.description ||
      `${endpoint.method} ${endpoint.path} from API integration "${options.integrationName}".`,
    category,
    type: endpoint.isWrite ? ("WRITE" as ToolType) : ("READ" as ToolType),
    inputSchema: jsonSchema,
    outputSchema: { type: "object" },
    requiresApproval: endpoint.requiresApproval,
    enabled: endpoint.enabled !== false,
    timeoutMs: options.timeoutMs || DEFAULT_OPENAPI_TIMEOUT_MS,

    validate(input: Record<string, unknown>): string[] {
      const parsed = zodSchema.safeParse(input);
      if (parsed.success) return [];
      return parsed.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `${path}: ${issue.message}`;
      });
    },

    async execute(input: Record<string, unknown>): Promise<unknown> {
      const testRes = await executeOpenApiRequest(endpoint, options, input);
      if (testRes.status === "ERROR") {
        throw new Error(testRes.error || `OpenAPI tool execution failed (${testRes.statusCode || 500})`);
      }
      return testRes.data;
    },

    async healthCheck(): Promise<ToolHealth> {
      const startedAt = Date.now();
      try {
        const url = new URL(options.baseUrl);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url.origin, {
          method: "HEAD",
          signal: controller.signal,
        }).catch(async () => {
          return fetch(url.origin, { method: "GET", signal: controller.signal });
        });

        clearTimeout(timeout);
        const latencyMs = Date.now() - startedAt;

        return {
          status: res.status < 500 ? "healthy" : "degraded",
          latencyMs,
          message: `API base reachable (${options.baseUrl}) - status ${res.status}`,
        };
      } catch (error) {
        return {
          status: "unavailable",
          latencyMs: Date.now() - startedAt,
          message: error instanceof Error ? error.message : "API host unreachable",
        };
      }
    },
  };
}

/**
 * Execute outbound HTTP request against an OpenAPI endpoint with full parameter interpolation and auth.
 */
export async function executeOpenApiRequest(
  endpoint: OpenApiEndpointDefinition,
  options: CreateOpenApiToolOptions,
  inputArgs: Record<string, unknown> = {}
): Promise<OpenApiToolTestResult> {
  const startedAt = Date.now();
  const rawBaseUrl = options.baseUrl.replace(/\/+$/, "");
  let resolvedPath = endpoint.path;

  const queryParams = new URLSearchParams();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "AgentStudio/1.0",
  };

  const consumedKeys = new Set<string>();

  // 1. Process explicit parameters
  for (const param of endpoint.parameters) {
    const val = inputArgs[param.name];
    if (val !== undefined && val !== null) {
      consumedKeys.add(param.name);
      if (param.in === "path") {
        resolvedPath = resolvedPath.replace(
          new RegExp(`\\{${param.name}\\}`, "g"),
          encodeURIComponent(String(val))
        );
      } else if (param.in === "query") {
        queryParams.set(param.name, String(val));
      } else if (param.in === "header") {
        headers[param.name] = String(val);
      }
    }
  }

  // Handle any leftover path params not defined in parameters
  resolvedPath = resolvedPath.replace(/\{([^}]+)\}/g, (match, p1) => {
    if (inputArgs[p1] !== undefined) {
      consumedKeys.add(p1);
      return encodeURIComponent(String(inputArgs[p1]));
    }
    return match;
  });

  // 2. Inject Authentication
  const authConfig = options.authConfig;
  if (options.authType === "BEARER" && authConfig?.bearerToken) {
    headers["Authorization"] = `Bearer ${authConfig.bearerToken.trim()}`;
  } else if (options.authType === "API_KEY") {
    if (authConfig?.apiKeyHeader && authConfig?.apiKeyValue) {
      headers[authConfig.apiKeyHeader] = authConfig.apiKeyValue;
    } else if (authConfig?.apiKeyQueryParam && authConfig?.apiKeyValue) {
      queryParams.set(authConfig.apiKeyQueryParam, authConfig.apiKeyValue);
    }
  } else if (options.authType === "BASIC" && authConfig?.basicUsername) {
    const creds = `${authConfig.basicUsername}:${authConfig.basicPassword || ""}`;
    const base64 = Buffer.from(creds).toString("base64");
    headers["Authorization"] = `Basic ${base64}`;
  } else if (options.authType === "CUSTOM_HEADER" && authConfig?.customHeaders) {
    for (const [k, v] of Object.entries(authConfig.customHeaders)) {
      if (v) headers[k] = v;
    }
  }

  // 3. Assemble target URL
  const queryString = queryParams.toString();
  const finalUrl = `${rawBaseUrl}${resolvedPath.startsWith("/") ? "" : "/"}${resolvedPath}${
    queryString ? `?${queryString}` : ""
  }`;

  // Query-param API keys are part of the URL and URLs end up in logs, error
  // messages and persisted request details — mask the key value everywhere
  // EXCEPT the actual outbound fetch.
  const sanitizeUrl = (u: string): string => {
    if (!authConfig?.apiKeyQueryParam || !authConfig?.apiKeyValue) return u;
    return u.replace(
      `${authConfig.apiKeyQueryParam}=${encodeURIComponent(authConfig.apiKeyValue)}`,
      `${authConfig.apiKeyQueryParam}=${encodeURIComponent("***REDACTED***")}`
    );
  };
  const safeUrl = sanitizeUrl(finalUrl);

  // 4. Prepare Request Body
  let requestBody: string | undefined = undefined;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(endpoint.method)) {
    if (inputArgs["body"] !== undefined) {
      requestBody = typeof inputArgs["body"] === "string" ? inputArgs["body"] : JSON.stringify(inputArgs["body"]);
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    } else {
      // Collect all input fields that were not path/query/header parameters
      const bodyObj: Record<string, unknown> = {};
      let hasBodyFields = false;
      for (const [key, val] of Object.entries(inputArgs)) {
        if (!consumedKeys.has(key)) {
          bodyObj[key] = val;
          hasBodyFields = true;
        }
      }
      if (hasBodyFields) {
        requestBody = JSON.stringify(bodyObj);
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
      }
    }
  }

  const loggedHeaders: Record<string, string> = { ...headers };
  for (const key of Object.keys(loggedHeaders)) {
    if (SENSITIVE_HEADER_RE.test(key)) loggedHeaders[key] = "***REDACTED***";
  }

  const requestDetails = {
    url: safeUrl,
    method: endpoint.method,
    headers: loggedHeaders,
    body: requestBody ? tryParseJson(requestBody) : undefined,
  };

  // 5. Execute HTTP Request
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_OPENAPI_TIMEOUT_MS);

  try {
    const response = await fetch(finalUrl, {
      method: endpoint.method,
      headers,
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startedAt;

    const contentType = response.headers.get("content-type") || "";
    let data: unknown;
    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      const text = await response.text();
      data = tryParseJson(text);
    }

    if (!response.ok) {
      return {
        status: "ERROR",
        latencyMs,
        statusCode: response.status,
        data,
        error: `HTTP Error ${response.status} (${response.statusText}): ${JSON.stringify(data)}`,
        requestDetails,
      };
    }

    return {
      status: "SUCCESS",
      latencyMs,
      statusCode: response.status,
      data,
      requestDetails,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startedAt;
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const errorMessage = isTimeout
      ? `Request timed out after ${options.timeoutMs || DEFAULT_OPENAPI_TIMEOUT_MS}ms`
      : error instanceof Error
      ? error.message
      : "Unknown network error";

    return {
      status: "ERROR",
      latencyMs,
      statusCode: 0,
      error: errorMessage,
      requestDetails,
    };
  }
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Header names whose values must never reach logs or client responses. */
const SENSITIVE_HEADER_RE = /^(authorization|proxy-authorization|x-api-key|api-key|apikey|x-auth-token|x-access-token|cookie)$/i;
