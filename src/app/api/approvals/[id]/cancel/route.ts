import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { ApprovalHistoryRepository } from "@/repositories/ApprovalHistoryRepository";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { ApprovalEngine } from "@/modules/approval";
import { unauthorized, forbidden, badRequest, serverError, notFound } from "@/lib/api/handlers";

const cancelSchema = z.object({
  idempotencyKey: z.string().min(1, "Idempotency key is required"),
});

const approvalRepo = new ApprovalRepository();
const historyRepo = new ApprovalHistoryRepository();
const executionRepo = new ExecutionRepository();
const approvalEngine = new ApprovalEngine(approvalRepo, historyRepo, executionRepo);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth first — Clerk errors are never business-logic errors.
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id: approvalId } = await params;
    const body = await request.json();
    const validated = cancelSchema.parse(body);

    const result = await approvalEngine.cancelPending(approvalId, userId, validated.idempotencyKey);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) return badRequest(error);
    const message = error instanceof Error ? error.message : "";
    // Ownership errors (wrong user accessing someone else's approval) → 403.
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    if (error instanceof Error) {
      return badRequest(error);
    }
    return serverError(error);
  }
}