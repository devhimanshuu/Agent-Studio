import { Prisma } from "@prisma/client";
import { IExecutionLogRepository } from "./interfaces/IExecutionLogRepository";
import { ExecutionLogDTO } from "@/types/execution";
import { prisma } from "@/lib/prisma";

export class ExecutionLogRepository implements IExecutionLogRepository {
  async log(input: {
    executionId: string;
    event: string;
    level?: "INFO" | "WARN" | "ERROR";
    status?: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ExecutionLogDTO> {
    const row = await prisma.executionLog.create({
      data: {
        executionId: input.executionId,
        event: input.event,
        level: input.level ?? "INFO",
        status: input.status,
        durationMs: input.durationMs,
        metadata: (input.metadata ?? {}) as unknown as Prisma.InputJsonValue,
      },
    });
    return this.mapLog(row);
  }

  async findByExecutionId(executionId: string): Promise<ExecutionLogDTO[]> {
    const rows = await prisma.executionLog.findMany({
      where: { executionId },
      orderBy: { timestamp: "asc" },
    });
    return rows.map(this.mapLog);
  }

  private mapLog(row: Prisma.ExecutionLogGetPayload<{}>): ExecutionLogDTO {
    return {
      id: row.id,
      executionId: row.executionId,
      event: row.event,
      level: row.level as ExecutionLogDTO["level"],
      status: row.status,
      durationMs: row.durationMs,
      metadata: row.metadata as Record<string, unknown>,
      timestamp: row.timestamp,
    };
  }
}