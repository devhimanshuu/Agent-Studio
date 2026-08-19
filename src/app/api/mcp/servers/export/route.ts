import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { McpClientService } from "@/services/McpClientService";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { unauthorized, serverError } from "@/lib/api/handlers";

const mcpService = new McpClientService(new McpServerRepository());

/**
 * GET /api/mcp/servers/export
 * Exports all MCP servers configured by the authenticated user as a portable JSON bundle.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const servers = await mcpService.listServers(userId);
    const exportBundle = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      servers: servers.map((s) => ({
        name: s.name,
        transport: s.transport,
        endpointUrl: s.endpointUrl,
        command: s.command,
        headers: s.headers,
      })),
    };

    return new Response(JSON.stringify(exportBundle, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="agent-studio-mcp-servers-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
