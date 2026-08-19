import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { McpClientService } from "@/services/McpClientService";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";

const mcpService = new McpClientService(new McpServerRepository());

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
          connectOnCreate: serverInput.connectOnCreate ?? false,
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
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON bundle"));
    }
    if (error instanceof z.ZodError) {
      return badRequest(error);
    }
    return serverError(error);
  }
}
