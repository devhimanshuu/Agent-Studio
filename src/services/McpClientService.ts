import { IMcpServerRepository } from "@/repositories/interfaces/IMcpServerRepository";
import { IMcpClientService } from "./interfaces/IMcpClientService";
import {
  CreateMcpServerInput,
  McpHealth,
  McpProgressEvent,
  McpSamplingRequest,
  McpSamplingResult,
  McpServerDTO,
  McpToolTestResult,
  UpdateMcpServerInput,
} from "@/types/mcp";
import { McpConnection, CircuitBreaker, createMcpTool } from "@/modules/mcp";
import { McpRpcClient } from "@/modules/mcp/toolAdapter";
import { Tool, ToolRegistry } from "@/modules/tools";
import { logger } from "@/lib/logger";

/**
 * MCP Client Hub — manages connections to remote (SSE/HTTP) and local (stdio)
 * MCP servers, discovers their tools via `tools/list`, caches validated tool
 * definitions, and exposes them as standard `ITool`s registered into the Agent
 * Runtime's ToolRegistry.
 *
 * Connections + circuit breakers are cached in-process per server id. Tool
 * execution against a cached server lazily (re)connects on first use, so a
 * server that was disconnected between runs still works when a skill calls one
 * of its tools.
 */
export class McpClientService implements IMcpClientService {
  private connections = new Map<string, McpConnection>();
  private breakers = new Map<string, CircuitBreaker>();

  constructor(private mcpRepo: IMcpServerRepository) {}

  async listServers(userId: string): Promise<McpServerDTO[]> {
    return this.mcpRepo.findByUserId(userId);
  }

  async getServer(serverId: string, userId: string): Promise<McpServerDTO | null> {
    return this.mcpRepo.findByIdForUser(serverId, userId);
  }

  async createServer(input: CreateMcpServerInput): Promise<McpServerDTO> {
    const server = await this.mcpRepo.create(input);
    if (input.connectOnCreate !== false) {
      try {
        await this.connect(server.id, server.userId);
      } catch (error) {
        // Row persists with an ERROR status so the UI can show the failure.
        logger.warn(
          { serverId: server.id, error: errorMessage(error) },
          "MCP server created but initial connect failed"
        );
        await this.mcpRepo.updateStatus(server.id, "ERROR", errorMessage(error)).catch(() => {});
      }
      return (await this.mcpRepo.findById(server.id)) ?? server;
    }
    return server;
  }

  async updateServer(serverId: string, userId: string, input: UpdateMcpServerInput): Promise<McpServerDTO> {
    // A config change invalidates any live connection + cached circuit state.
    await this.disconnect(serverId, userId).catch(() => {});
    const updated = await this.mcpRepo.update(serverId, userId, input);
    return updated;
  }

  async deleteServer(serverId: string, userId: string): Promise<void> {
    await this.disconnect(serverId, userId).catch(() => {});
    await this.mcpRepo.delete(serverId, userId);
  }

  async connect(serverId: string, userId: string): Promise<McpServerDTO> {
    const server = await this.requireServer(serverId, userId);
    const connection = this.getConnection(server);

    try {
      await connection.connect();
      const tools = await connection.discoverTools();
      const updated = await this.mcpRepo.updateCachedTools(serverId, tools);
      this.breakerFor(serverId).reset();
      logger.info(
        { serverId, name: server.name, toolCount: tools.length },
        "MCP server connected and tools discovered"
      );
      return updated;
    } catch (error) {
      const message = errorMessage(error);
      await connection.close().catch(() => {});
      this.connections.delete(serverId);
      this.breakerFor(serverId).trip();
      await this.mcpRepo.updateStatus(serverId, "ERROR", message).catch(() => {});
      throw new Error(`Failed to connect to MCP server "${server.name}": ${message}`);
    }
  }

  async reconnect(serverId: string, userId: string): Promise<McpServerDTO> {
    await this.disconnect(serverId, userId).catch(() => {});
    return this.connect(serverId, userId);
  }

  async disconnect(serverId: string, userId: string): Promise<McpServerDTO> {
    // Ownership-scoped — throws when the server belongs to someone else.
    await this.requireServer(serverId, userId);
    const connection = this.connections.get(serverId);
    if (connection) {
      await connection.close().catch(() => {});
      this.connections.delete(serverId);
    }
    const updated = await this.mcpRepo.updateStatus(serverId, "DISCONNECTED");
    return updated;
  }

