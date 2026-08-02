import { ApprovalRequestDTO, RespondApprovalInput } from "@/types/approval";

export interface IApprovalService {
  getApproval(id: string): Promise<ApprovalRequestDTO | null>;
  getPendingApprovals(userId: string): Promise<ApprovalRequestDTO[]>;
  respondToApproval(input: RespondApprovalInput): Promise<ApprovalRequestDTO>;
}
