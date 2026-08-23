import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/config/env";
import { AgentStudioMcpServer, isMcpRequestAuthorized } from "@/modules/mcp/server";
import { apiServices } from "@/lib/api/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Message POST endpoint for MCP sessions opened at /api/mcp/sse. Requests are
 * routed to the session's transport via the `mcp-session-id` header.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!isMcpRequestAuthorized(userId, request, env.MCP_ACCESS_TOKEN)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { executionService, skillRepo } = apiServices();
  const mcpServer = new AgentStudioMcpServer({ executionService, skillRepo });

  return mcpServer.handleMessageRequest(request);
}
