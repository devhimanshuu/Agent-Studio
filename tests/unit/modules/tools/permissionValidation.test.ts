import { describe, it, expect } from "vitest";
import { PermissionChecker } from "@/modules/execution/tool-registry/permissionChecker";
import { createToolRegistry } from "@/modules/tools";
import { makeTool } from "./helpers/makeTool";

function makeRegistry() {
  const registry = createToolRegistry();
  registry.registerTool(makeTool({ name: "disabled_tool", enabled: false }));
  return registry;
}

describe("Permission validation against the real registry", () => {
  const checker = new PermissionChecker();

  it("allows a built-in tool listed in allowedTools", () => {
    const registry = makeRegistry();
    expect(checker.check("calculator", ["calculator"], registry)).toEqual({ ok: true });
  });

  it("rejects a built-in tool that is not in the skill's allowedTools", () => {
    const registry = makeRegistry();
    expect(checker.check("document_search", ["calculator"], registry)).toEqual({
      ok: false,
      reason: "TOOL_NOT_ALLOWED",
      toolName: "document_search",
    });
  });

  it("rejects a disabled tool even when allowed", () => {
    const registry = makeRegistry();
    expect(checker.check("disabled_tool", ["disabled_tool"], registry)).toEqual({
      ok: false,
      reason: "TOOL_DISABLED",
      toolName: "disabled_tool",
    });
  });

  it("rejects an unregistered tool", () => {
    const registry = makeRegistry();
    expect(checker.check("ghost", ["ghost"], registry)).toEqual({
      ok: false,
      reason: "TOOL_NOT_FOUND",
      toolName: "ghost",
    });
  });

  it("rejects a tool on the blocked list (tool not blocked check)", () => {
    const registry = makeRegistry();
    expect(checker.check("calculator", ["calculator"], registry, ["calculator"])).toEqual({
      ok: false,
      reason: "TOOL_BLOCKED",
      toolName: "calculator",
    });
  });

  it("rejects when allowedTools is empty", () => {
    const registry = makeRegistry();
    expect(checker.check("calculator", [], registry).ok).toBe(false);
  });
});
