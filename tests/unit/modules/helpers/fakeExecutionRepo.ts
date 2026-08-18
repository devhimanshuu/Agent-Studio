import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { ExecutionDTO, ExecutionStepDTO, ToolCallDTO, StartExecutionInput, ExecutionQuery } from "@/types/execution";

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

  async countByUserId(userId: string): Promise<number> {
    return [...this.executions.values()].filter((e) => e.userId === userId).length;
  }

  async create(input: StartExecutionInput, maxSteps: number, skillName?: string): Promise<ExecutionDTO> {
    this.seq += 1;
    const execution: ExecutionDTO = {
      id: `exec-${this.seq}`,
      userId: input.userId,
      skillVersionId: input.skillVersionId,
      skillName: skillName ?? null,
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

  async listForUser(userId: string, query: ExecutionQuery): Promise<ExecutionDTO[]> {
    let items = [...this.executions.values()].filter((e) => e.userId === userId);
    if (query.status) items = items.filter((e) => e.status === query.status);
    if (query.skillName) items = items.filter((e) => e.skillName?.toLowerCase().includes(query.skillName!.toLowerCase()));
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          (e.skillName ?? "").toLowerCase().includes(q) ||
          (e.provider ?? "").toLowerCase().includes(q) ||
          (e.errorMessage ?? "").toLowerCase().includes(q)
      );
    }
    const sortBy = query.sortBy ?? "startedAt";
    const dir = query.sortOrder === "asc" ? 1 : -1;
    items.sort((a, b) => {
      const av = a[sortBy as keyof ExecutionDTO];
      const bv = b[sortBy as keyof ExecutionDTO];
      if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
    return items.slice(0, query.limit ?? 100);
  }

  async setReplayedFrom(id: string, replayedFromExecutionId: string): Promise<ExecutionDTO> {
    const e = this.executions.get(id);
    if (e) e.replayedFromExecutionId = replayedFromExecutionId;
    return e!;
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
    const items = [...this.executions.values()].filter((e) => e.userId === userId);
    const total = items.length;
    const completed = items.filter((e) => e.status === "COMPLETED").length;
    const failed = items.filter((e) => e.status === "FAILED" || e.status === "STEP_LIMIT_EXCEEDED").length;
    const cancelled = items.filter((e) => e.status === "CANCELLED").length;
    const paused = items.filter((e) => e.status === "PAUSED_FOR_APPROVAL").length;
    const durations = items.map((e) => e.durationMs).filter((d): d is number => d != null);
    const avgDurationMs =
      durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const skillCounts = new Map<string, number>();
    for (const e of items) skillCounts.set(e.skillName ?? "Unknown skill", (skillCounts.get(e.skillName ?? "Unknown skill") ?? 0) + 1);
    const mostUsedSkills = [...skillCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skillName, count]) => ({ skillName, count }));
    return { total, completed, failed, cancelled, paused, avgDurationMs, mostUsedSkills };
  }

  async getApprovalSummary(_userId: string): Promise<{ total: number; pending: number }> {
    return { total: 0, pending: 0 };
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
