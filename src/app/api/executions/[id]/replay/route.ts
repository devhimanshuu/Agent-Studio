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
import { unauthorized, serverError, notFound, forbidden } from "@/lib/api/handlers";
import { rateLimit } from "@/lib/api/rateLimit";

import { McpClientService } from "@/services/McpClientService";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { OpenApiService } from "@/services/OpenApiService";
import { OpenApiRepository } from "@/repositories/OpenApiRepository";

const executionRepo = new ExecutionRepository();
const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const approvalRepo = new ApprovalRepository();
const historyRepo = new ApprovalHistoryRepository();
const mcpService = new McpClientService(new McpServerRepository());
const openApiService = new OpenApiService(new OpenApiRepository());

const executionService = new ExecutionService(executionRepo, skillRepo, auditRepo, {
  mcpService,
  openApiService,
  approvalRepo,
});
const historyService = new ExecutionHistoryService(
  executionRepo,
  skillRepo,
  auditRepo,
  executionService,
  new ExecutionLogRepository(),
  approvalRepo,
  historyRepo
);

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
    if (error instanceof Error) {
      // Ownership violations must be 403, never 404 — a 404 leaks whether the
      // execution exists to a user who shouldn't see it.
      if (error.message.includes("access")) return forbidden();
      if (error.message.includes("not found")) return notFound(error.message);
    }
    return serverError(error);
  }
}
