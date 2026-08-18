import { describe, it, expect } from "vitest";
import { ExecutionEngine } from "@/modules/execution/executor/executionEngine";
import { ToolRegistry } from "@/modules/tools";
import { PermissionChecker } from "@/modules/execution/tool-registry/permissionChecker";
import { PlannerService } from "@/modules/execution/planner/plannerService";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { StubLLM } from "../helpers/stubLLM";
import { FakeExecutionRepo } from "../helpers/fakeExecutionRepo";
import { FakeApprovalRepo } from "../helpers/fakeApprovalRepo";
import { FakeLogRepo } from "../helpers/fakeLogRepo";
import { createMcpTool } from "@/modules/mcp/toolAdapter";
import { McpRpcClient } from "@/modules/mcp/toolAdapter";
import { McpToolDefinition } from "@/types/mcp";
import { McpClientService } from "@/services/McpClientService";
import { IMcpServerRepository } from "@/repositories/interfaces/IMcpServerRepository";
import {
  CreateMcpServerInput,
  McpServerDTO,
  McpServerStatus,
  UpdateMcpServerInput,
} from "@/types/mcp";

/** In-process fake MCP server — responds to tool calls like a real server. */
function fakeMcpServer(handlers: Record<string, (args: Record<string, unknown>) => unknown>): {
  rpc: McpRpcClient;
  calls: { tool: string; args: Record<string, unknown> }[];
} {
  const calls: { tool: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    rpc: {
      async callTool(name, args) {
        calls.push({ tool: name, args });
        const handler = handlers[name];
        if (!handler) throw new Error(`Unknown tool: ${name}`);
        return { content: [{ type: "text", text: JSON.stringify(handler(args)) }] };
      },
      async ping() {
        return 3;
      },
    },
  };
}

