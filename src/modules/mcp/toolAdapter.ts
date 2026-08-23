import { z } from "zod";
import { Tool, ToolHealth } from "@/modules/tools";
import { ToolCategory, ToolType } from "@/types/tool";
import { McpToolDefinition } from "@/types/mcp";
import { normalizeToolResult } from "./protocol";

/** The RPC surface a wrapped MCP tool needs from its connection. Kept as an
 * interface so the adapter is unit-testable without the SDK. */
export interface McpRpcClient {
  /** Invoke a tool by its server-local name. Resolves to the raw CallToolResult. */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  /** Round-trip liveness probe; resolves to latency in ms. */
  ping(): Promise<number>;
}

export interface CreateMcpToolOptions {
  /** Server id — used to namespace the tool name and identify health probes. */
  serverId: string;
  /** Human label for the owning server (display only). */
  serverName: string;
  /** Default wall-clock budget for each invocation. */
  timeoutMs?: number;
}

const DEFAULT_MCP_TOOL_TIMEOUT_MS = 15_000;

/**
 * Wrap a discovered MCP tool definition as a standard `ITool` so it executes
 * seamlessly inside the LangGraph runtime (registry validation, timeouts,
 * retry logic, HITL approval).
 *
 * Registry name: `mcp_<serverId>_<toolName>` — globally unique, so tools from
 * different users/servers never collide, and the PermissionChecker's
 * `allowedTools` list scopes exactly which MCP tools a skill may call.
 */
export function createMcpTool(
  definition: McpToolDefinition,
  rpc: McpRpcClient,
  options: CreateMcpToolOptions
): Tool {
  const name = mcpToolRegistryName(options.serverId, definition.name);
  const schema = definition.inputSchema ?? {};
  const zodSchema = jsonSchemaToZod(schema);

  return {
    id: name,
    name,
    displayName: definition.annotations?.title ?? definition.name,
    description: definition.description ?? `MCP tool "${definition.name}" exposed by ${options.serverName}.`,
    category: "TASK" as ToolCategory,
    type: definition.isWrite ? ("WRITE" as ToolType) : ("READ" as ToolType),
    inputSchema: schema,
    outputSchema: { type: "object" },
    requiresApproval: definition.requiresApproval,
    enabled: true,
    timeoutMs: options.timeoutMs ?? DEFAULT_MCP_TOOL_TIMEOUT_MS,
    async execute(input: Record<string, unknown>) {
      const result = await rpc.callTool(definition.name, input);
      const normalized = normalizeToolResult(result);
      if (result && typeof result === "object" && (result as { isError?: boolean }).isError === true) {
        const message =
          typeof normalized === "string" ? normalized : JSON.stringify(normalized ?? "MCP tool returned an error");
        throw new Error(message);
      }
      return normalized;
    },
    validate(input: Record<string, unknown>): string[] {
      const parsed = zodSchema.safeParse(input);
      if (parsed.success) return [];
      return parsed.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `${path}: ${issue.message}`;
      });
    },
    async healthCheck(): Promise<ToolHealth> {
      const startedAt = Date.now();
      try {
        const latencyMs = await rpc.ping();
        return {
          status: latencyMs <= 5_000 ? "healthy" : "degraded",
          latencyMs,
          message: `MCP server reachable (${options.serverName})`,
        };
      } catch (error) {
        return {
          status: "unavailable",
          latencyMs: Date.now() - startedAt,
          message: error instanceof Error ? error.message : "MCP server unreachable",
        };
      }
    },
  };
}

/** Registry-safe tool name for a discovered MCP tool. */
export function mcpToolRegistryName(serverId: string, toolName: string): string {
  const safeTool = toolName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `mcp_${serverId}_${safeTool}`;
}

/**
 * Convert a JSON Schema (draft-07 subset) into a Zod schema for input
 * validation. Unsupported constructs degrade to permissive types instead of
 * rejecting the whole tool.
 */
