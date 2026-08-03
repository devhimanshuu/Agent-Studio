import { Prisma } from "@prisma/client";
import { IApprovalHistoryRepository } from "./interfaces/IApprovalHistoryRepository";
import { ApprovalHistoryDTO, ApprovalHistoryAction } from "@/types/approval";
import { prisma } from "@/lib/prisma";

export class ApprovalHistoryRepository implements IApprovalHistoryRepository {
  async log(input: {
    approvalId: string;
    executionId: string;
    userId: string;
    action: ApprovalHistoryAction;
    details: Record<string, unknown>;
  }): Promise<ApprovalHistoryDTO> {
    const row = await prisma.approvalHistory.create({
      data: {
        approvalId: input.approvalId,
        executionId: input.executionId,
        userId: input.userId,
        action: input.action,
        details: input.details as unknown as Prisma.InputJsonValue,
      },
    });
    return this.mapHistory(row);
  }

  async findByApprovalId(approvalId: string): Promise<ApprovalHistoryDTO[]> {
    const rows = await prisma.approvalHistory.findMany({
      where: { approvalId },
      orderBy: { timestamp: "asc" },
    });
    return rows.map(this.mapHistory);
  }

  async findByExecutionId(executionId: string): Promise<ApprovalHistoryDTO[]> {
    const rows = await prisma.approvalHistory.findMany({
      where: { executionId },
      orderBy: { timestamp: "asc" },
    });
    return rows.map(this.mapHistory);
  }

  private mapHistory(row: Prisma.ApprovalHistoryGetPayload<{}>): ApprovalHistoryDTO {
    return {
      id: row.id,
      approvalId: row.approvalId,
      executionId: row.executionId,
      userId: row.userId,
      action: row.action as ApprovalHistoryAction,
      details: row.details as Record<string, unknown>,
      timestamp: row.timestamp,
    };
  }
}