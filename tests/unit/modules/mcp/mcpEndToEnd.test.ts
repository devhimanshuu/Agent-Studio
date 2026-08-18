import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import type { SSEServerTransport as SseServerTransportType } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { McpClientService } from "@/services/McpClientService";
import { IMcpServerRepository } from "@/repositories/interfaces/IMcpServerRepository";
import { ToolRegistry } from "@/modules/tools";
import {
  CreateMcpServerInput,
  McpServerDTO,
  McpServerStatus,
  McpToolDefinition,
  UpdateMcpServerInput,
} from "@/types/mcp";

/** Minimal in-memory repo backing the service during the live test. */
class E2eMcpRepo implements IMcpServerRepository {
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
      id: `svc-${this.rows.length + 1}`,
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

interface TestServer {
  url: string;
  issueCount: () => number;
  close: () => Promise<void>;
}

/** Boot a REAL MCP server (SDK McpServer + Streamable HTTP) on an ephemeral port. */
async function startRealMcpServer(): Promise<TestServer> {
  const mcpServer = new McpServer({ name: "e2e-test-server", version: "1.0.0" }, { capabilities: { tools: {} } });

  let issues = 0;
  mcpServer.registerTool(
    "get_weather",
    {
      description: "Get the current temperature for a city",
      inputSchema: { city: z.string().describe("City name") },
    },
    async ({ city }) => ({
      content: [{ type: "text", text: JSON.stringify({ temperature: 21, city }) }],
    })
  );
  mcpServer.registerTool(
    "create_issue",
    {
      description: "Create an issue",
      inputSchema: { title: z.string() },
    },
    async ({ title }) => {
      issues += 1;
      return {
        content: [{ type: "text", text: JSON.stringify({ issue: { number: issues, title } }) }],
      };
    }
  );

  const transports = new Map<string, StreamableHTTPServerTransport>();
  const server = http.createServer(async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"];
      let transport = typeof sessionId === "string" ? transports.get(sessionId) : undefined;
      if (!transport) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports.set(sid, transport!);
          },
        });
        await mcpServer.connect(transport);
      }
      await transport.handleRequest(req, res);
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : "server error" }));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}/mcp`,
    issueCount: () => issues,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

const activeServers: TestServer[] = [];

afterEach(async () => {
  await Promise.all(activeServers.splice(0).map((s) => s.close().catch(() => {})));
});

describe("MCP end-to-end over real HTTP (SDK server → client stack)", () => {
  it("connects, discovers, registers, executes, health-checks, and live-tests tools", async () => {
    const testServer = await startRealMcpServer();
    activeServers.push(testServer);

    const repo = new E2eMcpRepo();
    repo.seed([
      {
        id: "svc_e2e",
        userId: "u1",
        name: "E2E Test Server",
        transport: "SSE",
        endpointUrl: testServer.url,
        status: "DISCONNECTED",
        cachedTools: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const service = new McpClientService(repo);

    // 1. Connect + auto-discover via tools/list over the wire.
    const connected = await service.connect("svc_e2e", "u1");
    expect(connected.status).toBe("CONNECTED");
    const names = connected.cachedTools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["get_weather", "create_issue"]));

    const weather = connected.cachedTools.find((t) => t.name === "get_weather")!;
    expect(weather.isWrite).toBe(false);
    expect(weather.requiresApproval).toBe(false);
    expect(weather.inputSchema).toMatchObject({ type: "object" });
    const issue = connected.cachedTools.find((t) => t.name === "create_issue")!;
    // No annotations on the server side → the name heuristic flags WRITE.
    expect(issue.isWrite).toBe(true);
    expect(issue.requiresApproval).toBe(true);

    // 2. Register into a ToolRegistry and execute a real round-trip.
    const registry = new ToolRegistry();
    await service.registerUserMcpTools("u1", registry);
    const weatherTool = registry.getTool("mcp_svc_e2e_get_weather")!;
    expect(weatherTool.requiresApproval).toBe(false);
    const output = await weatherTool.execute({ city: "Berlin" });
    expect(output).toEqual({ temperature: 21, city: "Berlin" });

    // 3. Live-test a write tool through the hub path.
    const liveTest = await service.testTool("svc_e2e", "u1", "create_issue", { title: "e2e bug" });
    expect(liveTest.ok).toBe(true);
    expect(testServer.issueCount()).toBe(1);

    // 4. Health probe over the live connection.
    const health = await service.healthCheck("svc_e2e", "u1");
    expect(health.status).toBe("healthy");
    expect(health.latencyMs).toBeTypeOf("number");
    expect(health.toolCount).toBe(2);

    // 5. Re-discovery returns the same tool set (idempotent over the wire).
    const rediscovered = await service.rediscoverTools("svc_e2e", "u1");
    expect(rediscovered.cachedTools.map((t) => t.name).sort()).toEqual(["create_issue", "get_weather"]);

    // 6. Disconnect tears the live connection down.
    const disconnected = await service.disconnect("svc_e2e", "u1");
    expect(disconnected.status).toBe("DISCONNECTED");
  });

  it("validates inputs client-side before hitting the server", async () => {
    const testServer = await startRealMcpServer();
    activeServers.push(testServer);

    const repo = new E2eMcpRepo();
    repo.seed([
      {
        id: "svc_e2e",
        userId: "u1",
        name: "E2E Test Server",
        transport: "SSE",
        endpointUrl: testServer.url,
        status: "DISCONNECTED",
        cachedTools: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const service = new McpClientService(repo);
    await service.connect("svc_e2e", "u1");

    const registry = new ToolRegistry();
    await service.registerUserMcpTools("u1", registry);
    const weatherTool = registry.getTool("mcp_svc_e2e_get_weather")!;

    // Missing required `city` — rejected locally with a clear issue list.
    const issues = weatherTool.validate({});
    expect(issues.some((i) => i.includes("city"))).toBe(true);
  });
});

describe("MCP legacy-SSE fallback path", () => {
  it("falls back to legacy SSE when Streamable HTTP is rejected", async () => {
    // A server that answers ONLY the legacy SSE contract: GET streams, POST
    // is the message endpoint. The streamable client's GET is answered with
    // the SSE stream but no JSON-RPC — so it times out and the client falls
    // back to the SSEClientTransport.
    const mcpServer = new McpServer({ name: "legacy-server", version: "1.0.0" }, { capabilities: { tools: {} } });
    mcpServer.registerTool(
      "legacy_echo",
      { description: "Echo", inputSchema: { value: z.string() } },
      async ({ value }) => ({ content: [{ type: "text", text: `echo:${value}` }] })
    );

    // Use the SDK's SSEServerTransport for a true legacy endpoint.
    const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");
    let sseTransport: SseServerTransportType | null = null;
    const server = http.createServer(async (req, res) => {
      if (req.method === "GET") {
        sseTransport = new SSEServerTransport("/mcp/messages", res);
        // connect() calls start() automatically — never call it again.
        await mcpServer.connect(sseTransport);
      } else if (req.method === "POST") {
        if (sseTransport) await sseTransport.handlePostMessage(req, res);
        else {
          res.statusCode = 400;
          res.end();
        }
      } else {
        res.statusCode = 405;
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;

    const repo = new E2eMcpRepo();
    repo.seed([
      {
        id: "svc_legacy",
        userId: "u1",
        name: "Legacy SSE Server",
        transport: "SSE",
        endpointUrl: `http://127.0.0.1:${port}/mcp/sse`,
        status: "DISCONNECTED",
        cachedTools: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const service = new McpClientService(repo);

    try {
      const connected = await service.connect("svc_legacy", "u1");
      expect(connected.status).toBe("CONNECTED");
      expect(connected.cachedTools.map((t) => t.name)).toContain("legacy_echo");

      const registry = new ToolRegistry();
      await service.registerUserMcpTools("u1", registry);
      const echoTool = registry.getTool("mcp_svc_legacy_legacy_echo")!;
      await expect(echoTool.execute({ value: "hi" })).resolves.toBe("echo:hi");
    } finally {
      await service.disconnect("svc_legacy", "u1").catch(() => {});
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 30_000);
});
