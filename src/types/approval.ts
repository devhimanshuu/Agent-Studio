export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface ApprovalRequestDTO {
  id: string;
  executionId: string;
  userId: string;
  toolName: string;
  action: string;
  inputPayload: Record<string, unknown>;
  status: ApprovalStatus;
  idempotencyKey: string;
  requestedAt: Date;
  respondedAt?: Date | null;
  rejectionReason?: string | null;
}

export interface RespondApprovalInput {
  approvalId: string;
  userId: string;
  approved: boolean;
  rejectionReason?: string;
  idempotencyKey: string;
}
