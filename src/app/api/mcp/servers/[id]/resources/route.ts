import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { McpClientService } from "@/services/McpClientService";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { unauthorized, notFound, forbidden, serverError } from "@/lib/api/handlers";

const mcpService = new McpClientService(new McpServerRepository());

/**
 * GET /api/mcp/servers/:id/resources
 * List resources exposed by the connected MCP server.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const resources = await mcpService.listResources(id, userId);
    return NextResponse.json({ success: true, data: resources });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    return serverError(error);
  }
}
