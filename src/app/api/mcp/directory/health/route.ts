import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized } from "@/lib/api/handlers";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const endpointUrl = body.endpointUrl;

  if (!endpointUrl || typeof endpointUrl !== "string") {
    return NextResponse.json({ success: false, error: "endpointUrl required" }, { status: 400 });
  }

  try {
    const start = Date.now();
    const res = await fetch(endpointUrl, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Agent-Studio/1.0" },
    });
    const latencyMs = Date.now() - start;

    return NextResponse.json({
      success: true,
      data: {
        status: res.ok ? "healthy" : "degraded",
        statusCode: res.status,
        latencyMs,
        endpointUrl,
      },
    });
  } catch (e) {
    return NextResponse.json({
      success: true,
      data: {
        status: "unreachable",
        statusCode: 0,
        latencyMs: 0,
        endpointUrl,
        error: e instanceof Error ? e.message : "Connection failed",
      },
    });
  }
}
