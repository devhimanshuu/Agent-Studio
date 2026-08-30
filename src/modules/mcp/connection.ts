import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CreateMessageRequestSchema, CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { McpServerDTO, McpProgressEvent } from "@/types/mcp";
import { logger } from "@/lib/logger";
import { McpRpcClient } from "./toolAdapter";
import { mapToolsList } from "./protocol";

export interface McpConnectionOptions {
  /** Wall-clock budget for the initialize handshake. Default 15s. */
  connectTimeoutMs?: number;
  /** Wall-clock budget for tool calls. Default 15s. */
  callTimeoutMs?: number;
  /** Handler invoked when the connected server requests LLM sampling. */
  onSamplingRequest?: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 45_000;
const DEFAULT_CALL_TIMEOUT_MS = 30_000;

/**
 * A live MCP client connection. Owns the SDK `Client` + transport for one
 * server and exposes the minimal RPC surface the tool adapter needs. The
 * transport is chosen by stored config: stdio for local commands, and for
 * remote endpoints Streamable HTTP first with a legacy SSE fallback.
 *
 * Declares sampling capability so connected MCP servers can request LLM
 * completions back from Agent Studio's engine (nested agentic behavior).
 *
 * NOTE: `Client.connect()` calls `transport.start()` itself, so the transport
 * must NOT be pre-started — doing so makes the SDK throw "already started".
 */
export class McpConnection implements McpRpcClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport | null = null;
  private progressListeners = new Set<(event: McpProgressEvent) => void>();

  constructor(
    private readonly server: McpServerDTO,
    private readonly options: McpConnectionOptions = {}
  ) {}

  get isConnected(): boolean {
    return this.client !== null;
  }

  /** Subscribe to progress events emitted during tool/resource/prompt calls. */
  onProgress(listener: (event: McpProgressEvent) => void): () => void {
    this.progressListeners.add(listener);
    return () => { this.progressListeners.delete(listener); };
  }

  private emitProgress(event: Omit<McpProgressEvent, "timestamp">): void {
    const fullEvent: McpProgressEvent = { ...event, timestamp: Date.now() };
    for (const listener of this.progressListeners) {
      try { listener(fullEvent); } catch { /* best-effort */ }
    }
  }

  /** Establish the transport + initialize handshake. Throws on failure. */
  async connect(): Promise<void> {
    if (this.client) return;
    const timeoutMs = this.options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;

    if (this.server.transport === "STDIO") {
      await this.connectWith(this.buildStdioTransport(), timeoutMs, "stdio");
      return;
    }

    // Remote endpoints: Streamable HTTP first, legacy SSE as a fallback for
    // older servers that only support the split SSE transport.
    try {
      await this.connectWith(this.buildStreamableTransport(), timeoutMs, "streamable-http");
    } catch (streamableError) {
      logger.warn(
        { serverId: this.server.id, endpoint: this.server.endpointUrl, error: messageOf(streamableError) },
        "Streamable HTTP connect failed — falling back to legacy SSE"
      );
      await this.connectWith(this.buildSseTransport(), timeoutMs, "sse");
    }
  }

  /** Query tools/list and return validated, normalized definitions. */
  async discoverTools(): Promise<ReturnType<typeof mapToolsList>> {
    this.assertConnected();
    const result = await this.callWithTimeout(() => this.client!.listTools(), "listTools");
    return mapToolsList(result);
  }

  /** Query resources/list exposed by the remote MCP server. */
  async listResources(): Promise<unknown[]> {
    this.assertConnected();
    const result = await this.callWithTimeout(() => this.client!.listResources(), "listResources");
    return (result as { resources?: unknown[] })?.resources ?? [];
  }

  /** Read a specific resource by URI. */
  async readResource(uri: string): Promise<unknown> {
    this.assertConnected();
    const result = await this.callWithTimeout(() => this.client!.readResource({ uri }), `readResource(${uri})`);
    return result;
  }

  /** Query prompts/list exposed by the remote MCP server. */
  async listPrompts(): Promise<unknown[]> {
    this.assertConnected();
    const result = await this.callWithTimeout(() => this.client!.listPrompts(), "listPrompts");
    return (result as { prompts?: unknown[] })?.prompts ?? [];
  }

  /** Fetch a prompt template by name with arguments. */
  async getPrompt(name: string, args?: Record<string, string>): Promise<unknown> {
    this.assertConnected();
    const result = await this.callWithTimeout(
      () => this.client!.getPrompt({ name, arguments: args }),
      `getPrompt(${name})`
    );
    return result;
  }

