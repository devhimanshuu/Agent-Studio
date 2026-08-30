import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";
import { createMcpServerSchema } from "@/validators/mcpSchema";
import { unauthorized, forbidden, badRequest, serverError } from "@/lib/api/handlers";
import { RBACService, ForbiddenError } from "@/services/RBACService";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ZodError } from "zod";

const { mcpService } = apiServices();
const rbacService = new RBACService();

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
    logger.error({ error }, "Failed to list MCP servers");
    return serverError(error);
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

      const permissions = await rbacService.getUserOrgPermissions(userId, organizationId);
      if (!permissions.canCreateSkill) {
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
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof ZodError || (error instanceof Error && (error.name === "ZodError" || "issues" in error))) {
      return badRequest(error);
    }
    if (error instanceof ForbiddenError) return forbidden();
    logger.error({ error }, "Failed to create MCP server");
    return serverError(error);
  }
}
