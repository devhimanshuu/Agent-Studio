import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { apiServices } from "@/lib/api/services";

import { unauthorized, notFound, forbidden, badRequest, serverError } from "@/lib/api/handlers";

const { mcpService } = apiServices();

const readResourceSchema = z.object({
  uri: z.string().min(1, "URI is required"),
});

/**
 * POST /api/mcp/servers/:id/resources/read
 * Read a resource by URI from the connected MCP server.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    const { uri } = readResourceSchema.parse(body);

    const result = await mcpService.readResource(id, userId, uri);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) return badRequest(error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    return serverError(error);
  }
}
