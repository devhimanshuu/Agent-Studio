import { z } from "zod";

/** Command strings for stdio MCP servers — e.g. `npx -y @modelcontextprotocol/server-postgres postgres://...`. */
const commandSchema = z
  .string()
  .min(3, "Command must be at least 3 characters")
  .max(500, "Command must be at most 500 characters");

const endpointUrlSchema = z
  .string()
  .url("Endpoint URL must be a valid URL")
  .max(2000, "Endpoint URL must be at most 2000 characters")
  .refine((url) => /^https?:\/\//i.test(url), {
    message: "Endpoint URL must use http or https",
  });

const headersSchema = z
  .record(z.string(), z.string())
  .refine((headers) => Object.keys(headers).length <= 20, {
    message: "At most 20 headers are allowed",
  })
  .optional();

export const createMcpServerSchema = z
  .object({
    userId: z.string().min(1, "User ID is required"),
    name: z
      .string()
      .min(2, "Server name must be at least 2 characters")
      .max(100, "Server name must be at most 100 characters"),
    transport: z.enum(["SSE", "STDIO"]),
    endpointUrl: endpointUrlSchema.optional(),
    command: commandSchema.optional(),
    headers: headersSchema,
    connectOnCreate: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.transport === "SSE" && !data.endpointUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endpointUrl"],
        message: "SSE transport requires an endpoint URL",
      });
    }
    if (data.transport === "STDIO" && !data.command) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["command"],
        message: "STDIO transport requires a command",
      });
    }
  });

export const updateMcpServerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Server name must be at least 2 characters")
      .max(100, "Server name must be at most 100 characters")
      .optional(),
    endpointUrl: endpointUrlSchema.optional(),
    command: commandSchema.optional(),
    headers: headersSchema,
    clearHeaders: z.boolean().optional(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const mcpTestToolSchema = z.object({
  toolName: z.string().min(1, "Tool name is required"),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

