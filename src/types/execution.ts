export type ExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "PAUSED_FOR_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "STEP_LIMIT_EXCEEDED";

export type StepStatus =
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED"
  | "AWAITING_APPROVAL";

export interface ToolCallDTO {
  id: string;
  executionId: string;
  stepId?: string | null;
  toolName: string;
  action: string;
  inputArgs: Record<string, unknown>;
  outputResult?: Record<string, unknown> | null;
  status: "SUCCESS" | "ERROR" | "BLOCKED" | "REJECTED";
  errorMessage?: string | null;
  /** Wall-clock execution time of the tool call in ms. */
  durationMs?: number | null;
  executedAt: Date;
}

export interface ExecutionStepDTO {
  id: string;
  executionId: string;
  stepNumber: number;
  nodeName: string;
  stateSnapshot: Record<string, unknown>;
  status: StepStatus;
  startedAt: Date;
  completedAt?: Date | null;
  toolCalls?: ToolCallDTO[];
}

export interface ExecutionLogDTO {
  id: string;
  executionId: string;
  event: string;
  level: "INFO" | "WARN" | "ERROR";
  status?: string | null;
  durationMs?: number | null;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface ExecutionDTO {
  id: string;
  userId: string;
  skillVersionId: string;
  /** Denormalized skill name for history/search/metrics. */
  skillName?: string | null;
  /** Set when this run was created by replaying a previous execution. */
  replayedFromExecutionId?: string | null;
  /** Organization ID if executed in an organization context. */
  organizationId?: string | null;
  status: ExecutionStatus;
  inputData: Record<string, unknown>;
  finalOutput?: Record<string, unknown> | null;
  /** Plan produced by the planner node (execution timeline / UI). */
  plannerOutput?: Record<string, unknown> | null;
  /** LLM provider/model that served the planner, e.g. `groq/llama-3.3-70b-versatile`. */
  provider?: string | null;
  /** Wall-clock duration of the run in ms. */
  durationMs?: number | null;
  stepCount: number;
  maxSteps: number;
  errorMessage?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
  steps?: ExecutionStepDTO[];
  toolCalls?: ToolCallDTO[];
  /** Structured execution logs (observability). */
  logs?: ExecutionLogDTO[];
}

export interface ExecutionQuery {
  search?: string;
  status?: ExecutionStatus | "";
  skillName?: string;
  /** Filter to executions of one skill version (canvas replay + coverage). */
  skillVersionId?: string;
  provider?: string;
  from?: string;
  to?: string;
  sortBy?: "startedAt" | "durationMs" | "status";
  sortOrder?: "asc" | "desc";
  limit?: number;
}

export interface StartExecutionInput {
  userId: string;
  skillVersionId: string;
  inputData: Record<string, unknown>;
  organizationId?: string | null;
  /**
   * Deterministic replay for graph versions: recorded LLM outputs keyed by
   * node id, replayed instead of re-invoking the model.
   */
  replayOutputs?: Record<string, unknown>;
}
