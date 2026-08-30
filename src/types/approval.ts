export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export type ApprovalHistoryAction =
  | "CREATED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "RESUMED";

export interface ApprovalRequestDTO {
  id: string;
  executionId: string;
  userId: string;
  skillName?: string | null;
  plannerReason?: string | null;
  toolName: string;
  action: string;
  inputPayload: Record<string, unknown>;
  status: ApprovalStatus;
  idempotencyKey: string;
  requestedAt: Date;
  respondedAt?: Date | null;
  rejectionReason?: string | null;
  /** Expanded relations for the review detail page (loaded when needed). */
  history?: ApprovalTimelineEntryDTO[];
}

export interface ApprovalHistoryDTO {
  id: string;
  approvalId: string;
  executionId: string;
  userId: string;
  action: ApprovalHistoryAction;
  details: Record<string, unknown>;
  timestamp: Date;
}

/** Human-readable audit entry (see ApprovalHistoryService.getTimeline). */
export interface ApprovalTimelineEntryDTO {
  action: ApprovalHistoryAction;
  timestamp: Date;
  summary: string;
  details: Record<string, unknown>;
}

export interface RespondApprovalInput {
  approvalId: string;
  userId: string;
  approved: boolean;
  rejectionReason?: string;
  idempotencyKey: string;
}

export interface ApprovalPolicy {
  /** Always require human review for this tool action. */
  alwaysRequireApproval: boolean;
  /** Never require human review for this tool action. */
  neverRequireApproval: boolean;
  /** Tool-based: require approval for specific tool names. */
  toolBasedApproval: string[];
  /** Skill-based: require approval for specific skill IDs. */
  skillBasedApproval: string[];
}