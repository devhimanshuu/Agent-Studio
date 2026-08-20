export type OpenApiAuthType = "NONE" | "BEARER" | "API_KEY" | "BASIC" | "CUSTOM_HEADER";

export type OpenApiStatus = "CONNECTED" | "ERROR";

export interface OpenApiAuthConfig {
  bearerToken?: string;
  apiKeyHeader?: string;
  apiKeyValue?: string;
  apiKeyQueryParam?: string;
  basicUsername?: string;
  basicPassword?: string;
  customHeaders?: Record<string, string>;
}

export interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema?: Record<string, unknown>;
}

export interface OpenApiRequestBody {
  description?: string;
  required?: boolean;
  contentType?: string;
  schema?: Record<string, unknown>;
}

export interface OpenApiEndpointDefinition {
  id: string;
  operationId: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  path: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, unknown>;
  isWrite: boolean;
  requiresApproval: boolean;
  enabled: boolean;
  customName?: string;
}

export interface OpenApiParsedSpecDTO {
  title: string;
  version: string;
  description?: string;
  baseUrl: string;
  servers: Array<{ url: string; description?: string }>;
  endpoints: OpenApiEndpointDefinition[];
  rawSpec: Record<string, unknown>;
}

export interface OpenApiIntegrationDTO {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  specUrl: string | null;
  rawSpec: Record<string, unknown>;
  baseUrl: string;
  authType: OpenApiAuthType;
  authConfig: OpenApiAuthConfig | null;
  endpoints: OpenApiEndpointDefinition[];
  status: OpenApiStatus;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOpenApiIntegrationInput {
  userId: string;
  name: string;
  description?: string;
  specUrl?: string;
  rawSpec: Record<string, unknown>;
  baseUrl: string;
  authType?: OpenApiAuthType;
  authConfig?: OpenApiAuthConfig;
  endpoints: OpenApiEndpointDefinition[];
}

export interface UpdateOpenApiIntegrationInput {
  name?: string;
  description?: string;
  baseUrl?: string;
  authType?: OpenApiAuthType;
  authConfig?: OpenApiAuthConfig;
  endpoints?: OpenApiEndpointDefinition[];
}

export interface OpenApiToolTestResult {
  status: "SUCCESS" | "ERROR";
  latencyMs: number;
  statusCode?: number;
  data?: unknown;
  error?: string;
  requestDetails: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
  };
}
