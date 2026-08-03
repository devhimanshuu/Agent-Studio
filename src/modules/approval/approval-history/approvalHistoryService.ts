import { IApprovalHistoryRepository } from "@/repositories/interfaces/IApprovalHistoryRepository";
import { ApprovalHistoryDTO } from "@/types/approval";

export interface TimelineEntry {
  action: ApprovalHistoryDTO["action"];
  timestamp: Date;
  summary: string;
  details: Record<string, unknown>;
}

const ACTION_LABELS: Record<ApprovalHistoryDTO["action"], string> = {
  CREATED: "Review requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  RESUMED: "Execution resumed",
};

export class ApprovalHistoryService {
  constructor(private historyRepo: IApprovalHistoryRepository) {}

  async getTimeline(approvalId: string): Promise<TimelineEntry[]> {
    const history = await this.historyRepo.findByApprovalId(approvalId);
    return history.map((entry) => ({
      action: entry.action,
      timestamp: entry.timestamp,
      summary: ACTION_LABELS[entry.action] ?? entry.action,
      details: entry.details,
    }));
  }

  async getExecutionTimeline(executionId: string): Promise<TimelineEntry[]> {
    const history = await this.historyRepo.findByExecutionId(executionId);
    return history.map((entry) => ({
      action: entry.action,
      timestamp: entry.timestamp,
      summary: ACTION_LABELS[entry.action] ?? entry.action,
      details: entry.details,
    }));
  }
}