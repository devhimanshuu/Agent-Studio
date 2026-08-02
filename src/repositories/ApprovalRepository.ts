import { Prisma } from "@prisma/client";
import { IApprovalRepository } from "./interfaces/IApprovalRepository";
import { ApprovalRequestDTO, RespondApprovalInput } from "@/types/approval";
import { prisma } from "@/lib/prisma";

export class ApprovalRepository implements IApprovalRepository {
  async findById(id: string): Promise<ApprovalRequestDTO | null> {
    const app = await prisma.approvalRequest.findUnique({ where: { id } });
    return app ? this.mapApproval(app) : null;
  }

  async findByExecutionId(executionId: string): Promise<ApprovalRequestDTO[]> {
    const list = await prisma.approvalRequest.findMany({
      where: { executionId },
      orderBy: { requestedAt: "desc" },
    });
    return list.map(this.mapApproval);
  }

  async findPendingByUserId(userId: string): Promise<ApprovalRequestDTO[]> {
    const list = await prisma.approvalRequest.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { requestedAt: "desc" },
    });
    return list.map(this.mapApproval);
  }

  async create(request: Omit<ApprovalRequestDTO, "id" | "status" | "requestedAt">): Promise<ApprovalRequestDTO> {
    const created = await prisma.approvalRequest.create({
      data: {
        executionId: request.executionId,
        userId: request.userId,
        toolName: request.toolName,
        action: request.action,
        inputPayload: request.inputPayload as unknown as Prisma.InputJsonValue,
        idempotencyKey: request.idempotencyKey,
        status: "PENDING",
      },
    });
    return this.mapApproval(created);
  }

  async respond(input: RespondApprovalInput): Promise<ApprovalRequestDTO> {
    const updated = await prisma.approvalRequest.update({
      where: { id: input.approvalId },
      data: {
        status: input.approved ? "APPROVED" : "REJECTED",
        rejectionReason: input.rejectionReason,
        respondedAt: new Date(),
      },
    });
    return this.mapApproval(updated);
  }

  async findByIdempotencyKey(key: string): Promise<ApprovalRequestDTO | null> {
    const app = await prisma.approvalRequest.findUnique({ where: { idempotencyKey: key } });
    return app ? this.mapApproval(app) : null;
  }

  private mapApproval(a: Prisma.ApprovalRequestGetPayload<{}>): ApprovalRequestDTO {
    return {
      id: a.id,
      executionId: a.executionId,
      userId: a.userId,
      toolName: a.toolName,
      action: a.action,
      inputPayload: a.inputPayload as Record<string, unknown>,
      status: a.status,
      idempotencyKey: a.idempotencyKey,
      requestedAt: a.requestedAt,
      respondedAt: a.respondedAt,
      rejectionReason: a.rejectionReason,
    };
  }
}
