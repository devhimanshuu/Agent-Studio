import { describe, it, expect } from "vitest";
import { PermissionChecker } from "@/modules/execution/tool-registry/permissionChecker";
import { ToolRegistry } from "@/modules/tools";
import { makeTool } from "./tools/helpers/makeTool";

function makeRegistry() {
  const registry = new ToolRegistry();
  registry.registerTool(makeTool({ name: "calculator", description: "Math" }));
  registry.registerTool(makeTool({ name: "disabled_tool", description: "Off", enabled: false }));
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

  it("rejects a tool on the blocked list", () => {
    const registry = makeRegistry();
    const verdict = checker.check("calculator", ["calculator"], registry, ["calculator"]);
    expect(verdict).toEqual({ ok: false, reason: "TOOL_BLOCKED", toolName: "calculator" });
  });

  it("allows any tool when allowedTools contains '*'", () => {
    const registry = makeRegistry();
    expect(checker.check("calculator", ["*"], registry)).toEqual({ ok: true });
  });

  it("allows tool matching a prefix wildcard pattern like 'mcp_srv1_*'", () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeTool({ name: "mcp_srv1_query", description: "Query" }));
    expect(checker.check("mcp_srv1_query", ["mcp_srv1_*"], registry)).toEqual({ ok: true });
    expect(checker.check("mcp_srv1_query", ["mcp_srv2_*"], registry)).toEqual({
      ok: false,
      reason: "TOOL_NOT_ALLOWED",
      toolName: "mcp_srv1_query",
    });
  });

  it("allows tool matching by base action name", () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeTool({ name: "mcp_supabase_run_sql", description: "SQL" }));
    expect(checker.check("mcp_supabase_run_sql", ["run_sql"], registry)).toEqual({ ok: true });
  });
});
