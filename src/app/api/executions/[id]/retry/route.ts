import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ExecutionService } from "@/services/ExecutionService";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { unauthorized, forbidden, notFound, serverError, badRequest } from "@/lib/api/handlers";
import { rateLimit } from "@/lib/api/rateLimit";

const executionRepo = new ExecutionRepository();
const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const approvalRepo = new ApprovalRepository();
const executionService = new ExecutionService(executionRepo, skillRepo, auditRepo, {
  approvalRepo,
});

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
    const execution = await executionRepo.findByIdForUser(id, userId);
    if (!execution) {
      return notFound("Execution not found or you do not have access to it");
    }

    if (execution.status === "RUNNING") {
      return badRequest(new Error("Execution is already running"));
    }

    const retried = await executionService.retryFailedExecution(id, userId);
    return NextResponse.json({ success: true, data: retried });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("access")) return forbidden();
      if (error.message.includes("not found")) return notFound(error.message);
      if (error.message.includes("already running")) return badRequest(error);
    }
    return serverError(error);
  }
}
