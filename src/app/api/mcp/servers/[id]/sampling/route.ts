import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { apiServices } from "@/lib/api/services";

import { unauthorized, badRequest, serverError, notFound, forbidden } from "@/lib/api/handlers";

const { mcpService } = apiServices();

const samplingSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.object({
        type: z.string(),
        text: z.string().optional(),
      }),
    })
  ),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).default(4096),
  stopSequences: z.array(z.string()).optional(),
});

/**
 * POST /api/mcp/servers/:id/sampling
 * Handle a sampling/createMessage request from a connected MCP server.
 * The connected server requests an LLM completion from Agent Studio's engine.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    const validated = samplingSchema.parse(body);

    const result = await mcpService.handleSamplingRequest(id, userId, validated as unknown as Record<string, unknown>);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) return badRequest(error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    return serverError(error);
  }
}
