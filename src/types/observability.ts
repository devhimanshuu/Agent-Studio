/** A single event on the execution timeline, ordered by time. */
export interface TimelineEvent {
  id: string;
  at: Date | string;
  type: "execution" | "node" | "tool" | "approval" | "log";
  label: string;
  status?: string;
  /** Human-readable detail (e.g. "calculator · add", approval decision). */
  detail?: string;
  durationMs?: number;
  /** Raw metadata for the export / detail view. */
  metadata?: Record<string, unknown>;
}

/** Filters for the audit log query. */
export interface AuditQuery {
  search?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
}

/** Aggregated observability widgets (dashboard + /dashboard/history). */
export interface ObservabilityMetrics {
  totalExecutions: number;
  successRate: number;
  failureRate: number;
  avgExecutionTimeMs: number;
  mostUsedSkills: { skillName: string; count: number }[];
  mostUsedTools: { toolName: string; count: number }[];
  approvalCount: number;
  pendingApprovalCount: number;
  executionsByStatus: Record<string, number>;
}

/** Serializable version diff payload for the export/compare API. */
export interface VersionDiffResult {
  skillId: string;
  skillName: string;
  versionA: { id: string; versionNumber: number; status: string; createdAt: Date };
  versionB: { id: string; versionNumber: number; status: string; createdAt: Date };
  changes: { field: string; kind: "added" | "removed" | "modified"; oldValue?: unknown; newValue?: unknown }[];
  identical: boolean;
}
