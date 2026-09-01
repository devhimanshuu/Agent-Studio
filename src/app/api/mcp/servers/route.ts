import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";
import { createMcpServerSchema } from "@/validators/mcpSchema";
import { unauthorized, forbidden, handleApiError } from "@/lib/api/handlers";
import { prisma } from "@/lib/prisma";

const { mcpService, rbacService } = apiServices();

/**
 * GET /api/mcp/servers — List MCP servers
 * Supports optional organization context via X-Organization-Id header
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw && /^\d+$/.test(limitRaw) ? Math.min(Number(limitRaw), 200) : undefined;
    
    // Get organization context if provided
    const organizationId = request.headers.get("X-Organization-Id") || url.searchParams.get("organizationId") || undefined;

    let servers;
    if (organizationId) {
      // Verify membership
      const membership = await rbacService.getOrgMembership(userId, organizationId);
      if (!membership) return forbidden();

      // List MCP servers for organization
      servers = await prisma.mcpServer.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } else {
      servers = await mcpService.listServers(userId, limit);
    }

    return NextResponse.json({ success: true, data: servers });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/mcp/servers — Create MCP server
 * Requires create permission in organization context
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    
    // Get organization context
    const organizationId = request.headers.get("X-Organization-Id") || body.organizationId || undefined;

    // Check permission if organization context
    if (organizationId) {
      const membership = await rbacService.getOrgMembership(userId, organizationId);
      if (!membership) return forbidden();

      const canCreate = await rbacService.hasPermission(userId, organizationId, "mcp:create");
      if (!canCreate) {
        return forbidden();
      }
    }

    const validated = createMcpServerSchema.parse({ ...body, userId });
    const server = await mcpService.createServer(validated);

    // Link to organization if provided
    if (organizationId) {
      await prisma.mcpServer.update({
        where: { id: server.id },
        data: { organizationId },
      });
    }

    return NextResponse.json({ success: true, data: server }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
