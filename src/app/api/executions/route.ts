import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { startExecutionSchema } from "@/validators/executionSchema";
import { unauthorized, forbidden, badRequest, serverError, isValidIsoDate } from "@/lib/api/handlers";
import { rateLimit } from "@/lib/api/rateLimit";
import { ExecutionError } from "@/modules/execution/executor/errors";
import { ExecutionQuery, ExecutionStatus } from "@/types/execution";
import { apiServices } from "@/lib/api/services";
import { RBACService, ForbiddenError } from "@/services/RBACService";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

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

const { executionService, historyService } = apiServices();
const rbacService = new RBACService();

/**
 * GET /api/executions — List executions
 * Supports optional organization context via X-Organization-Id header
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status") ?? undefined;
    if (rawStatus && !VALID_STATUSES.has(rawStatus as ExecutionStatus)) {
      return badRequest(new Error("status must be one of the known execution statuses"));
    }

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

    // Get organization context if provided
    const organizationId = request.headers.get("X-Organization-Id") || url.searchParams.get("organizationId") || undefined;

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

    let executions;
    if (organizationId) {
      // Verify membership
      const membership = await rbacService.getOrgMembership(userId, organizationId);
      if (!membership) return forbidden();

      // Viewers can see all org executions, members see their own
      const permissions = await rbacService.getUserOrgPermissions(userId, organizationId);
      
      if (permissions.canViewAuditLog) {
        // Admins/Owners/Viewers can see all org executions
        executions = await prisma.execution.findMany({
          where: { organizationId },
          orderBy: { [sortBy]: sortOrder },
          take: query.limit || 100,
        });
      } else {
        // Members see only their own executions
        executions = await prisma.execution.findMany({
          where: { organizationId, userId },
          orderBy: { [sortBy]: sortOrder },
          take: query.limit || 100,
        });
      }
    } else {
      executions = await historyService.list(userId, query);
    }

    return NextResponse.json({ success: true, data: executions });
  } catch (error) {
    logger.error({ error }, "Failed to list executions");
    return serverError(error);
  }
}

/**
 * POST /api/executions — Start execution
 * Requires SKILL_EXECUTOR permission on the skill
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const limited = rateLimit(`exec:start:${userId}`);
  if (limited) return limited;

  try {
    const body = await request.json();
    
    // Get organization context if provided
    const organizationId = request.headers.get("X-Organization-Id") || body.organizationId || undefined;

    // Check execution permission if organization context
    if (organizationId && body.skillVersionId) {
      const membership = await rbacService.getOrgMembership(userId, organizationId);
      if (!membership) return forbidden();

      const permissions = await rbacService.getUserOrgPermissions(userId, organizationId);
      if (!permissions.canExecuteSkill) {
        return forbidden();
      }
    }

    const validated = startExecutionSchema.parse({ ...body, userId });
    
    // Add organizationId if provided
    const executionData = organizationId
      ? { ...validated, organizationId }
      : validated;

    const execution = await executionService.startExecution(executionData);
    return NextResponse.json({ success: true, data: execution }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof Error && "issues" in error) {
      return badRequest(error);
    }
    if (error instanceof ExecutionError) {
      return badRequest(new Error(error.message));
    }
    if (error instanceof ForbiddenError) return forbidden();
    logger.error({ error }, "Failed to start execution");
    return serverError(error);
  }
}
