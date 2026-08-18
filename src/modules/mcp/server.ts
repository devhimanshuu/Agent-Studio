import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { SkillVersionDTO } from "@/types/skill";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { IExecutionService } from "@/services/interfaces/IExecutionService";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { jsonSchemaToZod } from "./toolAdapter";

const MCP_SERVER_NAME = "agent-studio";
const MCP_SERVER_VERSION = "1.0.0";

/** Module-level session registry so `/api/mcp/sse` GETs and `/api/mcp/messages`
 * POSTs route to the transport that owns each MCP session. A session is born
 * when a client POSTs `initialize`; the transport registers itself here via
 * `onsessioninitialized`, and later requests reuse it by session id. */
const sessions = new Map<string, { transport: WebStandardStreamableHTTPServerTransport; server: McpServer }>();

/** Create a fresh stateful transport wired into the session registry. */
function createSessionTransport(server: McpServer): WebStandardStreamableHTTPServerTransport {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { transport, server });
      // Release the session mapping when the client disconnects so stale
      // transports don't accumulate in the module-level registry.
      transport.onclose = () => {
        sessions.delete(sessionId);
        server.close().catch(() => {});
        logger.info({ sessionId }, "MCP session closed");
      };
      logger.info({ sessionId }, "MCP session initialized");
    },
  });
  return transport;
}

export interface AgentStudioMcpServerDeps {
  executionService: IExecutionService;
  skillRepo: ISkillRepository;
  /**
   * Source of published skill versions — injectable for tests. Defaults to a
   * query over all published skill versions joined with their skill.
   */
  listPublishedSkillVersions?: () => Promise<PublishedSkillVersionRow[]>;
}

/** A published skill version + its skill, as consumed by the MCP tool builder. */
export interface PublishedSkillVersionRow {
  id: string;
  skillId: string;
  versionNumber: number;
  status: string;
  inputSchema: unknown;
  outputSchema: unknown;
  instructions: string;
  examples: unknown;
  allowedTools: unknown;
  actionsRequiringApproval: unknown;
  maxExecutionSteps: number;
  graphDefinition: unknown;
  changelog: string | null;
  notes: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  skill: { id: string; name: string; purpose: string; userId: string };
}

/** A published skill/workflow exposed as a callable MCP tool. */
export interface ExposedSkillTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  version: SkillVersionDTO;
}

/**
 * Bidirectional MCP support: Agent Studio acts as an MCP *server* so external
 * agents (Cursor, Claude Desktop, Antigravity) can discover and execute its
 * published workflows as tools. Each session builds a fresh tool list from the
 * currently published skills, so newly published workflows appear on reconnect.
 */
export class AgentStudioMcpServer {
  constructor(private deps: AgentStudioMcpServerDeps) {}

