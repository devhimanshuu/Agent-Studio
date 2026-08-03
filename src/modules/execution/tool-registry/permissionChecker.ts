import { ToolRegistry } from "./toolRegistry";

export type ToolPermissionVerdict =
  | { ok: true }
  | { ok: false; reason: "TOOL_NOT_FOUND" | "TOOL_DISABLED" | "TOOL_NOT_ALLOWED"; toolName: string };

/**
 * Enforces the skill's tool boundary before anything executes:
 *  1. Tool exists in the registry
 *  2. Tool is enabled
 *  3. Tool is listed in the skill's `allowedTools`
 *
 * Any violation rejects the tool — the runtime never executes outside the
 * skill's declared surface.
 */
export class PermissionChecker {
  check(toolName: string, allowedTools: string[] | undefined, registry: ToolRegistry): ToolPermissionVerdict {
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
    return { ok: true };
  }
}
