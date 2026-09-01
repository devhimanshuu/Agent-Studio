import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";

import { unauthorized, handleApiError } from "@/lib/api/handlers";

const { mcpService } = apiServices();

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const server = await mcpService.getServer(id, userId);
    if (!server) {
      return NextResponse.json(
        { success: false, error: "MCP server not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    const connected = await mcpService.connect(id, userId);
    return NextResponse.json({ success: true, data: connected });
  } catch (error) {
    return handleApiError(error);
  }
}
