import { Prisma } from "@prisma/client";
import { IExecutionRepository } from "./interfaces/IExecutionRepository";
import { ExecutionDTO, ExecutionStepDTO, ToolCallDTO, StartExecutionInput } from "@/types/execution";
import { prisma } from "@/lib/prisma";

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

  async create(input: StartExecutionInput, maxSteps: number): Promise<ExecutionDTO> {
    const execution = await prisma.execution.create({
      data: {
        userId: input.userId,
        skillVersionId: input.skillVersionId,
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
      },
    });

    return {
      ...created,
      inputArgs: created.inputArgs as Record<string, unknown>,
      outputResult: created.outputResult as Record<string, unknown> | null,
      status: created.status as ToolCallDTO["status"],
    };
  }

  async setFinalOutput(id: string, output: Record<string, unknown>): Promise<ExecutionDTO> {
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
      toolCalls: (e.toolCalls || []).map((t: Prisma.ToolCallGetPayload<{}>) => ({
        id: t.id,
        executionId: t.executionId,
        stepId: t.stepId,
        toolName: t.toolName,
        action: t.action,
        inputArgs: t.inputArgs as Record<string, unknown>,
        outputResult: t.outputResult as Record<string, unknown> | null,
        status: t.status as ToolCallDTO["status"],
        errorMessage: t.errorMessage,
        executedAt: t.executedAt,
      })),
    };
  }
}
