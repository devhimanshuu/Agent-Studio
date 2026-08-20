import { z } from "zod";

const authTypeSchema = z.enum(["NONE", "BEARER", "API_KEY", "BASIC", "CUSTOM_HEADER"]);

const authConfigSchema = z
  .object({
    bearerToken: z.string().optional(),
    apiKeyHeader: z.string().optional(),
    apiKeyValue: z.string().optional(),
    apiKeyQueryParam: z.string().optional(),
    basicUsername: z.string().optional(),
    basicPassword: z.string().optional(),
    customHeaders: z.record(z.string(), z.string()).optional(),
  })
  .optional();

const endpointParameterSchema = z.object({
  name: z.string().min(1),
  in: z.enum(["path", "query", "header", "cookie"]),
  description: z.string().optional(),
  required: z.boolean().optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
});

const endpointRequestBodySchema = z.object({
  description: z.string().optional(),
  required: z.boolean().optional(),
  contentType: z.string().optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
});

export const endpointDefinitionSchema = z.object({
  id: z.string().min(1),
  operationId: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
  path: z.string().min(1),
  summary: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  parameters: z.array(endpointParameterSchema),
  requestBody: endpointRequestBodySchema.optional(),
  responses: z.record(z.string(), z.unknown()).optional(),
  isWrite: z.boolean(),
  requiresApproval: z.boolean(),
  enabled: z.boolean(),
  customName: z.string().optional(),
});

export const parseSpecRequestSchema = z
  .object({
    specUrl: z.string().url().optional().or(z.literal("")),
    rawSpec: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  })
  .refine((data) => Boolean(data.specUrl || data.rawSpec), {
    message: "Either specUrl or rawSpec must be provided",
  });

export const createOpenApiIntegrationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().max(500).optional(),
  specUrl: z.string().url().optional().or(z.literal("")).transform((val) => val || undefined),
  rawSpec: z.record(z.string(), z.unknown()).default({}),
  baseUrl: z.string().url("Base URL must be a valid URL"),
  authType: authTypeSchema.default("NONE"),
  authConfig: authConfigSchema,
  endpoints: z.array(endpointDefinitionSchema).min(1, "Select at least one endpoint to import"),
});

export const updateOpenApiIntegrationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  baseUrl: z.string().url().optional(),
  authType: authTypeSchema.optional(),
  authConfig: authConfigSchema,
  endpoints: z.array(endpointDefinitionSchema).optional(),
});

export const testEndpointRequestSchema = z.object({
  operationId: z.string().min(1, "operationId is required"),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

export const testRawEndpointRequestSchema = z.object({
  endpoint: endpointDefinitionSchema,
  baseUrl: z.string().url("Base URL must be a valid URL"),
  authType: authTypeSchema.default("NONE"),
  authConfig: authConfigSchema,
  arguments: z.record(z.string(), z.unknown()).default({}),
});