  /** Handle GET /api/mcp/sse — opens the SSE stream for an initialized session. */
  async handleSseRequest(request: Request): Promise<Response> {
    const sessionId = request.headers.get("mcp-session-id");
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) {
      // No session yet — the client must initialize via POST /api/mcp/messages
      // first, then GET the stream with the issued session id.
      return new Response(
        JSON.stringify({
          error: "Unknown MCP session — POST initialize to /api/mcp/messages first",
        }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }
    // The returned Response IS the SSE stream — Next.js streams it to the client.
    return session.transport.handleRequest(request);
  }

  /** Handle POST /api/mcp/messages — initialize a session or forward to it. */
  async handleMessageRequest(request: Request): Promise<Response> {
    const sessionId = request.headers.get("mcp-session-id");
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (session) {
      return session.transport.handleRequest(request);
    }

    // New session: only an initialize request may create one.
    let body: unknown;
    try {
      body = await request.clone().json();
    } catch {
      // Non-JSON — let the transport surface the parse error.
    }
    const isInitialize =
      body !== undefined &&
      (Array.isArray(body)
        ? (body as { method?: string }[]).some((m) => m?.method === "initialize")
        : (body as { method?: string } | null)?.method === "initialize");
    if (!isInitialize) {
      return new Response(
        JSON.stringify({ error: "Unknown MCP session — POST initialize first" }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }

    const server = await this.buildServer();
    const transport = createSessionTransport(server);
    // Connect once per session; `handleRequest` below processes the initialize
    // message and fires `onsessioninitialized`, registering the session.
    await server.connect(transport);
    return transport.handleRequest(request);
  }

  /** Number of live sessions (health endpoint). */
  get sessionCount(): number {
    return sessions.size;
  }

  /** Build an SDK McpServer with one tool per published workflow. Public so
   * tests can attach an in-memory client and exercise the registered handlers. */
  async buildServer(): Promise<McpServer> {
    const server = new McpServer(
      { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
      { capabilities: { tools: {} } }
    );

    const tools = await this.listExposedSkillTools();
    for (const tool of tools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: jsonSchemaToZod(tool.inputSchema),
        },
        async (args) => this.runSkillTool(tool, args as Record<string, unknown>)
      );
    }
    logger.info({ toolCount: tools.length }, "Agent Studio MCP server built");
    return server;
  }

  /** Collect all published skills across users as MCP tools. */
  async listExposedSkillTools(): Promise<ExposedSkillTool[]> {
    const published = await (this.deps.listPublishedSkillVersions ?? defaultListPublishedSkillVersions)();

    const tools: ExposedSkillTool[] = [];
    for (const row of published) {
      const version = this.toVersionDto(row);
      const skill = row.skill;
      const inputSchema = this.buildSkillInputSchema(version);
      tools.push({
        name: `run_skill_${slugify(skill.name)}_${skill.id.slice(-6)}`,
        description: `${skill.purpose}${version.allowedTools.length > 0 ? ` Uses tools: ${version.allowedTools.join(", ")}.` : ""}`,
        inputSchema,
        version,
      });
    }
    return tools;
  }

  private toVersionDto(row: PublishedSkillVersionRow): SkillVersionDTO {
    return {
      id: row.id,
      skillId: row.skillId,
      versionNumber: row.versionNumber,
      status: row.status as SkillVersionDTO["status"],
      inputSchema: (row.inputSchema ?? {}) as Record<string, unknown>,
      outputSchema: (row.outputSchema ?? {}) as Record<string, unknown>,
      instructions: row.instructions,
      examples: (row.examples ?? []) as unknown as SkillVersionDTO["examples"],
      allowedTools: (row.allowedTools ?? []) as unknown as string[],
      actionsRequiringApproval: (row.actionsRequiringApproval ?? []) as unknown as string[],
      maxExecutionSteps: row.maxExecutionSteps,
      graphDefinition: (row.graphDefinition as SkillVersionDTO["graphDefinition"]) ?? null,
      changelog: row.changelog,
      notes: row.notes,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
    };
  }

  /** Merge the required `userId` arg into the skill's input schema. */
  private buildSkillInputSchema(version: SkillVersionDTO): Record<string, unknown> {
    const base = (version.inputSchema ?? {}) as Record<string, unknown>;
    const properties =
      base.properties !== null && typeof base.properties === "object" && !Array.isArray(base.properties)
        ? (base.properties as Record<string, unknown>)
        : {};
    const required = Array.isArray(base.required) ? (base.required as string[]) : [];
    return {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "Agent Studio user id whose account runs this workflow. Required for every invocation.",
        },
        ...properties,
      },
      required: ["userId", ...required],
    };
  }

  private async runSkillTool(
    tool: ExposedSkillTool,
    args: Record<string, unknown>
  ): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { userId, ...inputData } = args;
    try {
      if (typeof userId !== "string" || userId.length === 0) {
        throw new Error('Missing required argument "userId"');
      }
      // Ownership-scoped: the execution only proceeds if the skill belongs to
      // the user id supplied by the caller.
      const skill = await this.deps.skillRepo.findByIdForUser(tool.version.skillId, userId);
      if (!skill) {
        throw new Error(`Workflow "${tool.version.skillId}" is not available for user "${userId}"`);
      }
      const execution = await this.deps.executionService.startExecution({
        userId,
        skillVersionId: tool.version.id,
        inputData,
      });
      const text = JSON.stringify({
        executionId: execution.id,
        skillName: execution.skillName ?? skill.name,
        status: execution.status,
        ...(execution.status === "PAUSED_FOR_APPROVAL"
          ? { approvalRequired: true, message: "Execution paused — approve or reject it in the Agent Studio review queue" }
          : {}),
        ...(execution.finalOutput !== undefined && execution.finalOutput !== null
          ? { finalOutput: execution.finalOutput }
          : {}),
        ...(execution.errorMessage ? { error: execution.errorMessage } : {}),
      });
      return { content: [{ type: "text", text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow execution failed";
      logger.error({ tool: tool.name, userId, error: message }, "MCP skill tool failed");
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: message }) }], isError: true };
    }
  }
}

/** Default published-skill source: all PUBLISHED skill versions joined with their skill. */
async function defaultListPublishedSkillVersions(): Promise<PublishedSkillVersionRow[]> {
  return prisma.skillVersion.findMany({
    where: { status: "PUBLISHED" },
    include: { skill: true },
    take: 200,
  });
}

/** Slugify a skill name into an MCP tool-safe identifier. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "skill"
  );
}

/** True when a bearer token matches the configured MCP access token. */
export function isValidMcpAccessToken(token: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length === 0) return false;
  return token === expected;
}

/**
 * Shared auth decision for the MCP server routes: a Clerk session always
 * passes; otherwise the request must carry `Authorization: Bearer <token>`
 * matching the configured MCP_ACCESS_TOKEN.
 */
export function isMcpRequestAuthorized(
  clerkUserId: string | null | undefined,
  request: Request,
  expectedToken: string | undefined
): boolean {
  if (clerkUserId) return true;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  return isValidMcpAccessToken(token, expectedToken);
}
