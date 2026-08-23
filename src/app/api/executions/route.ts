import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { startExecutionSchema } from "@/validators/executionSchema";
import { ExecutionService } from "@/services/ExecutionService";
import { ExecutionHistoryService } from "@/modules/history";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { ExecutionLogRepository } from "@/repositories/ExecutionLogRepository";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { ApprovalHistoryRepository } from "@/repositories/ApprovalHistoryRepository";
import { unauthorized, badRequest, serverError, isValidIsoDate } from "@/lib/api/handlers";
import { rateLimit } from "@/lib/api/rateLimit";
import { ExecutionError } from "@/modules/execution/executor/errors";
import { ExecutionQuery, ExecutionStatus } from "@/types/execution";

const VALID_STATUSES = new Set<ExecutionStatus>([
  "PENDING",
  "RUNNING",
  "PAUSED_FOR_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "STEP_LIMIT_EXCEEDED",
]);

const VALID_SORT_BY = new Set(["startedAt", "durationMs", "status"]);
const VALID_SORT_ORDER = new Set(["asc", "desc"]);

import { McpClientService } from "@/services/McpClientService";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { OpenApiService } from "@/services/OpenApiService";
import { OpenApiRepository } from "@/repositories/OpenApiRepository";

const executionRepo = new ExecutionRepository();
const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const approvalRepo = new ApprovalRepository();
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
  new ApprovalHistoryRepository()
);

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    // Search / filter / sort support for the execution history page.
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status") ?? undefined;
    if (rawStatus && !VALID_STATUSES.has(rawStatus as ExecutionStatus)) {
      return badRequest(new Error("status must be one of the known execution statuses"));
    }

    // Query params are attacker-controlled — validate every one before it can
    // reach Prisma. A malformed sortBy/sortOrder/limit/from/to used to bubble
    // into `orderBy`/`take`/`where` and return a 500 instead of a clean 400.
    const sortBy = url.searchParams.get("sortBy") ?? "startedAt";
    const sortOrder = url.searchParams.get("sortOrder") ?? "desc";
    if (!VALID_SORT_BY.has(sortBy) || !VALID_SORT_ORDER.has(sortOrder)) {
      return badRequest(new Error("sortBy/sortOrder must be one of the supported values"));
    }
    const limitRaw = url.searchParams.get("limit");
    if (limitRaw !== null && (!/^\d+$/.test(limitRaw) || Number(limitRaw) < 1)) {
      return badRequest(new Error("limit must be a positive integer"));
    }
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");
    if ((fromRaw && !isValidIsoDate(fromRaw)) || (toRaw && !isValidIsoDate(toRaw))) {
      return badRequest(new Error("from/to must be valid ISO dates"));
    }

    const query: ExecutionQuery = {
      search: url.searchParams.get("search") ?? undefined,
      status: (rawStatus as ExecutionQuery["status"]) || undefined,
      skillName: url.searchParams.get("skillName") ?? undefined,
      skillVersionId: url.searchParams.get("skillVersionId") ?? undefined,
      provider: url.searchParams.get("provider") ?? undefined,
      from: fromRaw ?? undefined,
      to: toRaw ?? undefined,
      sortBy: sortBy as ExecutionQuery["sortBy"],
      sortOrder: sortOrder as ExecutionQuery["sortOrder"],
      limit: limitRaw !== null ? Number(limitRaw) : undefined,
    };
    const executions = await historyService.list(userId, query);
    return NextResponse.json({ success: true, data: executions });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  // Auth first — Clerk errors are never business-logic errors.
  const { userId } = await auth();
  if (!userId) return unauthorized();

  // Execution starts are expensive (LLM calls + graph run) — rate limit.
  const limited = rateLimit(`exec:start:${userId}`);
  if (limited) return limited;

  try {
    const body = await request.json();
    const validated = startExecutionSchema.parse({ ...body, userId });
    const execution = await executionService.startExecution(validated);
    return NextResponse.json({ success: true, data: execution }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return badRequest(error); // Zod validation failure → 400
    }
    // Domain validation failures (invalid skill/version/input) → 400.
    if (error instanceof ExecutionError) {
      return badRequest(new Error(error.message));
    }
    // Anything else (DB, unexpected) → 500 with a generic message.
    return serverError(error);
  }
}
