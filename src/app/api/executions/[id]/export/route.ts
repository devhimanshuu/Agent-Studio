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

/**
 * JSON export of a full execution report: trace data, structured logs,
 * timeline events, and approval records. The client saves it as a file.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const report = await historyService.exportExecution(id, userId);
    if (!report) return notFound("Execution not found");
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return serverError(error);
  }
}
