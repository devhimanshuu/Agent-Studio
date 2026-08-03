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
    if (!allowedTools?.includes(toolName)) {
      return { ok: false, reason: "TOOL_NOT_ALLOWED", toolName };
    }
    if (blockedTools?.includes(toolName)) {
      return { ok: false, reason: "TOOL_BLOCKED", toolName };
    }
    return { ok: true };
  }
}
