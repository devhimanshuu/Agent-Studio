import { describe, it, expect, vi } from "vitest";
import { createMcpTool, jsonSchemaToZod, mcpToolRegistryName } from "@/modules/mcp/toolAdapter";
import { McpRpcClient } from "@/modules/mcp/toolAdapter";
import { McpToolDefinition } from "@/types/mcp";

function fakeRpc(overrides: Partial<McpRpcClient> = {}): McpRpcClient {
  return {
    callTool: vi.fn(async () => ({ content: [{ type: "text", text: "ok" }] })),
    ping: vi.fn(async () => 12),
    ...overrides,
  };
}

function makeDefinition(overrides: Partial<McpToolDefinition> = {}): McpToolDefinition {
  return {
    name: "create_issue",
    description: "Create a GitHub issue",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" }, labels: { type: "array", items: { type: "string" } } },
      required: ["title"],
    },
    isWrite: true,
    requiresApproval: true,
    ...overrides,
  };
}

describe("createMcpTool", () => {
  it("namespaces the registry tool name per server", () => {
    const tool = createMcpTool(makeDefinition(), fakeRpc(), { serverId: "svc_1", serverName: "GitHub" });
    expect(tool.name).toBe("mcp_svc_1_create_issue");
    expect(tool.id).toBe(tool.name);
    expect(mcpToolRegistryName("svc_1", "create issue!")).toBe("mcp_svc_1_create_issue_");
  });

  it("maps write tools to WRITE type + requiresApproval and read tools to READ", () => {
    const write = createMcpTool(makeDefinition(), fakeRpc(), { serverId: "s1", serverName: "GitHub" });
    expect(write.type).toBe("WRITE");
    expect(write.requiresApproval).toBe(true);
    expect(write.category).toBe("TASK");

    const read = createMcpTool(
      makeDefinition({ name: "get_issue", isWrite: false, requiresApproval: false }),
      fakeRpc(),
      { serverId: "s1", serverName: "GitHub" }
    );
    expect(read.type).toBe("READ");
    expect(read.requiresApproval).toBe(false);
  });

  it("executes through the rpc client and normalizes the CallToolResult", async () => {
    const rpc = fakeRpc({
      callTool: vi.fn(async () => ({
        content: [{ type: "text", text: '{"number": 42}' }],
        structuredContent: { number: 42 },
      })),
    });
    const tool = createMcpTool(makeDefinition(), rpc, { serverId: "s1", serverName: "GitHub" });

    const output = await tool.execute({ title: "bug" });
    expect(output).toEqual({ number: 42 });
    expect(rpc.callTool).toHaveBeenCalledWith("create_issue", { title: "bug" });
  });

  it("throws when the remote server reports isError", async () => {
    const rpc = fakeRpc({
      callTool: vi.fn(async () => ({
        content: [{ type: "text", text: "rate limited" }],
        isError: true,
      })),
    });
    const tool = createMcpTool(makeDefinition(), rpc, { serverId: "s1", serverName: "GitHub" });
    await expect(tool.execute({ title: "x" })).rejects.toThrow(/rate limited/);
  });

  it("validates input against the mapped Zod schema", () => {
    const tool = createMcpTool(makeDefinition(), fakeRpc(), { serverId: "s1", serverName: "GitHub" });

    expect(tool.validate({ title: "bug" })).toEqual([]);
    expect(tool.validate({ title: "bug", labels: ["p1"] })).toEqual([]);
    const issues = tool.validate({ labels: ["p1"] });
    expect(issues.some((i) => i.includes("title"))).toBe(true);
  });

  it("healthCheck reports latency from ping and degrades on failure", async () => {
    const healthy = createMcpTool(makeDefinition(), fakeRpc(), { serverId: "s1", serverName: "GitHub" });
    expect(await healthy.healthCheck()).toMatchObject({ status: "healthy", latencyMs: 12 });

    const broken = createMcpTool(
      makeDefinition(),
      fakeRpc({ ping: vi.fn(async () => Promise.reject(new Error("down"))) }),
      { serverId: "s1", serverName: "GitHub" }
    );
    expect(await broken.healthCheck()).toMatchObject({ status: "unavailable" });
  });

  it("honors a custom timeout", () => {
    const tool = createMcpTool(makeDefinition(), fakeRpc(), { serverId: "s1", serverName: "GitHub", timeoutMs: 5_000 });
    expect(tool.timeoutMs).toBe(5_000);
  });
});

describe("jsonSchemaToZod", () => {
  it("maps the common JSON Schema primitives", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
        active: { type: "boolean" },
        tags: { type: "array", items: { type: "string" } },
        level: { type: "string", enum: ["LOW", "HIGH"] },
      },
      required: ["name"],
    };
    const zod = jsonSchemaToZod(schema);

    expect(zod.safeParse({ name: "x" }).success).toBe(true);
    expect(zod.safeParse({ name: "x", age: 30, active: true, tags: ["a"], level: "HIGH" }).success).toBe(true);
    expect(zod.safeParse({}).success).toBe(false); // name required
    expect(zod.safeParse({ name: 42 }).success).toBe(false); // wrong type
    expect(zod.safeParse({ name: "x", level: "EXTREME" }).success).toBe(false); // enum
  });

  it("handles nullable and anyOf constructs", () => {
    const nullable = jsonSchemaToZod({ type: "string", nullable: true });
    expect(nullable.safeParse(null).success).toBe(true);

    const union = jsonSchemaToZod({ anyOf: [{ type: "string" }, { type: "number" }] });
    expect(union.safeParse("a").success).toBe(true);
    expect(union.safeParse(3).success).toBe(true);
    expect(union.safeParse(true).success).toBe(false);
  });

  it("degrades unknown constructs to permissive", () => {
    const permissive = jsonSchemaToZod({});
    expect(permissive.safeParse(anything()).success).toBe(true);
    expect(permissive.safeParse({ deep: [1, 2, { x: true }] }).success).toBe(true);
  });
});

function anything(): unknown {
  return { random: true };
}
