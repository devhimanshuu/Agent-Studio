import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { apiServices } from "@/lib/api/services";

import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";

const { mcpService } = apiServices();

const batchActionSchema = z.object({
  action: z.enum(["connect", "disconnect", "health"]),
  serverIds: z.array(z.string()).optional(), // If omitted, applies to all servers
});

/**
 * POST /api/mcp/servers/batch
 * Performs batch operations (connect, disconnect, health probe) across multiple servers.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    const { action, serverIds } = batchActionSchema.parse(body);

    const allServers = await mcpService.listServers(userId);
    const targetServers = serverIds && serverIds.length > 0
      ? allServers.filter((s) => serverIds.includes(s.id))
      : allServers;

    if (action === "connect") {
      const results = await Promise.allSettled(
        targetServers.map(async (s) => {
          const updated = await mcpService.connect(s.id, userId);
          return { id: s.id, name: s.name, status: updated.status, toolCount: updated.cachedTools.length };
        })
      );
      return NextResponse.json({
        success: true,
        data: results.map((r, i) =>
          r.status === "fulfilled"
            ? { ...r.value, ok: true }
            : { id: targetServers[i].id, name: targetServers[i].name, ok: false, error: r.reason?.message ?? "Connect failed" }
        ),
      });
    }

    if (action === "disconnect") {
      const results = await Promise.allSettled(
        targetServers.map(async (s) => {
          const updated = await mcpService.disconnect(s.id, userId);
          return { id: s.id, name: s.name, status: updated.status };
        })
      );
      return NextResponse.json({
        success: true,
        data: results.map((r, i) =>
          r.status === "fulfilled"
            ? { ...r.value, ok: true }
            : { id: targetServers[i].id, name: targetServers[i].name, ok: false, error: r.reason?.message ?? "Disconnect failed" }
        ),
      });
    }

    if (action === "health") {
      const results = await Promise.allSettled(
        targetServers.map(async (s) => {
          const health = await mcpService.healthCheck(s.id, userId);
          return health;
        })
      );
      return NextResponse.json({
        success: true,
        data: results.map((r, i) =>
          r.status === "fulfilled"
            ? r.value
            : { serverId: targetServers[i].id, status: "unavailable", latencyMs: 0, toolCount: 0, message: r.reason?.message ?? "Probe failed" }
        ),
      });
    }

    return badRequest(new Error("Invalid action"));
  } catch (error) {
    if (error instanceof z.ZodError) return badRequest(error);
    return serverError(error);
  }
}
