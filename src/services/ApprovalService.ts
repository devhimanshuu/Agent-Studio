import { IApprovalService } from "./interfaces/IApprovalService";
import { IApprovalRepository } from "@/repositories/interfaces/IApprovalRepository";
import { IAuditLogRepository } from "@/repositories/interfaces/IAuditLogRepository";
import { ApprovalRequestDTO, RespondApprovalInput } from "@/types/approval";
import { logger } from "@/lib/logger";

export class ApprovalService implements IApprovalService {
  constructor(
    private approvalRepo: IApprovalRepository,
    private auditRepo: IAuditLogRepository
  ) {}

  async getApproval(id: string): Promise<ApprovalRequestDTO | null> {
    return this.approvalRepo.findById(id);
  }

  async getPendingApprovals(userId: string): Promise<ApprovalRequestDTO[]> {
    return this.approvalRepo.findPendingByUserId(userId);
  }

  /**
   * Ownership-scoped respond. Loads the request first and rejects when it does
   * not belong to the authenticated user — mirroring the skill/execution routes.
   * The actor recorded on the audit entry is always the authenticated user,
   * never a client-supplied value.
   */
  async respondToApprovalForUser(input: RespondApprovalInput, userId: string): Promise<ApprovalRequestDTO> {
    const existing = await this.approvalRepo.findById(input.approvalId);
    if (!existing || existing.userId !== userId) {
      throw new Error("Approval request not found or you do not have access to it");
    }
    return this.respondToApproval({ ...input, userId });
  }

  async respondToApproval(input: RespondApprovalInput): Promise<ApprovalRequestDTO> {
    logger.info({ approvalId: input.approvalId, approved: input.approved }, "Processing approval response");

    const existing = await this.approvalRepo.findById(input.approvalId);
    if (!existing) {
      throw new Error(`Approval request ${input.approvalId} not found`);
    }

    // Single-use execution token: the presented key must be the one the request
    // was created with. A mismatch means the token belongs to a different
    // request (or was forged) — reject before any state change.
    if (existing.idempotencyKey !== input.idempotencyKey) {
      throw new Error("Invalid idempotency key for this approval request");
    }

    // A request can be responded to exactly once — replaying the same key
    // after a response lands here.
    if (existing.status !== "PENDING") {
      throw new Error(`Approval request is already in status ${existing.status}`);
    }

    const updated = await this.approvalRepo.respond(input);
    if (!updated) {
      // Lost the atomic CAS race to a concurrent response carrying the same
      // key — the key already did its single-use job.
      throw new Error("Approval request was already responded to");
    }

    await this.auditRepo.log({
      userId: input.userId,
      executionId: existing.executionId,
      action: input.approved ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
      details: {
        approvalId: input.approvalId,
        toolName: existing.toolName,
        action: existing.action,
        rejectionReason: input.rejectionReason,
      },
    });

    return updated;
  }
}
