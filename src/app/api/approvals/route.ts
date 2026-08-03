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
import { unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/api/handlers";
import { rateLimit } from "@/lib/api/rateLimit";

const approvalRepo = new ApprovalRepository();
const auditRepo = new AuditLogRepository();
const historyRepo = new ApprovalHistoryRepository();
const executionRepo = new ExecutionRepository();
const approvalService = new ApprovalService(approvalRepo, auditRepo);
const approvalEngine = new ApprovalEngine(approvalRepo, historyRepo, executionRepo);

export async function GET(_request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    // Return ALL approvals for the user (not just pending) — the review UI needs
    // both the pending queue and history. Single query, ownership-scoped.
    const requests = await approvalRepo.findByUserId(userId);
    return NextResponse.json({ success: true, data: requests });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  // Auth first — Clerk errors are never business-logic errors.
  const { userId } = await auth();
  if (!userId) return unauthorized();

  // Approval responses resume executions (expensive) — rate limit.
  const limited = rateLimit(`approval:respond:${userId}`);
  if (limited) return limited;

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
    // Ownership violations → 403 (authenticated user touching someone else's
    // review request). Genuinely missing requests → 404, NOT 403 — a 403 for a
    // nonexistent id would be indistinguishable from an ownership error.
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
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
