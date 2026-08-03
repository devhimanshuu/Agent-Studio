import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ExecutionService } from "@/services/ExecutionService";
import { ExecutionHistoryService } from "@/modules/history";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { ExecutionLogRepository } from "@/repositories/ExecutionLogRepository";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { ApprovalHistoryRepository } from "@/repositories/ApprovalHistoryRepository";
import { unauthorized, serverError, notFound } from "@/lib/api/handlers";

const executionRepo = new ExecutionRepository();
const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const executionService = new ExecutionService(executionRepo, skillRepo, auditRepo);
const historyService = new ExecutionHistoryService(
  executionRepo,
  skillRepo,
  auditRepo,
  executionService,
  new ExecutionLogRepository(),
  new ApprovalRepository(),
  new ApprovalHistoryRepository()
);

/** Full execution detail: trace data, structured logs, timeline, and approval events. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const detail = await historyService.getDetail(id, userId);
    if (!detail) return notFound("Execution not found");
    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    return serverError(error);
  }
}
