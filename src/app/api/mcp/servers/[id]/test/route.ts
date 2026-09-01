import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";
import { mcpTestToolSchema } from "@/validators/mcpSchema";
import { unauthorized, handleApiError } from "@/lib/api/handlers";

const { mcpService } = apiServices();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const server = await mcpService.getServer(id, userId);
    if (!server) throw new Error("MCP server not found");

    const body = await request.json();
    const validated = mcpTestToolSchema.parse(body);
    const result = await mcpService.testTool(id, userId, validated.toolName, validated.arguments);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
