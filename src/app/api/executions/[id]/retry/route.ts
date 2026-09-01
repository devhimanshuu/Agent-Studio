import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/handlers";
import { rateLimit } from "@/lib/api/rateLimit";
import { apiServices } from "@/lib/api/services";

const { executionService } = apiServices();

/**
 * Step-Level Safe Recovery Endpoint:
 * Retries a failed execution from the point of failure without repeating completed safe steps.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const limited = rateLimit(`exec:retry:${userId}`);
  if (limited) return limited;

  try {
    const { id } = await params;
    const execution = await executionService.getExecutionForUser(id, userId);
    if (!execution) {
      return handleApiError(new Error("Execution not found or you do not have access to it"));
    }

    if (execution.status === "RUNNING") {
      return badRequest(new Error("Execution is already running"));
    }

    const retried = await executionService.retryFailedExecution(id, userId);
    return NextResponse.json({ success: true, data: retried });
  } catch (error) {
    return handleApiError(error);
  }
}
