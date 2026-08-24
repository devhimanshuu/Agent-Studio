import { Prisma } from "@prisma/client";
import { IExecutionRepository } from "./interfaces/IExecutionRepository";
import {
  ExecutionDTO,
  ExecutionStepDTO,
  ToolCallDTO,
  StartExecutionInput,
  ExecutionQuery,
} from "@/types/execution";
import { prisma } from "@/lib/prisma";
import { validateJsonByteSize } from "@/lib/api/payloadValidation";
import { ensureUserExists } from "@/lib/user";

export class ExecutionRepository implements IExecutionRepository {
  async findById(id: string): Promise<ExecutionDTO | null> {
    const execution = await prisma.execution.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
        toolCalls: { orderBy: { executedAt: "asc" } },
      },
    });

    if (!execution) return null;
    return this.mapExecution(execution);
  }

  async findByIdForUser(id: string, userId: string): Promise<ExecutionDTO | null> {
    const execution = await prisma.execution.findFirst({
      where: { id, userId },
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
        toolCalls: { orderBy: { executedAt: "asc" } },
      },
    });

    if (!execution) return null;
    return this.mapExecution(execution);
  }

  async findByUserId(userId: string): Promise<ExecutionDTO[]> {
    const executions = await prisma.execution.findMany({
      where: { userId },
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
        toolCalls: { orderBy: { executedAt: "asc" } },
      },
      orderBy: { startedAt: "desc" },
    });

    return executions.map((e) => this.mapExecution(e));
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.execution.count({ where: { userId } });
  }

  async create(input: StartExecutionInput, maxSteps: number, skillName?: string): Promise<ExecutionDTO> {
    await ensureUserExists(input.userId);
    const execution = await prisma.execution.create({
      data: {
        userId: input.userId,
        skillVersionId: input.skillVersionId,
        skillName: skillName ?? null,
        inputData: input.inputData as unknown as Prisma.InputJsonValue,
        maxSteps,
        status: "RUNNING",
      },
      include: {
        steps: true,
        toolCalls: true,
      },
    });

    return this.mapExecution(execution);
  }

  async listForUser(userId: string, query: ExecutionQuery): Promise<ExecutionDTO[]> {
    const where: Prisma.ExecutionWhereInput = { userId };

    if (query.status) where.status = query.status as Prisma.EnumExecutionStatusFilter;
    if (query.skillName) where.skillName = { contains: query.skillName, mode: "insensitive" };
    if (query.skillVersionId) where.skillVersionId = query.skillVersionId;
    if (query.provider) where.provider = { contains: query.provider, mode: "insensitive" };

    // Defense in depth: routes validate these params and return 400 first, but
    // the repo must never 500 on a bad value from ANY caller. Invalid dates are
    // skipped (no filter); unknown sort keys/orders fall back to the defaults.
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const fromValid = from !== undefined && !Number.isNaN(from.getTime());
    const toValid = to !== undefined && !Number.isNaN(to.getTime());
    if (fromValid || toValid) {
      where.startedAt = {
        ...(fromValid ? { gte: from } : {}),
        ...(toValid ? { lte: to } : {}),
      };
    }
    // Free-text search: execution id prefix, skill name, provider, or error message.
    if (query.search) {
      where.OR = [
        { id: { contains: query.search, mode: "insensitive" } },
        { skillName: { contains: query.search, mode: "insensitive" } },
        { provider: { contains: query.search, mode: "insensitive" } },
        { errorMessage: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const sortBy: "startedAt" | "durationMs" | "status" = ["startedAt", "durationMs", "status"].includes(
      query.sortBy as string
    )
      ? (query.sortBy as "startedAt" | "durationMs" | "status")
      : "startedAt";
    const sortOrder: "asc" | "desc" = query.sortOrder === "asc" ? "asc" : "desc";

    const executions = await prisma.execution.findMany({
      where,
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
        toolCalls: { orderBy: { executedAt: "asc" } },
      },
      orderBy: { [sortBy]: sortOrder },
      // Prisma throws on negative/NaN takes — clamp finite limits into 0..200
      // (limit 0 still returns an empty page, as callers expect), default 100.
      take: Number.isFinite(query.limit)
        ? Math.min(Math.max(Math.floor(query.limit!), 0), 200)
        : 100,
    });

    return executions.map((e) => this.mapExecution(e));
  }

  async setReplayedFrom(id: string, replayedFromExecutionId: string): Promise<ExecutionDTO> {
    const updated = await prisma.execution.update({
      where: { id },
      data: { replayedFromExecutionId },
      include: { steps: true, toolCalls: true },
    });
    return this.mapExecution(updated);
  }

  async getMetrics(userId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    cancelled: number;
    paused: number;
    avgDurationMs: number;
    mostUsedSkills: { skillName: string; count: number }[];
  }> {
    const [statusCounts, avgDuration, skillGroups] = await Promise.all([
      prisma.execution.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.execution.aggregate({
        where: { userId, durationMs: { not: null } },
        _avg: { durationMs: true },
      }),
      prisma.execution.groupBy({
        by: ["skillName"],
        where: { userId, skillName: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { skillName: "desc" } },
        take: 5,
      }),
    ]);

    const countsMap = new Map(statusCounts.map((g) => [g.status, g._count._all]));
    const total = Array.from(countsMap.values()).reduce((a, b) => a + b, 0);

    return {
      total,
      completed: countsMap.get("COMPLETED") ?? 0,
      failed: (countsMap.get("FAILED") ?? 0) + (countsMap.get("STEP_LIMIT_EXCEEDED") ?? 0),
      cancelled: countsMap.get("CANCELLED") ?? 0,
      paused: countsMap.get("PAUSED_FOR_APPROVAL") ?? 0,
      avgDurationMs: Math.round(avgDuration._avg.durationMs ?? 0),
      mostUsedSkills: skillGroups.map((g) => ({
        skillName: g.skillName || "Unknown skill",
        count: g._count._all,
      })),
    };
  }

  async getApprovalSummary(userId: string): Promise<{ total: number; pending: number }> {
    const [total, pending] = await Promise.all([
      prisma.approvalRequest.count({ where: { userId } }),
      prisma.approvalRequest.count({ where: { userId, status: "PENDING" } }),
    ]);
    return { total, pending };
  }

  async updateStatus(id: string, status: ExecutionDTO["status"], errorMessage?: string): Promise<ExecutionDTO> {
    const updated = await prisma.execution.update({
      where: { id },
      data: {
        status,
        ...(errorMessage && { errorMessage }),
        ...(status === "COMPLETED" || status === "FAILED" || status === "CANCELLED" || status === "STEP_LIMIT_EXCEEDED"
          ? { completedAt: new Date() }
          : {}),
      },
      include: { steps: true, toolCalls: true },
    });

    return this.mapExecution(updated);
  }

  /**
   * Atomic compare-and-swap claim for (re)starting a run: flips the row to
   * RUNNING only when it is not already RUNNING. `updateMany` guarantees
   * exactly one concurrent caller wins; losers get `false` instead of a
   * double-invoked graph run.
   */
  async claimRun(id: string): Promise<boolean> {
    const result = await prisma.execution.updateMany({
      where: { id, status: { not: "RUNNING" } },
      data: { status: "RUNNING", errorMessage: null },
    });
    return result.count === 1;
  }

  async addStep(executionId: string, step: Omit<ExecutionStepDTO, "id" | "executionId">): Promise<ExecutionStepDTO> {
    const created = await prisma.executionStep.create({
      data: {
        executionId,
        stepNumber: step.stepNumber,
        nodeName: step.nodeName,
        stateSnapshot: step.stateSnapshot as unknown as Prisma.InputJsonValue,
        status: step.status,
        ...(step.startedAt && { startedAt: step.startedAt }),
        ...(step.completedAt && { completedAt: step.completedAt }),
      },
    });

    await prisma.execution.update({
      where: { id: executionId },
      data: { stepCount: step.stepNumber },
    });

    return {
      ...created,
      stateSnapshot: created.stateSnapshot as Record<string, unknown>,
    };
  }

  async addToolCall(executionId: string, toolCall: Omit<ToolCallDTO, "id" | "executionId" | "executedAt">): Promise<ToolCallDTO> {
    const created = await prisma.toolCall.create({
      data: {
        executionId,
        stepId: toolCall.stepId,
        toolName: toolCall.toolName,
        action: toolCall.action,
        inputArgs: toolCall.inputArgs as unknown as Prisma.InputJsonValue,
        outputResult: toolCall.outputResult as unknown as Prisma.InputJsonValue,
        status: toolCall.status,
        errorMessage: toolCall.errorMessage,
        durationMs: toolCall.durationMs ?? null,
      },
    });

    return this.mapToolCall(created);
  }

  /** Aggregated usage counts per tool name (tools dashboard metric). Scoped to
   * the owning user when provided. */
  async countToolCallsByTool(userId?: string): Promise<Record<string, number>> {
    const groups = await prisma.toolCall.groupBy({
      by: ["toolName"],
      where: userId ? { execution: { userId } } : undefined,
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const group of groups) counts[group.toolName] = group._count._all;
    return counts;
  }

  /** Most recent tool calls for a given tool (tool details page). Scoped to
   * the owning user when provided — never leaks another user's invocations. */
  async findToolCallsByToolName(toolName: string, userId?: string, limit = 20): Promise<ToolCallDTO[]> {
    const rows = await prisma.toolCall.findMany({
      where: { toolName, ...(userId ? { execution: { userId } } : {}) },
      orderBy: { executedAt: "desc" },
      take: limit,
    });
    return rows.map((row) => this.mapToolCall(row));
  }

  async setFinalOutput(id: string, output: Record<string, unknown>): Promise<ExecutionDTO> {
    // Enforce 1MB JSON storage boundary before writing to the Prisma Json column.
    validateJsonByteSize(output, undefined, "Final execution output");

    const updated = await prisma.execution.update({
      where: { id },
      data: {
        finalOutput: output as unknown as Prisma.InputJsonValue,
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: { steps: true, toolCalls: true },
    });

    return this.mapExecution(updated);
  }

  async setRuntimeDetails(
    id: string,
    details: { provider?: string; plannerOutput?: Record<string, unknown>; durationMs?: number }
  ): Promise<ExecutionDTO> {
    const updated = await prisma.execution.update({
      where: { id },
      data: {
        ...(details.provider !== undefined && { provider: details.provider }),
        ...(details.plannerOutput !== undefined && {
          plannerOutput: details.plannerOutput as unknown as Prisma.InputJsonValue,
        }),
        ...(details.durationMs !== undefined && { durationMs: details.durationMs }),
      },
      include: { steps: true, toolCalls: true },
    });

    return this.mapExecution(updated);
  }

  private mapExecution(e: Prisma.ExecutionGetPayload<{ include: { steps: true; toolCalls: true } }>): ExecutionDTO {
    return {
      id: e.id,
      userId: e.userId,
      skillVersionId: e.skillVersionId,
      skillName: e.skillName,
      replayedFromExecutionId: e.replayedFromExecutionId,
      status: e.status,
      inputData: e.inputData as Record<string, unknown>,
      finalOutput: e.finalOutput as Record<string, unknown> | null,
      plannerOutput: e.plannerOutput as Record<string, unknown> | null,
      provider: e.provider,
      durationMs: e.durationMs,
      stepCount: e.stepCount,
      maxSteps: e.maxSteps,
      errorMessage: e.errorMessage,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      steps: (e.steps || []).map((s: Prisma.ExecutionStepGetPayload<{}>) => ({
        id: s.id,
        executionId: s.executionId,
        stepNumber: s.stepNumber,
        nodeName: s.nodeName,
        stateSnapshot: s.stateSnapshot as Record<string, unknown>,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
      toolCalls: (e.toolCalls || []).map((t: Prisma.ToolCallGetPayload<{}>) => this.mapToolCall(t)),
    };
  }

  private mapToolCall(t: Prisma.ToolCallGetPayload<{}>): ToolCallDTO {
    return {
      id: t.id,
      executionId: t.executionId,
      stepId: t.stepId,
      toolName: t.toolName,
      action: t.action,
      inputArgs: t.inputArgs as Record<string, unknown>,
      outputResult: t.outputResult as Record<string, unknown> | null,
      status: t.status as ToolCallDTO["status"],
      errorMessage: t.errorMessage,
      durationMs: t.durationMs,
      executedAt: t.executedAt,
    };
  }
}
