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

export interface ExecutionDTO {
  id: string;
  userId: string;
  skillVersionId: string;
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
}

export interface StartExecutionInput {
  userId: string;
  skillVersionId: string;
  inputData: Record<string, unknown>;
}
