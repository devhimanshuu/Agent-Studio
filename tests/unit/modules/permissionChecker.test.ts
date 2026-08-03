import { describe, it, expect } from "vitest";
import { PermissionChecker } from "@/modules/execution/tool-registry/permissionChecker";
import { ToolRegistry } from "@/modules/execution/tool-registry/toolRegistry";

function makeRegistry() {
  const registry = new ToolRegistry();
  registry.registerTool({
    name: "calculator",
    description: "Math",
    parameters: {},
    enabled: true,
    execute: async () => 0,
  });
  registry.registerTool({
    name: "disabled_tool",
    description: "Off",
    parameters: {},
    enabled: false,
    execute: async () => 0,
  });
  return registry;
}

describe("PermissionChecker", () => {
  const checker = new PermissionChecker();

  it("allows a registered, enabled tool listed in allowedTools", () => {
    const registry = makeRegistry();
    expect(checker.check("calculator", ["calculator"], registry)).toEqual({ ok: true });
  });

  it("rejects a tool that exists but is not in the skill's allowedTools", () => {
    const registry = makeRegistry();
    const verdict = checker.check("calculator", ["other_tool"], registry);
    expect(verdict).toEqual({ ok: false, reason: "TOOL_NOT_ALLOWED", toolName: "calculator" });
  });

  it("rejects a disabled tool even when allowed", () => {
    const registry = makeRegistry();
    const verdict = checker.check("disabled_tool", ["disabled_tool"], registry);
    expect(verdict).toEqual({ ok: false, reason: "TOOL_DISABLED", toolName: "disabled_tool" });
  });

  it("rejects an unregistered tool", () => {
    const registry = makeRegistry();
    const verdict = checker.check("ghost", ["ghost"], registry);
    expect(verdict).toEqual({ ok: false, reason: "TOOL_NOT_FOUND", toolName: "ghost" });
  });

  it("rejects when allowedTools is empty (skill has no permitted tools)", () => {
    const registry = makeRegistry();
    const verdict = checker.check("calculator", [], registry);
    expect(verdict.ok).toBe(false);
  });
});
