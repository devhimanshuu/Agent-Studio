import { describe, it, expect, vi, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  AgentStudioMcpServer,
  PublishedSkillVersionRow,
  slugify,
  isValidMcpAccessToken,
  isMcpRequestAuthorized,
} from "@/modules/mcp/server";
import { IExecutionService } from "@/services/interfaces/IExecutionService";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { ExecutionDTO } from "@/types/execution";
import { SkillDTO } from "@/types/skill";

function makePublishedRow(overrides: Partial<PublishedSkillVersionRow> = {}): PublishedSkillVersionRow {
  return {
    id: "v1",
    skillId: "s1",
    versionNumber: 1,
    status: "PUBLISHED",
    inputSchema: {
      type: "object",
      properties: { customerName: { type: "string" } },
      required: ["customerName"],
    },
    outputSchema: { type: "object" },
    instructions: "Handle the refund.",
    examples: [],
    allowedTools: ["ai_extraction", "final_report"],
    actionsRequiringApproval: ["create_task"],
    maxExecutionSteps: 10,
    graphDefinition: null,
    changelog: null,
    notes: null,
    createdAt: new Date(),
    publishedAt: new Date(),
    skill: { id: "s1", name: "Customer Refund Workflow", purpose: "Bounded refund automation", userId: "u1" },
    ...overrides,
  };
}

function makeExecution(status: ExecutionDTO["status"] = "COMPLETED"): ExecutionDTO {
  return {
    id: "exec-1",
    userId: "u1",
    skillVersionId: "v1",
    skillName: "Customer Refund Workflow",
    status,
    inputData: {},
    finalOutput: status === "COMPLETED" ? { results: { step_1: "ok" } } : null,
    stepCount: 1,
    maxSteps: 10,
    startedAt: new Date(),
    completedAt: status === "COMPLETED" ? new Date() : null,
  };
}

function makeDeps(overrides: Partial<Parameters<typeof makeAgentServerDeps>[0]> = {}) {
  const startExecution = vi.fn(async () => makeExecution("COMPLETED"));
  const findByIdForUser = vi.fn(async (_skillId: string, userId: string): Promise<SkillDTO | null> => ({
    id: "s1",
    userId,
    name: "Customer Refund Workflow",
    purpose: "Bounded refund automation",
    status: "PUBLISHED",
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  return {
    startExecution,
    findByIdForUser,
    ...makeAgentServerDeps({ startExecution, findByIdForUser, ...overrides }),
  };
}

function makeAgentServerDeps(deps: {
  startExecution?: (input: unknown) => Promise<ExecutionDTO>;
  findByIdForUser?: (skillId: string, userId: string) => Promise<SkillDTO | null>;
  rows?: PublishedSkillVersionRow[];
}) {
  return {
    executionService: { startExecution: deps.startExecution ?? vi.fn() } as unknown as IExecutionService,
    skillRepo: { findByIdForUser: deps.findByIdForUser ?? vi.fn() } as unknown as ISkillRepository,
    listPublishedSkillVersions: async () => deps.rows ?? [makePublishedRow()],
  };
}

/** Attach an in-memory MCP client to a built AgentStudioMcpServer. */
async function connectClient(server: AgentStudioMcpServer) {
  const mcp = await server.buildServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "unit-test-client", version: "1.0.0" }, { capabilities: {} });
  await Promise.all([client.connect(clientTransport), mcp.connect(serverTransport)]);
  return { mcp, client, close: () => Promise.all([client.close(), mcp.close()]) };
}

const serversToClose: { close: () => Promise<unknown> }[] = [];
afterEach(async () => {
  await Promise.all(serversToClose.splice(0).map((s) => s.close().catch(() => {})));
  vi.restoreAllMocks();
});

/** Read a streamed SSE response body and return the parsed JSON `data:` payload. */
async function readSseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  const dataLine = text
    .split(/\r?\n/)
    .find((line) => line.startsWith("data:"))
    ?.slice(5)
    .trim();
  if (!dataLine) throw new Error(`No data: line in SSE body: ${text.slice(0, 200)}`);
  return JSON.parse(dataLine);
}

describe("slugify", () => {
  it("converts skill names to MCP tool-safe slugs", () => {
    expect(slugify("Customer Refund Workflow")).toBe("customer_refund_workflow");
    expect(slugify("  GitHub   Actions  ")).toBe("github_actions");
    expect(slugify("Über-Paid!")).toBe("ber_paid");
    expect(slugify("!!!")).toBe("skill"); // fallback
  });
});

describe("isValidMcpAccessToken", () => {
  it("matches the configured token", () => {
    expect(isValidMcpAccessToken("secret", "secret")).toBe(true);
    expect(isValidMcpAccessToken("nope", "secret")).toBe(false);
    expect(isValidMcpAccessToken(null, "secret")).toBe(false);
    expect(isValidMcpAccessToken("secret", undefined)).toBe(false);
    expect(isValidMcpAccessToken("secret", "")).toBe(false);
  });
});

