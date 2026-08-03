import { ExecutionDTO, StartExecutionInput } from "@/types/execution";

export interface IExecutionService {
  getExecution(id: string): Promise<ExecutionDTO | null>;
  /** Scoped to the owning user — returns null when the execution belongs to someone else. */
  getExecutionForUser(id: string, userId: string): Promise<ExecutionDTO | null>;
  getUserExecutions(userId: string): Promise<ExecutionDTO[]>;
  startExecution(input: StartExecutionInput): Promise<ExecutionDTO>;
  /** Cancels an execution. `userId` (when known) is recorded on the audit entry. */
  cancelExecution(id: string, userId?: string): Promise<ExecutionDTO>;
  /** Ownership-scoped cancel — throws when the execution belongs to someone else. */
  cancelExecutionForUser(id: string, userId: string): Promise<ExecutionDTO>;
}
