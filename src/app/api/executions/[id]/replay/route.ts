import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, handleApiError } from "@/lib/api/handlers";
import { rateLimit } from "@/lib/api/rateLimit";
import { apiServices } from "@/lib/api/services";

const { historyService } = apiServices();

/**
 * Replay a previous execution. Reuses its skill version + input, creates a NEW
 * execution linked back via replayedFromExecutionId — historical records are
 * never modified.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  // Replay spawns a full new execution — rate limit to protect the LLM budget.
  const limited = rateLimit(`exec:replay:${userId}`);
  if (limited) return limited;

  try {
    const { id } = await params;
    const execution = await historyService.replay(id, userId);
    return NextResponse.json({ success: true, data: execution }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
