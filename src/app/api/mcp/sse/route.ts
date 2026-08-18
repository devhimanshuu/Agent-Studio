import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/config/env";
import { AgentStudioMcpServer, isMcpRequestAuthorized } from "@/modules/mcp/server";
import { ExecutionService } from "@/services/ExecutionService";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { McpClientService } from "@/services/McpClientService";
import { McpServerRepository } from "@/repositories/McpServerRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agent Studio as an MCP server — external agents (Cursor, Claude Desktop,
 * Antigravity) connect here over SSE (Streamable HTTP) and get every published
 * workflow as a callable tool.
 *
 * Auth: Clerk sessions pass through; external agents must present
 * `Authorization: Bearer <MCP_ACCESS_TOKEN>`.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!isMcpRequestAuthorized(userId, request, env.MCP_ACCESS_TOKEN)) {
    return unauthorizedResponse();
  }

  const mcpServer = new AgentStudioMcpServer({
    executionService: new ExecutionService(
      new ExecutionRepository(),
      new SkillRepository(),
      new AuditLogRepository(),
      { mcpService: new McpClientService(new McpServerRepository()) }
    ),
    skillRepo: new SkillRepository(),
  });

  return mcpServer.handleSseRequest(request);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!isMcpRequestAuthorized(userId, request, env.MCP_ACCESS_TOKEN)) {
    return unauthorizedResponse();
  }

  const mcpServer = new AgentStudioMcpServer({
    executionService: new ExecutionService(
      new ExecutionRepository(),
      new SkillRepository(),
      new AuditLogRepository(),
      { mcpService: new McpClientService(new McpServerRepository()) }
    ),
    skillRepo: new SkillRepository(),
  });

  return mcpServer.handleMessageRequest(request);
}

function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized — connect with a Clerk session or the MCP_ACCESS_TOKEN" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
