import { ExecutionDTO, StartExecutionInput } from "@/types/execution";

export interface IExecutionService {
  getExecution(id: string): Promise<ExecutionDTO | null>;
  getUserExecutions(userId: string): Promise<ExecutionDTO[]>;
  startExecution(input: StartExecutionInput): Promise<ExecutionDTO>;
  cancelExecution(id: string): Promise<ExecutionDTO>;
}
