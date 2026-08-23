import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";

import { unauthorized, notFound, forbidden, serverError } from "@/lib/api/handlers";

const { mcpService } = apiServices();

/**
 * GET /api/mcp/servers/:id/metrics
 * Get circuit breaker stats and health metrics for an MCP server.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const metrics = await mcpService.getMetrics(id, userId);
    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    return serverError(error);
  }
}
