import { NextResponse } from "next/server";
import { runTaskAuction, TaskSpecification } from "@/modules/a2a/auction";
import { A2A_AGENT_PRESETS } from "@/modules/a2a/presets";

export const dynamic = "force-dynamic";

/**
 * POST /api/a2a/auction
 * Broadcasts task parameters to candidate A2A agents and executes task with winning bidder.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      requiredCapability = "visual_graph_orchestration",
      priority = "normal",
      inputData = {},
      executeWinner = true,
    } = body;

    const taskSpec: TaskSpecification = {
      taskId: `auc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title || "Autonomous Delegated Task",
      description: description || "Execute delegated multi-agent workflow.",
      requiredCapability,
      priority,
      inputData,
    };

    const auctionResult = await runTaskAuction(taskSpec, A2A_AGENT_PRESETS, {
      executeWinner,
    });

    return NextResponse.json({
      success: true,
      auction: auctionResult,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task auction failed" },
      { status: 500 }
    );
  }
}