describe("isMcpRequestAuthorized", () => {
  it("allows Clerk sessions through without a token", () => {
    const request = new Request("http://localhost/api/mcp/sse");
    expect(isMcpRequestAuthorized("user_123", request, "secret")).toBe(true);
  });

  it("requires the bearer token for external clients", () => {
    const authorized = new Request("http://localhost/api/mcp/sse", {
      headers: { authorization: "Bearer secret" },
    });
    expect(isMcpRequestAuthorized(null, authorized, "secret")).toBe(true);

    const wrong = new Request("http://localhost/api/mcp/sse", {
      headers: { authorization: "Bearer nope" },
    });
    expect(isMcpRequestAuthorized(null, wrong, "secret")).toBe(false);

    const missing = new Request("http://localhost/api/mcp/sse");
    expect(isMcpRequestAuthorized(null, missing, "secret")).toBe(false);
    expect(isMcpRequestAuthorized(null, authorized, undefined)).toBe(false);
  });
});

describe("AgentStudioMcpServer tool registration", () => {
  it("exposes each published workflow as a run_skill_* tool with merged input schema", async () => {
    const server = new AgentStudioMcpServer(makeAgentServerDeps({ rows: [makePublishedRow()] }));
    const tools = await server.listExposedSkillTools();

    expect(tools).toHaveLength(1);
    const tool = tools[0];
    // Naming: slugified name + short skill id suffix (collision-free).
    expect(tool.name).toBe("run_skill_customer_refund_workflow_s1");

    // userId is merged into the schema and required.
    expect(tool.inputSchema.type).toBe("object");
    const properties = tool.inputSchema.properties as Record<string, unknown>;
    expect(properties.userId).toMatchObject({ type: "string" });
    expect(properties.customerName).toBeDefined();
    expect(tool.inputSchema.required).toEqual(["userId", "customerName"]);

    // Description carries the purpose + allowed tools.
    expect(tool.description).toContain("Bounded refund automation");
    expect(tool.description).toContain("ai_extraction");
  });

  it("registers no tools when there are no published workflows", async () => {
    const server = new AgentStudioMcpServer(makeAgentServerDeps({ rows: [] }));
    expect(await server.listExposedSkillTools()).toEqual([]);
  });

  it("registers distinct tools for same-named skills (id suffix disambiguates)", async () => {
    const rowA = makePublishedRow({ id: "v1", skill: { id: "saaaaaaaaaa1", name: "Refund", purpose: "A", userId: "u1" } });
    const rowB = makePublishedRow({ id: "v2", skillId: "s2", skill: { id: "sbbbbbbbbb2", name: "Refund", purpose: "B", userId: "u2" } });
    const server = new AgentStudioMcpServer(makeAgentServerDeps({ rows: [rowA, rowB] }));
    const tools = await server.listExposedSkillTools();

    expect(tools).toHaveLength(2);
    expect(new Set(tools.map((t) => t.name)).size).toBe(2);
  });
});

