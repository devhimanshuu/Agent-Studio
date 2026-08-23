import { describe, it, expect, beforeEach } from "vitest";
import { McpClientService } from "@/services/McpClientService";
import { IMcpServerRepository } from "@/repositories/interfaces/IMcpServerRepository";
import {
  CreateMcpServerInput,
  McpServerDTO,
  McpServerStatus,
  UpdateMcpServerInput,
} from "@/types/mcp";

class MockMcpRepo implements IMcpServerRepository {
  async getRawHeadersForUser(id: string, userId: string): Promise<Record<string, string> | null> {
    const row = this.rows.find((r) => r.id === id && r.userId === userId);
    return row?.headers ?? null;
  }
  public rows: McpServerDTO[] = [];

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
  async update(id: string, userId: string, input: UpdateMcpServerInput): Promise<McpServerDTO> {
    const row = await this.findByIdForUser(id, userId);
    if (!row) throw new Error("not found");
    if (input.name) row.name = input.name;
    if (input.endpointUrl !== undefined) row.endpointUrl = input.endpointUrl;
    if (input.command !== undefined) row.command = input.command;
    if (input.headers !== undefined) row.headers = input.headers;
    return row;
  }
  async delete(id: string, userId: string) {
    this.rows = this.rows.filter((r) => !(r.id === id && r.userId === userId));
  }
  async updateStatus(id: string, status: McpServerStatus, error?: string | null): Promise<McpServerDTO> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error("not found");
    row.status = status;
    row.lastError = error ?? null;
    return row;
  }
  async updateCachedTools(id: string, tools: McpServerDTO["cachedTools"]): Promise<McpServerDTO> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error("not found");
    row.cachedTools = tools;
    return row;
  }
}

describe("MCP Export / Import & Batch Operations", () => {
  let repo: MockMcpRepo;
  let service: McpClientService;

  beforeEach(() => {
    repo = new MockMcpRepo();
    service = new McpClientService(repo);
  });

  it("exports all servers for a user into a portable bundle", async () => {
    await service.createServer({
      userId: "user-1",
      name: "GitHub Copilot MCP",
      transport: "SSE",
      endpointUrl: "https://api.githubcopilot.com/mcp/",
      headers: { Authorization: "Bearer ghp_token" },
      connectOnCreate: false,
    });
    await service.createServer({
      userId: "user-1",
      name: "Playwright Browser MCP",
      transport: "STDIO",
      command: "npx -y @playwright/mcp@latest",
      connectOnCreate: false,
    });

    const user1Servers = await service.listServers("user-1");
    expect(user1Servers).toHaveLength(2);

    const exportBundle = {
      version: "1.0",
      servers: user1Servers.map((s) => ({
        name: s.name,
        transport: s.transport,
        endpointUrl: s.endpointUrl,
        command: s.command,
        headers: s.headers,
      })),
    };

    expect(exportBundle.servers).toHaveLength(2);
    expect(exportBundle.servers[0].name).toBe("GitHub Copilot MCP");
    expect(exportBundle.servers[1].command).toBe("npx -y @playwright/mcp@latest");
  });

  it("imports server configurations in batch", async () => {
    const importPayload = [
      {
        name: "Notion MCP",
        transport: "STDIO" as const,
        command: "npx -y @notionhq/notion-mcp-server",
        headers: { Authorization: "Bearer secret_notion" },
        connectOnCreate: false,
      },
      {
        name: "Sequential Thinking MCP",
        transport: "STDIO" as const,
        command: "npx -y @modelcontextprotocol/server-sequential-thinking",
        connectOnCreate: false,
      },
    ];

    for (const item of importPayload) {
      await service.createServer({
        userId: "user-2",
        ...item,
      });
    }

    const imported = await service.listServers("user-2");
    expect(imported).toHaveLength(2);
    expect(imported.map((s) => s.name)).toEqual(["Notion MCP", "Sequential Thinking MCP"]);
  });

  it("disconnects multiple servers in batch gracefully", async () => {
    const s1 = await service.createServer({
      userId: "user-1",
      name: "S1",
      transport: "STDIO",
      command: "npx -y @modelcontextprotocol/server-time",
      connectOnCreate: false,
    });
    const s2 = await service.createServer({
      userId: "user-1",
      name: "S2",
      transport: "STDIO",
      command: "npx -y @modelcontextprotocol/server-fetch",
      connectOnCreate: false,
    });

    const updated1 = await service.disconnect(s1.id, "user-1");
    const updated2 = await service.disconnect(s2.id, "user-1");

    expect(updated1.status).toBe("DISCONNECTED");
    expect(updated2.status).toBe("DISCONNECTED");
  });
});
