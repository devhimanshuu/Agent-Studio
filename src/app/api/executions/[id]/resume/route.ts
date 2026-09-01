import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/handlers";
import { rateLimit } from "@/lib/api/rateLimit";
import { apiServices } from "@/lib/api/services";

const resumeSchema = z.object({
  approvalId: z.string().min(1, "Approval ID is required"),
  idempotencyKey: z.string().min(1, "Idempotency key is required"),
});

const { auditRepo, approvalRepo, approvalEngine, executionService } = apiServices();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth first — Clerk errors are never business-logic errors.
  const { userId } = await auth();
  if (!userId) return unauthorized();

  // Resume re-invokes the LLM graph — rate limit.
  const limited = rateLimit(`exec:resume:${userId}`);
  if (limited) return limited;

  try {
    const { id: executionId } = await params;
    const body = await request.json();
    const validated = resumeSchema.parse(body);

    // Ownership check: the approval request must belong to this user.
    const approval = await approvalRepo.findById(validated.approvalId);
    if (!approval || approval.executionId !== executionId) {
      return badRequest(new Error("Approval request not found"));
    }
    // The user is authenticated but does not own this approval — 403, not 401
    if (approval.userId !== userId) {
      return handleApiError(new Error("access denied"));
    }

    // The approval must be in APPROVED status.
    if (approval.status !== "APPROVED") {
      return badRequest(new Error(`Cannot resume: approval is ${approval.status}`));
    }

    // Idempotency check: the key must match.
    if (approval.idempotencyKey !== validated.idempotencyKey) {
      return badRequest(new Error("Invalid idempotency key for this approval request"));
    }

    // Step 1: ApprovalEngine handles duplicate prevention, step limit
    // enforcement, history logging, and marks the execution as RUNNING.
    const { stepNumber } = await approvalEngine.resumeAfterApproval(
      validated.approvalId,
      userId
    );

    // Step 2: Resume the execution through the service (loads skill/version,
    // re-invokes the graph engine asynchronously).
    const result = await executionService.resumeExecution(executionId, userId);

    await auditRepo.log({
      userId,
      executionId,
      action: "EXECUTION_RESUMED",
      details: { approvalId: validated.approvalId, stepNumber },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}