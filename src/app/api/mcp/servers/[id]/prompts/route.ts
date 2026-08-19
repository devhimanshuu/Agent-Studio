import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { McpClientService } from "@/services/McpClientService";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { unauthorized, notFound, forbidden, serverError, badRequest } from "@/lib/api/handlers";

const mcpService = new McpClientService(new McpServerRepository());

/**
 * GET /api/mcp/servers/:id/prompts
 * List prompt templates exposed by the connected MCP server.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const prompts = await mcpService.listPrompts(id, userId);
    return NextResponse.json({ success: true, data: prompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    return serverError(error);
  }
}

/**
 * POST /api/mcp/servers/:id/prompts
 * Get a specific prompt template by name with arguments.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.name || typeof body.name !== "string") {
      return badRequest(new Error("Prompt name is required"));
    }
    const result = await mcpService.getPrompt(id, userId, body.name, body.arguments);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    return serverError(error);
  }
}