function makeSkill(): SkillDTO {
  return {
    id: "s1",
    userId: "u1",
    name: "MCP Skill",
    purpose: "Uses an external MCP tool",
    status: "PUBLISHED",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeVersion(overrides: Partial<SkillVersionDTO> = {}): SkillVersionDTO {
  return {
    id: "v1",
    skillId: "s1",
    versionNumber: 1,
    status: "PUBLISHED",
    inputSchema: {},
    outputSchema: {},
    instructions: "Use the MCP tool.",
    examples: [],
    allowedTools: [],
    actionsRequiringApproval: [],
    maxExecutionSteps: 10,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeEngine(registry: ToolRegistry, plan: unknown, _version: SkillVersionDTO) {
  const repo = new FakeExecutionRepo();
  const approvalRepo = new FakeApprovalRepo();
  const engine = new ExecutionEngine({
    toolRegistry: registry,
    permissionChecker: new PermissionChecker(),
    planner: new PlannerService(new StubLLM({ plan })),
    executionRepo: repo,
    approvalRepo,
    logRepo: new FakeLogRepo(),
    timeoutMs: 5_000,
  });
  return { engine, repo, approvalRepo };
}

describe("MCP tools inside the LangGraph runtime", () => {
  it("executes a remote READ MCP tool and records the call with metrics", async () => {
    const server = fakeMcpServer({
      get_weather: (args) => ({ temperature: 21, city: args.city }),
    });
    const readTool = createMcpTool(
      {
        name: "get_weather",
        description: "Get weather for a city",
        inputSchema: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
        isWrite: false,
        requiresApproval: false,
      },
      server.rpc,
      { serverId: "svc_a", serverName: "Weather" }
    );

    const registry = new ToolRegistry();
    registry.registerTool(readTool);
    const toolName = readTool.name; // mcp_svc_a_get_weather

    const plan = {
      reasoning: "Check the weather.",
      requiredTools: [toolName],
      steps: [
        { stepNumber: 1, toolName, action: "get_weather", input: { city: "Berlin" }, requiresApproval: false },
      ],
      expectedOutput: "temperature",
    };
    const version = makeVersion({ allowedTools: [toolName] });
    const { engine, repo } = makeEngine(registry, plan, version);

    const result = await engine.run({
      executionId: "mcp-exec-1",
      skill: makeSkill(),
      version,
      userInput: { city: "Berlin" },
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.finalOutput?.results).toEqual({ step_1: { temperature: 21, city: "Berlin" } });
    // The fake MCP server really received the invocation with merged action.
    expect(server.calls).toEqual([{ tool: "get_weather", args: { city: "Berlin", action: "get_weather" } }]);
    // Timeline persisted a tool call with wall-clock metrics.
    expect(repo.toolCalls).toHaveLength(1);
    expect(repo.toolCalls[0].toolName).toBe(toolName);
    expect(repo.toolCalls[0].status).toBe("SUCCESS");
    expect(repo.toolCalls[0].durationMs).toBeTypeOf("number");
  });

  it("blocks an MCP tool that is not in the skill's allowedTools", async () => {
    const server = fakeMcpServer({ get_weather: (args) => args });
    const readTool = createMcpTool(
      {
        name: "get_weather",
        inputSchema: { type: "object", properties: { city: { type: "string" } } },
        isWrite: false,
        requiresApproval: false,
      },
      server.rpc,
      { serverId: "svc_a", serverName: "Weather" }
    );
    const registry = new ToolRegistry();
    registry.registerTool(readTool);

    const plan = {
      reasoning: "x",
      requiredTools: [readTool.name],
      steps: [{ stepNumber: 1, toolName: readTool.name, action: "read", input: {}, requiresApproval: false }],
      expectedOutput: "x",
    };
    // allowedTools deliberately omits the MCP tool.
    const version = makeVersion({ allowedTools: ["calculator"] });
    const { engine } = makeEngine(registry, plan, version);

    const result = await engine.run({
      executionId: "mcp-exec-2",
      skill: makeSkill(),
      version,
      userInput: {},
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/Unauthorized tool/);
    expect(server.calls).toHaveLength(0);
  });

  it("pauses for HITL approval when an MCP WRITE tool is planned and enforces the idempotency token", async () => {
    const server = fakeMcpServer({
      create_issue: (args) => ({ issue: { number: 7, title: args.title } }),
    });
    const writeTool = createMcpTool(
      {
        name: "create_issue",
        description: "Create an issue",
        inputSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
        isWrite: true,
        requiresApproval: true,
      },
      server.rpc,
      { serverId: "svc_b", serverName: "GitHub" }
    );
    const registry = new ToolRegistry();
    registry.registerTool(writeTool);

    const plan = {
      reasoning: "File an issue.",
      requiredTools: [writeTool.name],
      steps: [
        { stepNumber: 1, toolName: writeTool.name, action: "create_issue", input: { title: "bug" }, requiresApproval: false },
      ],
      expectedOutput: "issue",
    };
    const version = makeVersion({ allowedTools: [writeTool.name] });
    const { engine, approvalRepo } = makeEngine(registry, plan, version);

    const result = await engine.run({
      executionId: "mcp-exec-3",
      skill: makeSkill(),
      version,
      userInput: {},
    });

    // Write action → the run parks and does NOT invoke the remote tool.
    expect(result.status).toBe("PAUSED_FOR_APPROVAL");
    expect(server.calls).toHaveLength(0);

    // A single-use approval lock was created with the deterministic key.
    expect(approvalRepo.requests).toHaveLength(1);
    const request = approvalRepo.requests[0];
    expect(request).toMatchObject({
      executionId: "mcp-exec-3",
      userId: "u1",
      toolName: writeTool.name,
      action: "create_issue",
      inputPayload: { title: "bug" },
      status: "PENDING",
      idempotencyKey: `appr-mcp-exec-3-step-1`,
    });

    // The token is single-use: re-responding loses the atomic CAS race (null)
    // and never flips the row twice.
    const first = await approvalRepo.respond({
      approvalId: request.id,
      userId: "u1",
      approved: true,
      idempotencyKey: request.idempotencyKey,
    });
    expect(first!.status).toBe("APPROVED");
    const second = await approvalRepo.respond({
      approvalId: request.id,
      userId: "u1",
      approved: true,
      idempotencyKey: request.idempotencyKey,
    });
    expect(second).toBeNull();
  });

  it("executes an approved MCP WRITE tool on resume (no re-pause)", async () => {
    const server = fakeMcpServer({
      create_issue: (args) => ({ issue: { number: 7, title: args.title } }),
    });
    const writeTool = createMcpTool(
      {
        name: "create_issue",
        description: "Create an issue",
        inputSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
        isWrite: true,
        requiresApproval: true,
      },
      server.rpc,
      { serverId: "svc_b", serverName: "GitHub" }
    );
    const registry = new ToolRegistry();
    registry.registerTool(writeTool);

    const plan = {
      reasoning: "File an issue.",
      requiredTools: [writeTool.name],
      steps: [
        { stepNumber: 1, toolName: writeTool.name, action: "create_issue", input: { title: "bug" }, requiresApproval: false },
      ],
      expectedOutput: "issue",
    };
    const version = makeVersion({ allowedTools: [writeTool.name] });
    const { engine, approvalRepo, repo } = makeEngine(registry, plan, version);

    const first = await engine.run({ executionId: "mcp-exec-4", skill: makeSkill(), version, userInput: {} });
    expect(first.status).toBe("PAUSED_FOR_APPROVAL");

    // Reviewer approves.
    const request = approvalRepo.requests[0];
    await approvalRepo.respond({
      approvalId: request.id,
      userId: "u1",
      approved: true,
      idempotencyKey: request.idempotencyKey,
    });

    // Resume — the approved step executes against the remote server.
    const resumed = await engine.run({
      executionId: "mcp-exec-4",
      skill: makeSkill(),
      version,
      userInput: {},
      resume: {
        plan: plan as never,
        currentStep: 0,
        results: {},
        toolCalls: [],
        providerUsed: "stub/stub-model",
        persistedStepCount: repo.steps.length,
      },
    });

    expect(resumed.status).toBe("COMPLETED");
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].tool).toBe("create_issue");
    expect(approvalRepo.requests).toHaveLength(1); // no duplicate lock
  });
});

describe("McpClientService.registerUserMcpTools", () => {
  class FakeMcpRepo implements IMcpServerRepository {
    private rows: McpServerDTO[] = [];
    seed(rows: McpServerDTO[]) {
      this.rows = rows;
    }
    async findById(id: string) {
      return this.rows.find((r) => r.id === id) ?? null;
    }
    async findByIdForUser(id: string, userId: string) {
      const row = this.rows.find((r) => r.id === id);
      return row && row.userId === userId ? row : null;
    }
    async findByUserId(userId: string) {
      return this.rows.filter((r) => r.userId === userId);
    }
    async create(input: CreateMcpServerInput) {
      const row: McpServerDTO = {
        id: "svc-1",
        userId: input.userId,
        name: input.name,
        transport: input.transport,
        endpointUrl: input.endpointUrl ?? null,
        command: input.command ?? null,
        headers: input.headers ?? null,
        status: "DISCONNECTED",
        cachedTools: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.rows.push(row);
      return row;
    }
    async update(id: string, userId: string, _input: UpdateMcpServerInput): Promise<McpServerDTO> {
      const row = await this.findByIdForUser(id, userId);
      if (!row) throw new Error("not found");
      return row;
    }
    async delete(id: string, userId: string) {
      this.rows = this.rows.filter((r) => !(r.id === id && r.userId === userId));
    }
    async updateStatus(id: string, status: McpServerStatus) {
      const row = this.rows.find((r) => r.id === id)!;
      row.status = status;
      return row;
    }
    async updateCachedTools(id: string, tools: McpToolDefinition[]) {
      const row = this.rows.find((r) => r.id === id)!;
      row.cachedTools = tools;
      row.status = "CONNECTED";
      return row;
    }
  }

  it("syncs cached MCP tools into a registry idempotently and per-user", async () => {
    const repo = new FakeMcpRepo();
    repo.seed([
      {
        id: "svc_a",
        userId: "u1",
        name: "GitHub",
        transport: "SSE",
        endpointUrl: "https://example.com/mcp",
        status: "CONNECTED",
        cachedTools: [
          {
            name: "get_issue",
            inputSchema: { type: "object", properties: { id: { type: "string" } } },
            isWrite: false,
            requiresApproval: false,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "svc_b",
        userId: "u2",
        name: "Other User's Server",
        transport: "SSE",
        status: "CONNECTED",
        cachedTools: [
          {
            name: "secret_tool",
            inputSchema: { type: "object", properties: {} },
            isWrite: true,
            requiresApproval: true,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const service = new McpClientService(repo);
    const registry = new ToolRegistry();

    const tools = await service.registerUserMcpTools("u1", registry);
    expect(tools.map((t) => t.name)).toEqual(["mcp_svc_a_get_issue"]);

    // Idempotent — re-sync replaces, never throws on duplicates.
    await service.registerUserMcpTools("u1", registry);
    expect(registry.listTools()).toHaveLength(1);

    // Another user's cached tools sync into the same shared registry but are
    // namespaced per server id — never a collision.
    const other = await service.registerUserMcpTools("u2", registry);
    expect(other.map((t) => t.name)).toEqual(["mcp_svc_b_secret_tool"]);
    expect(registry.hasTool("mcp_svc_b_secret_tool")).toBe(true);

    // Mapped contract matches the cached definition (READ vs WRITE + HITL).
    const readTool = registry.getTool("mcp_svc_a_get_issue")!;
    expect(readTool.type).toBe("READ");
    expect(readTool.requiresApproval).toBe(false);
    expect(readTool.inputSchema).toMatchObject({ type: "object" });
    const writeTool = registry.getTool("mcp_svc_b_secret_tool")!;
    expect(writeTool.type).toBe("WRITE");
    expect(writeTool.requiresApproval).toBe(true);
  });
});
