import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { McpClientService } from "@/services/McpClientService";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { updateMcpServerSchema } from "@/validators/mcpSchema";
import { unauthorized, badRequest, serverError, notFound, forbidden } from "@/lib/api/handlers";

const mcpService = new McpClientService(new McpServerRepository());

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const server = await mcpService.getServer(id, userId);
    if (!server) return notFound("MCP server not found");
    return NextResponse.json({ success: true, data: server });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateMcpServerSchema.parse(body);
    const updated = await mcpService.updateServer(id, userId, validated);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    if (error instanceof Error && "issues" in error) {
      return badRequest(error);
    }
    return serverError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const server = await mcpService.getServer(id, userId);
    if (!server) return notFound("MCP server not found");
    await mcpService.deleteServer(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    return serverError(error);
  }
}
