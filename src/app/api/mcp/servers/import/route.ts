import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { apiServices } from "@/lib/api/services";

import { unauthorized, handleApiError } from "@/lib/api/handlers";

const { mcpService } = apiServices();

const importSchema = z.object({
  version: z.string().optional(),
  servers: z.array(
    z.object({
      name: z.string().min(1).max(100),
      transport: z.enum(["SSE", "STDIO"]),
      endpointUrl: z.string().url().optional().nullable(),
      command: z.string().min(1).optional().nullable(),
      headers: z.record(z.string()).optional().nullable(),
      connectOnCreate: z.boolean().optional(),
    })
  ).min(1, "At least one server configuration is required"),
});

/**
 * POST /api/mcp/servers/import
 * Imports a JSON bundle of MCP server configurations.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    const validated = importSchema.parse(body);

    const imported = [];
    const errors: { name: string; error: string }[] = [];

    for (const serverInput of validated.servers) {
      try {
        const created = await mcpService.createServer({
          userId,
          name: serverInput.name,
          transport: serverInput.transport,
          endpointUrl: serverInput.endpointUrl ?? undefined,
          command: serverInput.command ?? undefined,
          headers: serverInput.headers ?? undefined,
          // Imported bundles NEVER auto-connect: a STDIO entry would mean
          // executing an arbitrary command from a JSON file the moment it is
          // imported. The user must explicitly hit Connect.
          connectOnCreate: false,
        });
        imported.push(created);
      } catch (err) {
        errors.push({
          name: serverInput.name,
          error: err instanceof Error ? err.message : "Failed to import server",
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        importedCount: imported.length,
        errorCount: errors.length,
        servers: imported,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
