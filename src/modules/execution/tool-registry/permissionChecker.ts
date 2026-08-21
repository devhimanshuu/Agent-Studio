import { ToolRegistry } from "@/modules/tools";

export type ToolPermissionVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: "TOOL_NOT_FOUND" | "TOOL_DISABLED" | "TOOL_NOT_ALLOWED" | "TOOL_BLOCKED";
      toolName: string;
    };

/**
 * Enforces the skill's tool boundary before anything executes:
 *  1. Tool exists in the registry
 *  2. Tool is enabled
 *  3. Tool is listed in the skill's `allowedTools`
 *  4. Tool is not in the (optional) blocklist
 *
 * Any violation rejects the tool — the runtime never executes outside the
 * skill's declared surface.
 */
/**
 * Helper to check if a toolName satisfies the allowedTools rules.
 * Supports:
 *  - Exact match: 'calculator' === 'calculator'
 *  - Wildcard all: '*'
 *  - Prefix / glob matching: 'mcp_server123_*' matches 'mcp_server123_run_query'
 *  - Suffix matching: '*_search' matches 'custom_search'
 *  - Base name matching: 'run_query' matches 'mcp_server123_run_query' or 'openapi_intg_run_query'
 */
function isToolAllowed(toolName: string, allowedTools: string[] | undefined): boolean {
  if (!allowedTools || allowedTools.length === 0) return false;

  for (const pattern of allowedTools) {
    if (pattern === "*" || pattern === toolName) return true;

    // Prefix wildcard: "mcp_serverId_*" or "mcp_*"
    if (pattern.endsWith("*") && toolName.startsWith(pattern.slice(0, -1))) {
      return true;
    }

    // Suffix wildcard: "*_search"
    if (pattern.startsWith("*") && toolName.endsWith(pattern.slice(1))) {
      return true;
    }

    // Base name matching: "run_query" matches "mcp_<serverId>_run_query" or "openapi_<id>_run_query"
    const mcpMatch = toolName.match(/^mcp_[^_]+_(.+)$/);
    if (mcpMatch && (mcpMatch[1] === pattern || `mcp_${mcpMatch[1]}` === pattern)) {
      return true;
    }

    const openApiMatch = toolName.match(/^openapi_[^_]+_(.+)$/);
    if (openApiMatch && (openApiMatch[1] === pattern || `openapi_${openApiMatch[1]}` === pattern)) {
      return true;
    }
  }

  return false;
}

export class PermissionChecker {
  check(
    toolName: string,
    allowedTools: string[] | undefined,
    registry: ToolRegistry,
    blockedTools: string[] | undefined = []
  ): ToolPermissionVerdict {
    const tool = registry.getTool(toolName);
    if (!tool) {
      return { ok: false, reason: "TOOL_NOT_FOUND", toolName };
    }
    if (!tool.enabled) {
      return { ok: false, reason: "TOOL_DISABLED", toolName };
    }
    if (!isToolAllowed(toolName, allowedTools)) {
      return { ok: false, reason: "TOOL_NOT_ALLOWED", toolName };
    }
    if (blockedTools?.includes(toolName)) {
      return { ok: false, reason: "TOOL_BLOCKED", toolName };
    }
    return { ok: true };
  }
}
