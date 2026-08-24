import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";

import { unauthorized, serverError, notFound } from "@/lib/api/handlers";

const { mcpService } = apiServices();

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const server = await mcpService.getServer(id, userId);
    if (!server) return notFound("MCP server not found");
    const updated = await mcpService.disconnect(id, userId);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return serverError(error);
  }
}
