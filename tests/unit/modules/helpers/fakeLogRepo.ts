import { IExecutionLogRepository } from "@/repositories/interfaces/IExecutionLogRepository";
import { ExecutionLogDTO } from "@/types/execution";

/** In-memory execution log repository for tests. */
export class FakeLogRepo implements IExecutionLogRepository {
  logs: ExecutionLogDTO[] = [];
  private seq = 0;

  async log(input: {
    executionId: string;
    event: string;
    level?: "INFO" | "WARN" | "ERROR";
    status?: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ExecutionLogDTO> {
    this.seq += 1;
    const row: ExecutionLogDTO = {
      id: `log-${this.seq}`,
      executionId: input.executionId,
      event: input.event,
      level: input.level ?? "INFO",
      status: input.status ?? null,
      durationMs: input.durationMs ?? null,
      metadata: input.metadata ?? {},
      timestamp: new Date(),
    };
    this.logs.push(row);
    return row;
  }

  async findByExecutionId(executionId: string): Promise<ExecutionLogDTO[]> {
    return this.logs.filter((l) => l.executionId === executionId);
  }
}
