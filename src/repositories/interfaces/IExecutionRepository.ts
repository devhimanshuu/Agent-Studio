import { ExecutionDTO, ExecutionStepDTO, ToolCallDTO, StartExecutionInput } from "@/types/execution";

export interface IExecutionRepository {
  findById(id: string): Promise<ExecutionDTO | null>;
  findByUserId(userId: string): Promise<ExecutionDTO[]>;
  create(input: StartExecutionInput, maxSteps: number): Promise<ExecutionDTO>;
  updateStatus(id: string, status: ExecutionDTO["status"], errorMessage?: string): Promise<ExecutionDTO>;
  addStep(executionId: string, step: Omit<ExecutionStepDTO, "id">): Promise<ExecutionStepDTO>;
  addToolCall(executionId: string, toolCall: Omit<ToolCallDTO, "id" | "executedAt">): Promise<ToolCallDTO>;
  setFinalOutput(id: string, output: Record<string, unknown>): Promise<ExecutionDTO>;
}