  /** Invoke a tool by server-local name with a wall-clock budget. */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.assertConnected();
    this.emitProgress({ type: "started", operation: "callTool", detail: name });
    try {
      const result = await this.callWithTimeout(
        () => this.client!.callTool({ name, arguments: args }),
        `callTool(${name})`
      );
      this.emitProgress({ type: "completed", operation: "callTool", detail: name });
      return result;
    } catch (error) {
      this.emitProgress({ type: "failed", operation: "callTool", detail: name, error: messageOf(error) });
      throw error;
    }
  }

  /** Round-trip liveness probe — resolves to latency in ms. */
  async ping(): Promise<number> {
    this.assertConnected();
    const startedAt = Date.now();
    await this.callWithTimeout(() => this.client!.ping(), "ping");
    return Date.now() - startedAt;
  }

  async close(): Promise<void> {
    const client = this.client;
    const transport = this.transport;
    this.client = null;
    this.transport = null;
    await client?.close().catch(() => {});
    await transport?.close().catch(() => {});
  }

  /**
   * Run the initialize handshake over one transport; clean up on failure.
   * Declares sampling capability so servers can request LLM completions.
   */
  private async connectWith(
    transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport,
    timeoutMs: number,
    label: string
  ): Promise<void> {
    const client = new Client(
      { name: "agent-studio", version: "1.0.0" },
      {
        capabilities: {
          sampling: {},
        },
      }
    );

    // Register a handler for sampling/createMessage requests from the server.
    // When a connected MCP server needs an LLM completion, it sends this
    // request to Agent Studio, which can proxy it to its configured LLM.
    if (this.options.onSamplingRequest) {
      const handler = this.options.onSamplingRequest;
      client.setRequestHandler(CreateMessageRequestSchema, async (request) => {
        logger.info(
          { serverId: this.server.id, serverName: this.server.name },
          "Received sampling/createMessage request from MCP server"
        );
        const result = await handler(request.params as unknown as Record<string, unknown>);
        return CreateMessageResultSchema.parse(result);
      });
    }

    try {
      await withTimeout(client.connect(transport), timeoutMs, `initialize (${label})`);
    } catch (error) {
      await transport.close().catch(() => {});
      throw error;
    }
    this.transport = transport;
    this.client = client;
    logger.info(
      { serverId: this.server.id, name: this.server.name, transport: label, sampling: Boolean(this.options.onSamplingRequest) },
      "MCP connection established"
    );
  }

  private assertConnected(): void {
    if (!this.client || !this.transport) {
      throw new Error(`MCP server "${this.server.name}" is not connected`);
    }
  }

  private callWithTimeout<T>(fn: () => Promise<T>, label: string): Promise<T> {
    const timeoutMs = this.options.callTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
    return withTimeout(fn(), timeoutMs, `${this.server.name}.${label}`);
  }

  private buildStdioTransport(): StdioClientTransport {
    const commandLine = this.server.command ?? "";
    const { command, args } = parseCommandLine(commandLine);
    if (!command) {
      throw new Error(`STDIO MCP server "${this.server.name}" has no command configured`);
    }
    // On Windows, resolve standard CLI executables (e.g. npx -> npx.cmd) so child_process.spawn works
    let resolvedCommand = command;
    if (typeof process !== "undefined" && process.platform === "win32") {
      const lower = command.toLowerCase();
      if (
        (lower === "npx" || lower === "npm" || lower === "pnpm" || lower === "yarn" || lower === "uvx") &&
        !lower.endsWith(".cmd") &&
        !lower.endsWith(".exe")
      ) {
        resolvedCommand = `${command}.cmd`;
      }
    }

    // Build environment variables: inherit process.env + inject server.headers and auth tokens
    const env: Record<string, string> = {
      ...(typeof process !== "undefined" && process.env ? (process.env as Record<string, string>) : {}),
    };
    if (this.server.headers) {
      for (const [key, value] of Object.entries(this.server.headers)) {
        if (typeof value === "string" && value.trim()) {
          const val = value.trim();
          // Preset-originated headers are already keyed by the exact env var name
          // the target package expects (e.g. "NOTION_API_KEY") — see
          // McpServerHub.tsx's buildAuthHeaders. Only a generic "Authorization"
          // header (custom/manual servers with no preset metadata) needs a
          // fallback, and only to genuinely provider-agnostic names — never
          // guessed into a specific third-party provider's secret env var.
          env[key] = val;
          if (key.toLowerCase() === "authorization") {
            const token = val.replace(/^bearer\s+/i, "");
            env["AUTH_TOKEN"] = token;
            env["BEARER_TOKEN"] = token;
            env["API_KEY"] = token;
          }
        }
      }
    }

    return new StdioClientTransport({ command: resolvedCommand, args, env });
  }

  private buildStreamableTransport(): StreamableHTTPClientTransport {
    const url = this.requireEndpointUrl();
    const headers = this.server.headers ?? undefined;
    return new StreamableHTTPClientTransport(url, {
      ...(headers ? { requestInit: { headers } } : {}),
      // Auto-reconnect with exponential backoff so transient network blips
      // don't drop the SSE stream (mirrors fetch-event-source behavior).
      reconnectionOptions: {
        initialReconnectionDelay: 1_000,
        maxReconnectionDelay: 15_000,
        reconnectionDelayGrowFactor: 1.5,
        maxRetries: 5,
      },
    });
  }

  private buildSseTransport(): SSEClientTransport {
    const url = this.requireEndpointUrl();
    const headers = this.server.headers ?? undefined;
    return new SSEClientTransport(url, {
      ...(headers ? { requestInit: { headers } } : {}),
    });
  }

  private requireEndpointUrl(): URL {
    const endpoint = this.server.endpointUrl;
    if (!endpoint) {
      throw new Error(`SSE MCP server "${this.server.name}" has no endpoint URL configured`);
    }
    return new URL(endpoint);
  }
}

/** Parse a command line string into command + args (quote-aware). */
function parseCommandLine(commandLine: string): { command: string; args: string[] } {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < commandLine.length; i += 1) {
    const char = commandLine[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === " " || char === "\t") {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current.length > 0) tokens.push(current);
  const [command, ...args] = tokens;
  return { command: command ?? "", args };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`MCP ${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        clearTimeout(timer);
        reject(reason instanceof Error ? reason : new Error(String(reason)));
      }
    );
  });
}
