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
