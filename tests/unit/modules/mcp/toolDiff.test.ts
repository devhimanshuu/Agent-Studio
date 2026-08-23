import { describe, it, expect } from "vitest";
import { computeToolDiff, applyToolUpdates } from "@/modules/mcp/toolDiff";
import { McpToolDefinition } from "@/types/mcp";

function makeTool(overrides: Partial<McpToolDefinition> & { name: string }): McpToolDefinition {
  return {
    description: "",
    inputSchema: {},
    isWrite: false,
    requiresApproval: false,
    ...overrides,
  };
}

describe("computeToolDiff", () => {
  it("handles tools with undefined or null inputSchema gracefully without crashing", () => {
    const oldTools: McpToolDefinition[] = [
      makeTool({
        name: "ping",
        description: "Ping tool",
        inputSchema: undefined as unknown as Record<string, unknown>,
      }),
    ];

    const newTools: McpToolDefinition[] = [
      makeTool({
        name: "ping",
        description: "Ping tool updated",
        inputSchema: { type: "object", properties: { message: { type: "string" } } },
      }),
    ];

    const changes = computeToolDiff(oldTools, newTools);
    expect(changes).toHaveLength(1);
    expect(changes[0].toolName).toBe("ping");
    expect(changes[0].summary).toContain("Description updated");
  });

  it("detects added, removed, and schema changed tools", () => {
    const oldTools: McpToolDefinition[] = [
      makeTool({ name: "toolA", description: "A" }),
      makeTool({ name: "toolB", description: "B" }),
    ];
    const newTools: McpToolDefinition[] = [
      makeTool({ name: "toolB", description: "B updated" }),
      makeTool({ name: "toolC", description: "C" }),
    ];

    const changes = computeToolDiff(oldTools, newTools);
    const kinds = changes.map((c) => ({ name: c.toolName, kind: c.kind }));
    expect(kinds).toContainEqual({ name: "toolA", kind: "removed" });
    expect(kinds).toContainEqual({ name: "toolB", kind: "description_changed" });
    expect(kinds).toContainEqual({ name: "toolC", kind: "added" });
  });

  it("applies updates to allowedTools cleanly", () => {
    const changes = computeToolDiff(
      [],
      [makeTool({ name: "calc", description: "Calculator" })]
    );
    const updated = applyToolUpdates(["custom_tool"], changes, "srv1");
    expect(updated).toContain("custom_tool");
    expect(updated).toContain("mcp_srv1_calc");
  });
});
