import { ExecutionDTO, ExecutionStepDTO, ToolCallDTO, StartExecutionInput } from "@/types/execution";

export interface IExecutionRepository {
  findById(id: string): Promise<ExecutionDTO | null>;
  /** Scoped to the owning user — returns null when the execution belongs to someone else. */
  findByIdForUser(id: string, userId: string): Promise<ExecutionDTO | null>;
  findByUserId(userId: string): Promise<ExecutionDTO[]>;
  create(input: StartExecutionInput, maxSteps: number): Promise<ExecutionDTO>;
  updateStatus(id: string, status: ExecutionDTO["status"], errorMessage?: string): Promise<ExecutionDTO>;
  addStep(executionId: string, step: Omit<ExecutionStepDTO, "id" | "executionId">): Promise<ExecutionStepDTO>;
  addToolCall(executionId: string, toolCall: Omit<ToolCallDTO, "id" | "executionId" | "executedAt">): Promise<ToolCallDTO>;
  setFinalOutput(id: string, output: Record<string, unknown>): Promise<ExecutionDTO>;
  /** Persist runtime details captured during execution (provider used, plan, duration). */
  setRuntimeDetails(
    id: string,
    details: { provider?: string; plannerOutput?: Record<string, unknown>; durationMs?: number }
  ): Promise<ExecutionDTO>;
}
