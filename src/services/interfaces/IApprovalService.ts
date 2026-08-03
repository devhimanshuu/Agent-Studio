import { ApprovalRequestDTO, RespondApprovalInput } from "@/types/approval";

export interface IApprovalService {
  getApproval(id: string): Promise<ApprovalRequestDTO | null>;
  getPendingApprovals(userId: string): Promise<ApprovalRequestDTO[]>;
  respondToApproval(input: RespondApprovalInput): Promise<ApprovalRequestDTO>;
  /** Ownership-scoped respond — throws when the request doesn't belong to `userId`. */
  respondToApprovalForUser(input: RespondApprovalInput, userId: string): Promise<ApprovalRequestDTO>;
}