describe("AgentStudioMcpServer tool handlers (run_skill_*)", () => {
  it("executes the workflow with the userId stripped from the input payload", async () => {
    const { startExecution, findByIdForUser, ...deps } = makeDeps();
    const server = new AgentStudioMcpServer(deps);
    const { client, close } = await connectClient(server);
    serversToClose.push({ close });

    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual(["run_skill_customer_refund_workflow_s1"]);
    // The registered schema advertises userId + the skill's own fields.
    const schema = tools.tools[0].inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    expect(schema.properties?.userId).toBeDefined();
    expect(schema.required).toContain("userId");

    const result = await client.callTool({
      name: "run_skill_customer_refund_workflow_s1",
      arguments: { userId: "u1", customerName: "Alice" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: "text"; text: string }[])[0].text;
    const payload = JSON.parse(text);
    expect(payload.executionId).toBe("exec-1");
    expect(payload.status).toBe("COMPLETED");
    expect(payload.finalOutput).toEqual({ results: { step_1: "ok" } });
    // The workflow ran under the caller's account with userId NOT leaked into inputData.
    expect(startExecution).toHaveBeenCalledWith({
      userId: "u1",
      skillVersionId: "v1",
      inputData: { customerName: "Alice" },
    });
    expect(findByIdForUser).toHaveBeenCalledWith("s1", "u1");
  });

  it("rejects calls without a userId (schema-level validation)", async () => {
    const server = new AgentStudioMcpServer(makeDeps());
    const { client, close } = await connectClient(server);
    serversToClose.push({ close });

    // userId is a required property of the advertised schema, so the SDK
    // returns an error result (isError) naming the missing field.
    const result = await client.callTool({
      name: "run_skill_customer_refund_workflow_s1",
      arguments: { customerName: "Alice" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: "text"; text: string }[])[0].text;
    expect(text).toMatch(/userId/);
  });

  it("rejects workflows the caller does not own", async () => {
    const server = new AgentStudioMcpServer(
      makeDeps({
        findByIdForUser: vi.fn(async () => null),
      })
    );
    const { client, close } = await connectClient(server);
    serversToClose.push({ close });

    const result = await client.callTool({
      name: "run_skill_customer_refund_workflow_s1",
      arguments: { userId: "intruder", customerName: "Alice" },
    });
    expect(result.isError).toBe(true);
    const payload = JSON.parse((result.content as { type: "text"; text: string }[])[0].text);
    expect(payload.error).toMatch(/not available/);
  });

  it("surfaces HITL pauses so external agents know the run is parked", async () => {
    const startExecution = vi.fn(async () => makeExecution("PAUSED_FOR_APPROVAL"));
    const server = new AgentStudioMcpServer(
      makeDeps({ startExecution })
    );
    const { client, close } = await connectClient(server);
    serversToClose.push({ close });

    const result = await client.callTool({
      name: "run_skill_customer_refund_workflow_s1",
      arguments: { userId: "u1", customerName: "Alice" },
    });
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse((result.content as { type: "text"; text: string }[])[0].text);
    expect(payload.status).toBe("PAUSED_FOR_APPROVAL");
    expect(payload.approvalRequired).toBe(true);
  });

  it("returns an error result when the execution service fails", async () => {
    const startExecution = vi.fn(async () => {
      throw new Error("planner unavailable");
    });
    const server = new AgentStudioMcpServer(makeDeps({ startExecution }));
    const { client, close } = await connectClient(server);
    serversToClose.push({ close });

    const result = await client.callTool({
      name: "run_skill_customer_refund_workflow_s1",
      arguments: { userId: "u1", customerName: "Alice" },
    });
    expect(result.isError).toBe(true);
    const payload = JSON.parse((result.content as { type: "text"; text: string }[])[0].text);
    expect(payload.error).toMatch(/planner unavailable/);
  });
});

describe("AgentStudioMcpServer session routing", () => {
  it("returns 404 for messages with an unknown session id", async () => {
    const server = new AgentStudioMcpServer(makeAgentServerDeps({ rows: [] }));
    const response = await server.handleMessageRequest(
      new Request("http://localhost/api/mcp/messages", {
        method: "POST",
        headers: { "mcp-session-id": "does-not-exist", "content-type": "application/json" },
        body: "{}",
      })
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toMatch(/Unknown MCP session/);
  });

  it("initializes a session from /api/mcp/messages and serves the SSE stream on /api/mcp/sse", async () => {
    const server = new AgentStudioMcpServer(makeAgentServerDeps({ rows: [makePublishedRow()] }));

    // 1. A bare GET before initialization has no session to attach to.
    const preInit = await server.handleSseRequest(
      new Request("http://localhost/api/mcp/sse", {
        method: "GET",
        headers: { accept: "text/event-stream" },
      })
    );
    expect(preInit.status).toBe(404);

    // 2. POST initialize creates the session and returns its id.
    const initialized = await server.handleMessageRequest(
      new Request("http://localhost/api/mcp/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "unit-test", version: "1.0.0" },
          },
        }),
      })
    );
    expect(initialized.status).toBe(200);
    const initBody = (await readSseJson(initialized)) as { result?: { serverInfo?: { name?: string } } };
    expect(initBody.result?.serverInfo?.name).toBe("agent-studio");
    const sessionId = initialized.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    // 3. GET with the session id opens the SSE stream.
    const stream = await server.handleSseRequest(
      new Request("http://localhost/api/mcp/sse", {
        method: "GET",
        headers: { accept: "text/event-stream", "mcp-session-id": sessionId! },
      })
    );
    expect(stream.status).toBe(200);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");

    // 4. A non-initialize message is routed to the session.
    const listed = await server.handleMessageRequest(
      new Request("http://localhost/api/mcp/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId!,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      })
    );
    expect(listed.status).toBe(200);
    const listBody = (await readSseJson(listed)) as { result?: { tools?: { name: string }[] } };
    expect(listBody.result?.tools?.map((t) => t.name)).toEqual(["run_skill_customer_refund_workflow_s1"]);

    // 5. Tear the stream down so the session registry + timers are released.
    await stream.body?.cancel?.().catch(() => {});
  });

  it("rejects non-initialize messages that have no session", async () => {
    const server = new AgentStudioMcpServer(makeAgentServerDeps({ rows: [] }));
    const response = await server.handleMessageRequest(
      new Request("http://localhost/api/mcp/messages", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      })
    );
    expect(response.status).toBe(404);
  });
});
