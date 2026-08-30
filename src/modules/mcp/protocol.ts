import { McpToolDefinition } from "@/types/mcp";

/**
 * Pure MCP protocol helpers — no I/O, no SDK imports. Kept dependency-free so
 * the JSON-RPC parsing and tools/list mapping are directly unit-testable.
 */

/** A minimal JSON-RPC 2.0 message shape (subset used by the MCP client hub). */
interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Parse a raw JSON-RPC payload (string or object) and normalize it to the
 * message shape. Returns null when the payload is not a valid JSON-RPC 2.0
 * message (missing jsonrpc field, invalid JSON, wrong type).
 */
export function parseJsonRpcMessage(raw: unknown): JsonRpcMessage | null {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const message = parsed as Record<string, unknown>;
  if (message.jsonrpc !== "2.0") return null;
  return message as unknown as JsonRpcMessage;
}

/** True when a message carries an error result (or is an error response). */
export function isJsonRpcError(message: JsonRpcMessage | null): boolean {
  return message === null || Boolean(message.error);
}

/** Extract the `result.tools` array from a `tools/list` response payload. */
function extractToolsList(rawResult: unknown): unknown[] {
  if (rawResult === null || typeof rawResult !== "object") return [];
  const result = rawResult as Record<string, unknown>;
  if (!Array.isArray(result.tools)) return [];
  return result.tools;
}

/**
 * Validate + normalize one raw `tools/list` entry into an McpToolDefinition.
 * Entries without a name or with a non-object inputSchema are rejected.
 */
export function normalizeToolDefinition(raw: unknown): McpToolDefinition | null {
  if (raw === null || typeof raw !== "object") return null;
  const tool = raw as Record<string, unknown>;
  if (typeof tool.name !== "string" || tool.name.length === 0) return null;

  const inputSchema = normalizeInputSchema(tool.inputSchema);
  if (inputSchema === null) return null;

  const description =
    typeof tool.description === "string" && tool.description.trim().length > 0
      ? tool.description.trim()
      : undefined;

  const annotationsRaw =
    tool.annotations !== null && typeof tool.annotations === "object"
      ? (tool.annotations as Record<string, unknown>)
      : undefined;

  const annotations = annotationsRaw
    ? {
        title: typeof annotationsRaw.title === "string" ? annotationsRaw.title : undefined,
        readOnlyHint: annotationsRaw.readOnlyHint === true,
        destructiveHint: annotationsRaw.destructiveHint === true,
        idempotentHint: annotationsRaw.idempotentHint === true,
        openWorldHint: annotationsRaw.openWorldHint === true,
      }
    : undefined;

  const isWrite = annotations
    ? annotations.readOnlyHint
      ? false
      : annotations.destructiveHint || isWriteByHeuristic(tool.name)
    : isWriteByHeuristic(tool.name);

  return {
    name: tool.name,
    description,
    inputSchema,
    annotations,
    isWrite,
    // WRITE tools always require HITL — mirrors the built-in tool contract.
    requiresApproval: isWrite,
  };
}

/**
 * Map a `tools/list` result (or the raw `result` field) to validated tool
 * definitions, dropping invalid entries.
 */
export function mapToolsList(rawResult: unknown): McpToolDefinition[] {
  const tools: McpToolDefinition[] = [];
  for (const raw of extractToolsList(rawResult)) {
    const normalized = normalizeToolDefinition(raw);
    if (normalized) tools.push(normalized);
  }
  return tools;
}

/**
 * Coerce an arbitrary inputSchema into a JSON-Schema object with at least
 * `type: "object"`. Returns null when the value cannot be interpreted as a
 * schema object.
 */
export function normalizeInputSchema(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) {
    return { type: "object", properties: {} };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const schema = raw as Record<string, unknown>;
  // A `$ref`-style or boolean schema cannot be used as-is — fall back to free-form.
  if (typeof schema.type === "string" && schema.type !== "object") {
    return { type: "object", properties: { value: schema } };
  }
  const properties = schema.properties ?? {};
  return {
    type: "object",
    properties:
      properties !== null && typeof properties === "object" && !Array.isArray(properties)
        ? properties
        : {},
    ...(Array.isArray(schema.required) ? { required: schema.required } : {}),
  };
}

const WRITE_VERB_PATTERN =
  /^(create|update|delete|remove|write|append|edit|modify|send|post|put|patch|insert|upsert|set|save|publish|upload|import|export|copy|move|rename|add|register|unregister|enable|disable|start|stop|restart|build|deploy|release|merge|commit|push|invite|kick|ban|grant|revoke|transfer|pay|refund|charge|book|order|cancel|close|open|lock|unlock|clear|reset|execute|run|approve|reject|apply|install|uninstall|delete_|update_|create_|write_)/i;

/**
 * Name-based write heuristic. The MCP spec recommends servers publish
 * `annotations.readOnlyHint`, but many servers don't — so we fall back to
 * verb prefixes (create_*, update_*, etc.) and known mutation verbs.
 */
export function isWriteByHeuristic(name: string): boolean {
  return WRITE_VERB_PATTERN.test(name);
}

/** Extract the human-readable text from an MCP CallToolResult content array. */
export function extractTextContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const item of content) {
    if (item && typeof item === "object") {
      const block = item as Record<string, unknown>;
      if (block.type === "text" && typeof block.text === "string") parts.push(block.text);
      else if (block.type === "resource" && block.resource && typeof block.resource === "object") {
        const resource = block.resource as Record<string, unknown>;
        if (typeof resource.text === "string") parts.push(resource.text);
      }
    }
  }
  return parts.join("\n");
}

/**
 * Normalize a CallToolResult to a plain JSON value consumable by the Agent
 * Runtime. Prefers `structuredContent`, then joins text blocks, then falls
 * back to the raw result object.
 */
export function normalizeToolResult(result: unknown): unknown {
  if (result === null || result === undefined) return null;
  if (typeof result !== "object") return result;
  const res = result as Record<string, unknown>;
  if (res.structuredContent !== undefined) return res.structuredContent;
  const text = extractTextContent(res.content);
  if (text.length > 0) {
    // If the server returned one JSON blob as text, unwrap it.
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return text;
      }
    }
    return text;
  }
  return result;
}
