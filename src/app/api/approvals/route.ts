import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { respondApprovalSchema } from "@/validators/approvalSchema";
import { ApprovalService } from "@/services/ApprovalService";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { ApprovalHistoryRepository } from "@/repositories/ApprovalHistoryRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { ApprovalEngine } from "@/modules/approval";
import { unauthorized, forbidden, badRequest, serverError } from "@/lib/api/handlers";

const approvalRepo = new ApprovalRepository();
const auditRepo = new AuditLogRepository();
const historyRepo = new ApprovalHistoryRepository();
const executionRepo = new ExecutionRepository();
const approvalService = new ApprovalService(approvalRepo, auditRepo);
const approvalEngine = new ApprovalEngine(approvalRepo, historyRepo, executionRepo);

export async function GET(_request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  // Return ALL approvals for the user (not just pending) — the review UI needs
  // both the pending queue and history.
  const executionList = await executionRepo.findByUserId(userId);
  const executionIds = executionList.map((e) => e.id);

  const allRequests = await Promise.all(
    executionIds.map((eid) => approvalRepo.findByExecutionId(eid))
  );
  const flat = allRequests.flat().sort(
    (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime()
  );

  return NextResponse.json({ success: true, data: flat });
}

export async function POST(request: Request) {
  // Auth first — Clerk errors are never business-logic errors.
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    // Never trust a client-supplied userId — the authenticated session wins.
    const validated = respondApprovalSchema.parse({ ...body, userId });

    if (validated.approved) {
      // Route through the ApprovalEngine for proper approve + resume flow.
      const result = await approvalEngine.approve(
        validated.approvalId,
        userId,
        validated.idempotencyKey
      );
      return NextResponse.json({ success: true, data: result });
    } else {
      // Reject or cancel — route through the engine.
      const result = await approvalEngine.reject(
        validated.approvalId,
        userId,
        validated.rejectionReason ?? "Action rejected by reviewer",
        validated.idempotencyKey
      );
      return NextResponse.json({ success: true, data: result });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Ownership / not-found → 403 (don't leak which request ids exist).
    if (message.includes("not found") || message.includes("access")) {
      return forbidden();
    }
    if (error instanceof z.ZodError) return badRequest(error);
    if (error instanceof Error && "issues" in error) {
      return badRequest(error); // Zod validation failure → 400
    }
    if (error instanceof Error) {
      return badRequest(new Error(error.message)); // business rule (already responded) → 400
    }
    return serverError(error);
  }
}