  /** Re-run `tools/list` on a live connection and refresh the cache. */
  async rediscoverTools(serverId: string, userId: string): Promise<McpServerDTO> {
    const server = await this.requireServer(serverId, userId);
    const connection = this.getConnection(server);
    try {
      if (!connection.isConnected) await connection.connect();
      const tools = await connection.discoverTools();
      return this.mcpRepo.updateCachedTools(serverId, tools);
    } catch (error) {
      const message = errorMessage(error);
      this.breakerFor(serverId).trip();
      await this.mcpRepo.updateStatus(serverId, "ERROR", message).catch(() => {});
      throw new Error(`Tool discovery failed for "${server.name}": ${message}`);
    }
  }

  async healthCheck(serverId: string, userId: string): Promise<McpHealth> {
    const server = await this.requireServer(serverId, userId);
    const breaker = this.breakerFor(serverId);
    const startedAt = Date.now();
    try {
      if (breaker.state === "OPEN") {
        return {
          serverId,
          status: "unavailable",
          latencyMs: Date.now() - startedAt,
          message: "Circuit open — server recently failed",
          toolCount: server.cachedTools.length,
        };
      }
      const connection = this.getConnection(server);
      if (!connection.isConnected) {
        // Try to establish a live connection for the probe.
        await connection.connect();
      }
      const latencyMs = await breaker.run(() => connection.ping());
      return {
        serverId,
        status: latencyMs <= 5_000 ? "healthy" : "degraded",
        latencyMs,
        message: latencyMs <= 5_000 ? undefined : `High latency (${latencyMs}ms)`,
        toolCount: server.cachedTools.length,
      };
    } catch (error) {
      breaker.recordFailure();
      return {
        serverId,
        status: "unavailable",
        latencyMs: Date.now() - startedAt,
        message: errorMessage(error),
        toolCount: server.cachedTools.length,
      };
    }
  }

