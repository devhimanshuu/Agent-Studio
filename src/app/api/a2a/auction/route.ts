import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runTaskAuction, TaskSpecification } from "@/modules/a2a/auction";
import { fetchA2ARegistry } from "@/modules/a2a/registry";
import { rateLimit } from "@/lib/api/rateLimit";
import { logger } from "@/lib/logger";
import { env } from "@/lib/config/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/a2a/auction
 * Broadcasts a sealed-bid RFP to candidate A2A agents and (optionally)
 * executes the task on the winning bidder.
 *
 * Auth + rate-limit: requires a Clerk session and is capped at 10 calls / min /
 * user. Each call costs an LLM token for the synthetic fallback bid, so we
 * gate against burst abuse even for signed-in users.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const limited = rateLimit(`a2a:auction:${userId}`);
  if (limited) {
    return limited;
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!title || !description) {
    return NextResponse.json(
      {
        success: false,
        error: "Both 'title' and 'description' are required",
        code: "BAD_REQUEST",
      },
      { status: 400 },
    );
  }

  const requiredCapability =
    typeof body.requiredCapability === "string" && body.requiredCapability.trim()
      ? body.requiredCapability.trim()
      : "visual_graph_orchestration";
  const priority =
    body.priority === "urgent" || body.priority === "high" || body.priority === "low"
      ? body.priority
      : "normal";
  const inputData =
    body.inputData && typeof body.inputData === "object" && !Array.isArray(body.inputData)
      ? (body.inputData as Record<string, unknown>)
      : {};
  const executeWinner = body.executeWinner !== false;
  const biddingWindowMs =
    typeof body.biddingWindowMs === "number" &&
    body.biddingWindowMs > 0 &&
    body.biddingWindowMs <= 60_000
      ? Math.floor(body.biddingWindowMs)
      : undefined;

  const taskSpec: TaskSpecification = {
    taskId: `auc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    description,
    requiredCapability,
    priority,
    inputData,
    biddingWindowMs,
  };

  try {
    const { manifests } = await fetchA2ARegistry({
      registryUrl: env.A2A_REGISTRY_URL,
      authToken: env.A2A_REGISTRY_TOKEN,
    });
    const auctionResult = await runTaskAuction(taskSpec, manifests, {
      executeWinner,
    });
    return NextResponse.json({ success: true, auction: auctionResult });
  } catch (error) {
    logger.error({ err: error, userId }, "Task auction failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Task auction failed",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}