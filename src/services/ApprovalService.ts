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

  async respondToApproval(input: RespondApprovalInput): Promise<ApprovalRequestDTO> {
    logger.info({ approvalId: input.approvalId, approved: input.approved }, "Processing approval response");

    const existing = await this.approvalRepo.findById(input.approvalId);
    if (!existing) {
      throw new Error(`Approval request ${input.approvalId} not found`);
    }

    if (existing.status !== "PENDING") {
      throw new Error(`Approval request is already in status ${existing.status}`);
    }

    const updated = await this.approvalRepo.respond(input);

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
