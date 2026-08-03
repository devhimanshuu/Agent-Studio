import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { ExecutionDTO, ExecutionStepDTO, ToolCallDTO, StartExecutionInput } from "@/types/execution";

export class FakeExecutionRepo implements IExecutionRepository {
  executions = new Map<string, ExecutionDTO>();
  steps: ExecutionStepDTO[] = [];
  toolCalls: ToolCallDTO[] = [];
  statusUpdates: { id: string; status: ExecutionDTO["status"]; error?: string }[] = [];
  runtimeDetails: { id: string; details: { provider?: string; plannerOutput?: Record<string, unknown>; durationMs?: number } }[] = [];
  private seq = 0;

  async findById(id: string): Promise<ExecutionDTO | null> {
    return this.executions.get(id) ?? null;
  }

  async findByIdForUser(id: string, userId: string): Promise<ExecutionDTO | null> {
    const e = this.executions.get(id);
    return e && e.userId === userId ? e : null;
  }

  async findByUserId(userId: string): Promise<ExecutionDTO[]> {
    return [...this.executions.values()].filter((e) => e.userId === userId);
  }

  async create(input: StartExecutionInput, maxSteps: number): Promise<ExecutionDTO> {
    this.seq += 1;
    const execution: ExecutionDTO = {
      id: `exec-${this.seq}`,
      userId: input.userId,
      skillVersionId: input.skillVersionId,
      status: "RUNNING",
      inputData: input.inputData,
      finalOutput: null,
      stepCount: 0,
      maxSteps,
      startedAt: new Date(),
    };
    this.executions.set(execution.id, execution);
    return execution;
  }

  async updateStatus(id: string, status: ExecutionDTO["status"], errorMessage?: string): Promise<ExecutionDTO> {
    this.statusUpdates.push({ id, status, error: errorMessage });
    const e = this.executions.get(id);
    if (e) {
      e.status = status;
      if (errorMessage) e.errorMessage = errorMessage;
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(status)) e.completedAt = new Date();
    }
    return e!;
  }

  async addStep(executionId: string, step: Omit<ExecutionStepDTO, "id" | "executionId">): Promise<ExecutionStepDTO> {
    const s: ExecutionStepDTO = { ...step, id: `step-${this.steps.length + 1}`, executionId };
    this.steps.push(s);
    const e = this.executions.get(executionId);
    if (e) e.stepCount = step.stepNumber;
    return s;
  }

  async addToolCall(executionId: string, call: Omit<ToolCallDTO, "id" | "executionId" | "executedAt">): Promise<ToolCallDTO> {
    const c: ToolCallDTO = { ...call, id: `tc-${this.toolCalls.length + 1}`, executionId, executedAt: new Date() };
    this.toolCalls.push(c);
    return c;
  }

  async countToolCallsByTool(_userId?: string): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const call of this.toolCalls) counts[call.toolName] = (counts[call.toolName] ?? 0) + 1;
    return counts;
  }

  async findToolCallsByToolName(toolName: string, _userId?: string, limit = 20): Promise<ToolCallDTO[]> {
    return this.toolCalls.filter((c) => c.toolName === toolName).slice(0, limit);
  }

  async setFinalOutput(id: string, output: Record<string, unknown>): Promise<ExecutionDTO> {
    const e = this.executions.get(id);
    if (e) {
      e.finalOutput = output;
      e.status = "COMPLETED";
      e.completedAt = new Date();
    }
    return e!;
  }

  async setRuntimeDetails(
    id: string,
    details: { provider?: string; plannerOutput?: Record<string, unknown>; durationMs?: number }
  ): Promise<ExecutionDTO> {
    this.runtimeDetails.push({ id, details });
    const e = this.executions.get(id);
    if (e) {
      if (details.provider) e.provider = details.provider;
      if (details.plannerOutput) e.plannerOutput = details.plannerOutput;
      if (details.durationMs != null) e.durationMs = details.durationMs;
    }
    return e!;
  }
}