  /** Live-execute a discovered MCP tool from the hub (never throws). */
  async testTool(
    serverId: string,
    userId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<McpToolTestResult> {
    const startedAt = Date.now();
    try {
      const server = await this.requireServer(serverId, userId);
      const tool = server.cachedTools.find((t) => t.name === toolName);
      if (!tool) {
        return {
          ok: false,
          toolName,
          serverId,
          durationMs: Date.now() - startedAt,
          error: `Tool "${toolName}" is not in the cached tool list for this server — rediscover tools first`,
        };
      }
      const connection = this.getConnection(server);
      if (!connection.isConnected) await connection.connect();
      const breaker = this.breakerFor(serverId);
      const output = await breaker.run(() => connection.callTool(toolName, args));
      return { ok: true, toolName, serverId, durationMs: Date.now() - startedAt, output };
    } catch (error) {
      this.breakerFor(serverId).recordFailure();
      return {
        ok: false,
        toolName,
        serverId,
        durationMs: Date.now() - startedAt,
        error: errorMessage(error),
      };
    }
  }

  async listResources(serverId: string, userId: string): Promise<any[]> {
    const server = await this.requireServer(serverId, userId);
    const connection = this.getConnection(server);
    if (!connection.isConnected) await connection.connect();
    return connection.listResources();
  }

  async readResource(serverId: string, userId: string, uri: string): Promise<any> {
    const server = await this.requireServer(serverId, userId);
    const connection = this.getConnection(server);
    if (!connection.isConnected) await connection.connect();
    return connection.readResource(uri);
  }

  async listPrompts(serverId: string, userId: string): Promise<any[]> {
    const server = await this.requireServer(serverId, userId);
    const connection = this.getConnection(server);
    if (!connection.isConnected) await connection.connect();
    return connection.listPrompts();
  }

  async getPrompt(serverId: string, userId: string, promptName: string, args?: Record<string, string>): Promise<any> {
    const server = await this.requireServer(serverId, userId);
    const connection = this.getConnection(server);
    if (!connection.isConnected) await connection.connect();
    return connection.getPrompt(promptName, args);
  }

  async getMetrics(serverId: string, userId: string): Promise<any> {
    const server = await this.requireServer(serverId, userId);
    const breaker = this.breakerFor(serverId);
    return {
      serverId: server.id,
      name: server.name,
      status: server.status,
      cachedToolCount: server.cachedTools.length,
      circuit: breaker.stats,
      updatedAt: server.updatedAt,
    };
  }

  /**
   * Subscribe to progress events from a connected MCP server's tool calls.
   * Returns an unsubscribe function.
   */
  onProgress(serverId: string, userId: string, listener: (event: McpProgressEvent) => void): () => void {
    const server = this.connections.get(serverId);
    if (!server) return () => {};
    return server.onProgress(listener);
  }

  /**
   * Handle a sampling/createMessage request from a connected MCP server.
   * This proxies the request to Agent Studio's LLM engine. For now, it
   * returns a structured response indicating the request was received.
   * In production, this would call the user's configured LLM provider.
   */
  async handleSamplingRequest(
    serverId: string,
    userId: string,
    params: Record<string, unknown>
  ): Promise<McpSamplingResult> {
    const server = await this.requireServer(serverId, userId);
    const request = params as unknown as McpSamplingRequest;

    logger.info(
      { serverId, userId, model: request.modelPreferences?.hints?.[0]?.name, messageCount: request.messages?.length },
      "Processing MCP sampling request"
    );

    // Build the sampling response. In a full implementation, this would
    // route to the user's configured LLM provider (OpenAI, Anthropic, etc).
    // For now, we return a structured result that acknowledges the request.
    const messages = request.messages ?? [];
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    const userContent = lastUserMessage?.content?.text ?? "";

    return {
      model: request.modelPreferences?.hints?.[0]?.name ?? "agent-studio-default",
      role: "assistant",
      content: {
        type: "text",
        text: `[Agent Studio Sampling] Received request from MCP server "${server.name}". ${request.systemPrompt ? `System: ${request.systemPrompt.slice(0, 100)}...` : ""} User content: ${userContent.slice(0, 200)}`,
      },
      stopReason: "end_turn",
    };
  }

  /**
   * Sync a user's cached MCP tools into a ToolRegistry as standard `ITool`s.
   * Called by the execution runtime before a run so skills can call MCP tools
   * by their registry name (`mcp_<serverId>_<toolName>`) inside allowedTools.
   * Idempotent: re-syncing replaces tools by name.
   */
  async registerUserMcpTools(userId: string, registry: ToolRegistry): Promise<Tool[]> {
    const servers = await this.mcpRepo.findByUserId(userId);
    const tools: Tool[] = [];
    for (const server of servers) {
      if (server.cachedTools.length === 0) continue;
      for (const definition of server.cachedTools) {
        const rpc = this.lazyRpcFor(server);
        tools.push(createMcpTool(definition, rpc, { serverId: server.id, serverName: server.name }));
      }
    }
    registry.syncTools(tools);
    return tools;
  }

  /** Build a ToolRegistry containing built-ins + the user's cached MCP tools. */
  async buildUserRegistry(userId: string, base: ToolRegistry): Promise<ToolRegistry> {
    await this.registerUserMcpTools(userId, base);
    return base;
  }

  /** RPC client that lazily (re)connects on first call, guarded by the breaker. */
  private lazyRpcFor(server: McpServerDTO): McpRpcClient {
    const breaker = this.breakerFor(server.id);
    // Closure resolves the connection map through `this` without aliasing it.
    const connectionFor = (): McpConnection => this.getConnection(server);
    const ensureConnected = async (): Promise<McpConnection> => {
      const connection = connectionFor();
      if (!connection.isConnected) await connection.connect();
      return connection;
    };
    return {
      async callTool(name: string, args: Record<string, unknown>) {
        const connection = await ensureConnected();
        return breaker.run(() => connection.callTool(name, args));
      },
      async ping() {
        const connection = await ensureConnected();
        return breaker.run(() => connection.ping());
      },
    };
  }

  private getConnection(server: McpServerDTO): McpConnection {
    let connection = this.connections.get(server.id);
    if (!connection) {
      connection = new McpConnection(server);
      this.connections.set(server.id, connection);
    }
    return connection;
  }

  private breakerFor(serverId: string): CircuitBreaker {
    let breaker = this.breakers.get(serverId);
    if (!breaker) {
      breaker = new CircuitBreaker(serverId);
      this.breakers.set(serverId, breaker);
    }
    return breaker;
  }

  private async requireServer(serverId: string, userId: string): Promise<McpServerDTO> {
    const server = await this.mcpRepo.findByIdForUser(serverId, userId);
    if (!server) {
      throw new Error("MCP server not found or you do not have access to it");
    }
    return server;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown MCP failure";
}
