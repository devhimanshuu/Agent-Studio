import { ExecutionLogDTO } from "@/types/execution";

export interface IExecutionLogRepository {
  log(input: {
    executionId: string;
    event: string;
    level?: "INFO" | "WARN" | "ERROR";
    status?: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ExecutionLogDTO>;
  findByExecutionId(executionId: string): Promise<ExecutionLogDTO[]>;
}