export function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType {
  const type = schema.type;
  const rawSchema = schema as Record<string, unknown>;

  let result: z.ZodType;
  // enum takes precedence over the primitive type — a `{ type: "string",
  // enum: [...] }` must constrain values, not just the base type.
  if (Array.isArray(rawSchema.enum) && rawSchema.enum.length > 0) {
    const values = rawSchema.enum;
    if (values.every((v) => typeof v === "string")) {
      result = z.enum(values as [string, ...string[]]);
    } else if (values.length === 1) {
      result = z.literal(values[0]);
    } else {
      result = z.union(values.map((v) => z.literal(v)) as [z.ZodLiteral<unknown>, z.ZodLiteral<unknown>, ...z.ZodLiteral<unknown>[]]);
    }
  } else if (type === "string") {
    let base: z.ZodString = z.string();
    if (typeof rawSchema.minLength === "number") base = base.min(rawSchema.minLength);
    if (typeof rawSchema.maxLength === "number") base = base.max(rawSchema.maxLength);
    if (typeof rawSchema.pattern === "string") {
      // MCP servers are third-party code-adjacent input: a hostile pattern
      // (catastrophic backtracking) previously compiled verbatim and ran on
      // EVERY validation call. Cap size, refuse compile failures, and keep
      // going with an unconstrained string rather than bricking the tool.
      const pattern = rawSchema.pattern;
      const safe =
        pattern.length <= 256 &&
        (() => {
          try {
            new RegExp(pattern);
            return true;
          } catch {
            return false;
          }
        })();
      if (safe) base = base.regex(new RegExp(pattern));
    }
    result = base;
  } else if (type === "number" || type === "integer") {
    let base: z.ZodNumber = z.number();
    if (typeof rawSchema.minimum === "number") base = base.min(rawSchema.minimum);
    if (typeof rawSchema.maximum === "number") base = base.max(rawSchema.maximum);
    result = base;
  } else if (type === "boolean") {
    result = z.boolean();
  } else if (type === "null") {
    result = z.null();
  } else if (type === "array") {
    const items = rawSchema.items;
    const itemSchema =
      items && typeof items === "object" && !Array.isArray(items)
        ? jsonSchemaToZod(items as Record<string, unknown>)
        : z.unknown();
    let base: z.ZodArray<z.ZodType> = z.array(itemSchema);
    if (typeof rawSchema.minItems === "number") base = base.min(rawSchema.minItems);
    if (typeof rawSchema.maxItems === "number") base = base.max(rawSchema.maxItems);
    result = base;
  } else if (type === "object" || (type === undefined && rawSchema.properties)) {
    result = objectSchemaToZod(rawSchema);
  } else if (Array.isArray(rawSchema.anyOf) && rawSchema.anyOf.length > 0) {
    const branches = (rawSchema.anyOf as Record<string, unknown>[])
      .filter((b) => b !== null && typeof b === "object")
      .map((b) => jsonSchemaToZod(b));
    result = branches.length === 1 ? branches[0] : z.union(branches as [z.ZodType, z.ZodType, ...z.ZodType[]]);
  } else if (Array.isArray(rawSchema.oneOf) && rawSchema.oneOf.length > 0) {
    const branches = (rawSchema.oneOf as Record<string, unknown>[])
      .filter((b) => b !== null && typeof b === "object")
      .map((b) => jsonSchemaToZod(b));
    result = branches.length === 1 ? branches[0] : z.union(branches as [z.ZodType, z.ZodType, ...z.ZodType[]]);
  } else {
    // No type info — permissive.
    result = z.unknown();
  }

  if (rawSchema.nullable === true || (Array.isArray(rawSchema.type) && rawSchema.type.includes("null"))) {
    result = result.nullable();
  }
  return result;
}

function objectSchemaToZod(rawSchema: Record<string, unknown>): z.ZodType {
  const properties = rawSchema.properties;
  if (properties === null || typeof properties !== "object" || Array.isArray(properties)) {
    return z.record(z.string(), z.unknown());
  }
  const required = Array.isArray(rawSchema.required) ? rawSchema.required.filter((r) => typeof r === "string") : [];
  const shape: Record<string, z.ZodType> = {};
  for (const [key, propRaw] of Object.entries(properties as Record<string, unknown>)) {
    if (propRaw === null || typeof propRaw !== "object") {
      shape[key] = z.unknown();
      continue;
    }
    const propSchema = jsonSchemaToZod(propRaw as Record<string, unknown>);
    shape[key] = required.includes(key) ? propSchema : propSchema.optional();
  }
  if (Object.keys(shape).length === 0) {
    // No declared properties — accept any object shape.
    return z.record(z.string(), z.unknown());
  }
  return z.object(shape).passthrough();
}
