import { Prisma } from "@prisma/client";
import { IApprovalRepository } from "./interfaces/IApprovalRepository";
import { ApprovalRequestDTO, RespondApprovalInput } from "@/types/approval";
import { prisma } from "@/lib/prisma";
import { ensureUserExists } from "@/lib/user";

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

  /** Single query — avoids the N+1 the review page previously triggered by
   * loading all executions and querying approvals per execution. */
  async findByUserId(userId: string): Promise<ApprovalRequestDTO[]> {
    const list = await prisma.approvalRequest.findMany({
      where: { userId },
      orderBy: { requestedAt: "desc" },
    });
    return list.map(this.mapApproval);
  }

  async create(request: Omit<ApprovalRequestDTO, "id" | "status" | "requestedAt">): Promise<ApprovalRequestDTO> {
    await ensureUserExists(request.userId);
    const created = await prisma.approvalRequest.create({
      data: {
        executionId: request.executionId,
        userId: request.userId,
        skillName: request.skillName ?? null,
        plannerReason: request.plannerReason ?? null,
        toolName: request.toolName,
        action: request.action,
        inputPayload: request.inputPayload as unknown as Prisma.InputJsonValue,
        idempotencyKey: request.idempotencyKey,
        status: "PENDING",
      },
    });
    return this.mapApproval(created);
  }

  /** Race-proof create — concurrent creators for the same key resolve to one row. */
  async upsertByIdempotencyKey(
    request: Omit<ApprovalRequestDTO, "id" | "status" | "requestedAt">
  ): Promise<ApprovalRequestDTO> {
    await ensureUserExists(request.userId);
    const row = await prisma.approvalRequest.upsert({
      where: { idempotencyKey: request.idempotencyKey },
      update: {}, // already exists — keep the original row untouched
      create: {
        executionId: request.executionId,
        userId: request.userId,
        skillName: request.skillName ?? null,
        plannerReason: request.plannerReason ?? null,
        toolName: request.toolName,
        action: request.action,
        inputPayload: request.inputPayload as unknown as Prisma.InputJsonValue,
        idempotencyKey: request.idempotencyKey,
        status: "PENDING",
      },
    });
    return this.mapApproval(row);
  }

  async respond(input: RespondApprovalInput): Promise<ApprovalRequestDTO | null> {
    // Atomic compare-and-swap: only a PENDING request may be responded to.
    // `updateMany` (not `update`) guards the PENDING→terminal transition in
    // the database, so two concurrent responses carrying the same idempotency
    // key can never both win — exactly one UPDATE matches, the loser gets
    // count 0 and returns null. A plain `update` would race (both read PENDING,
    // both write) and could even flip an APPROVED row back to REJECTED.
    const result = await prisma.approvalRequest.updateMany({
      where: { id: input.approvalId, status: "PENDING" },
      data: {
        status: input.approved ? "APPROVED" : "REJECTED",
        rejectionReason: input.rejectionReason,
        respondedAt: new Date(),
      },
    });

    if (result.count === 0) return null;

    const updated = await prisma.approvalRequest.findUnique({
      where: { id: input.approvalId },
    });
    return updated ? this.mapApproval(updated) : null;
  }

  async findByIdempotencyKey(key: string): Promise<ApprovalRequestDTO | null> {
    const app = await prisma.approvalRequest.findUnique({ where: { idempotencyKey: key } });
    return app ? this.mapApproval(app) : null;
  }

  async expireByIdempotencyKey(key: string): Promise<void> {
    await prisma.approvalRequest.updateMany({
      where: { idempotencyKey: key, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
  }

  /**
   * Expire PENDING approvals older than `olderThanMs` for one user.
   *
   * The graph runtime's escalateAfterMin timer is in-process only — a deploy
   * or serverless freeze loses it and the request sits in the queue forever.
   * Calling this opportunistically when the review queue loads makes expiry
   * eventually-consistent without needing a cron.
   */
  async expireStaleForUser(userId: string, olderThanMs = 24 * 60 * 60_000): Promise<number> {
    const result = await prisma.approvalRequest.updateMany({
      where: {
        userId,
        status: "PENDING",
        requestedAt: { lt: new Date(Date.now() - olderThanMs) },
      },
      data: { status: "EXPIRED", rejectionReason: "Expired — no response within the review window" },
    });
    return result.count;
  }

  private mapApproval(a: Prisma.ApprovalRequestGetPayload<{}>): ApprovalRequestDTO {
    return {
      id: a.id,
      executionId: a.executionId,
      userId: a.userId,
      skillName: a.skillName,
      plannerReason: a.plannerReason,
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
