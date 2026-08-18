import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { McpClientService } from "@/services/McpClientService";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { createMcpServerSchema } from "@/validators/mcpSchema";
import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";

import { ZodError } from "zod";

const mcpService = new McpClientService(new McpServerRepository());

export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const servers = await mcpService.listServers(userId);
    return NextResponse.json({ success: true, data: servers });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    const validated = createMcpServerSchema.parse({ ...body, userId });
    const server = await mcpService.createServer(validated);
    return NextResponse.json({ success: true, data: server }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof ZodError || (error instanceof Error && (error.name === "ZodError" || "issues" in error))) {
      return badRequest(error); // Zod validation failure → 400
    }
    // Connect failures are surfaced on the returned row (status ERROR) — a
    // server row that could not connect is still a 201 with an error status.
    return serverError(error);
  }
}
