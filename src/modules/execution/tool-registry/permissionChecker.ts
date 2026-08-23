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
 * Supports ONLY patterns scoped by an explicit prefix the skill author wrote:
 *  - Exact match: 'calculator' === 'calculator'
 *  - Wildcard all: '*'
 *  - Trailing glob: 'mcp_server123_*' matches 'mcp_server123_run_query'
 *
 * Deliberately NOT supported anymore:
 *  - Leading globs ('*_search') — matched any tenant's namespaced tool.
 *  - Base-name matching ('run_query' → 'mcp_<serverId>_run_query') — let a
 *    skill invoke another user's MCP/OpenAPI tool that happened to be loaded
 *    into the shared registry. Dynamic tools must be allowed by their FULL
 *    registry name or a server-scoped prefix.
 */
function isToolAllowed(toolName: string, allowedTools: string[] | undefined): boolean {
  if (!allowedTools || allowedTools.length === 0) return false;

  for (const pattern of allowedTools) {
    if (pattern === "*" || pattern === toolName) return true;
    if (pattern.endsWith("*") && toolName.startsWith(pattern.slice(0, -1))) {
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
