import { ApprovalHistoryDTO, ApprovalHistoryAction } from "@/types/approval";

export interface IApprovalHistoryRepository {
  log(input: {
    approvalId: string;
    executionId: string;
    userId: string;
    action: ApprovalHistoryAction;
    details: Record<string, unknown>;
  }): Promise<ApprovalHistoryDTO>;

  findByApprovalId(approvalId: string): Promise<ApprovalHistoryDTO[]>;
  findByExecutionId(executionId: string): Promise<ApprovalHistoryDTO[]>;
}