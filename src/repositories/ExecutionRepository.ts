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
        inputData: input.inputData as any,
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
        ...(status === "COMPLETED" || status === "FAILED" || status === "CANCELLED" ? { completedAt: new Date() } : {}),
      },
      include: { steps: true, toolCalls: true },
    });

    return this.mapExecution(updated);
  }

  async addStep(executionId: string, step: Omit<ExecutionStepDTO, "id">): Promise<ExecutionStepDTO> {
    const created = await prisma.executionStep.create({
      data: {
        executionId,
        stepNumber: step.stepNumber,
        nodeName: step.nodeName,
        stateSnapshot: step.stateSnapshot as any,
        status: step.status,
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

  async addToolCall(executionId: string, toolCall: Omit<ToolCallDTO, "id" | "executedAt">): Promise<ToolCallDTO> {
    const created = await prisma.toolCall.create({
      data: {
        executionId,
        stepId: toolCall.stepId,
        toolName: toolCall.toolName,
        action: toolCall.action,
        inputArgs: toolCall.inputArgs as any,
        outputResult: toolCall.outputResult as any,
        status: toolCall.status,
        errorMessage: toolCall.errorMessage,
      },
    });

    return {
      ...created,
      inputArgs: created.inputArgs as Record<string, unknown>,
      outputResult: created.outputResult as Record<string, unknown> | null,
      status: created.status as any,
    };
  }

  async setFinalOutput(id: string, output: Record<string, unknown>): Promise<ExecutionDTO> {
    const updated = await prisma.execution.update({
      where: { id },
      data: {
        finalOutput: output as any,
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: { steps: true, toolCalls: true },
    });

    return this.mapExecution(updated);
  }

  private mapExecution(e: any): ExecutionDTO {
    return {
      id: e.id,
      userId: e.userId,
      skillVersionId: e.skillVersionId,
      status: e.status,
      inputData: e.inputData as Record<string, unknown>,
      finalOutput: e.finalOutput as Record<string, unknown> | null,
      stepCount: e.stepCount,
      maxSteps: e.maxSteps,
      errorMessage: e.errorMessage,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      steps: (e.steps || []).map((s: any) => ({
        id: s.id,
        executionId: s.executionId,
        stepNumber: s.stepNumber,
        nodeName: s.nodeName,
        stateSnapshot: s.stateSnapshot as Record<string, unknown>,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
      toolCalls: (e.toolCalls || []).map((t: any) => ({
        id: t.id,
        executionId: t.executionId,
        stepId: t.stepId,
        toolName: t.toolName,
        action: t.action,
        inputArgs: t.inputArgs as Record<string, unknown>,
        outputResult: t.outputResult as Record<string, unknown> | null,
        status: t.status,
        errorMessage: t.errorMessage,
        executedAt: t.executedAt,
      })),
    };
  }
}
