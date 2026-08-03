/**
 * Error taxonomy for the execution runtime. The ExecutionEngine maps these to
 * persisted execution statuses + error messages.
 */
export type ExecutionErrorCode =
  | "INVALID_SKILL"
  | "INVALID_INPUT"
  | "UNAUTHORIZED_TOOL"
  | "STEP_LIMIT_EXCEEDED"
  | "PROVIDER_FAILURE"
  | "TIMEOUT"
  | "CANCELLED"
  | "GRAPH_FAILURE"
  | "TOOL_FAILURE";

export class ExecutionError extends Error {
  readonly code: ExecutionErrorCode;
  constructor(message: string, code: ExecutionErrorCode) {
    super(message);
    this.name = "ExecutionError";
    this.code = code;
  }
}

export class InvalidSkillError extends ExecutionError {
  constructor(message: string) {
    super(message, "INVALID_SKILL");
  }
}

export class InvalidInputError extends ExecutionError {
  constructor(message: string) {
    super(message, "INVALID_INPUT");
  }
}

export class UnauthorizedToolError extends ExecutionError {
  constructor(toolName: string, reason: string) {
    super(`Unauthorized tool: ${toolName} (${reason})`, "UNAUTHORIZED_TOOL");
  }
}

export class StepLimitExceededError extends ExecutionError {
  constructor(message: string) {
    super(message, "STEP_LIMIT_EXCEEDED");
  }
}

export class ExecutionTimeoutError extends ExecutionError {
  constructor(message: string) {
    super(message, "TIMEOUT");
  }
}

export class ExecutionCancelledError extends ExecutionError {
  constructor(message: string) {
    super(message, "CANCELLED");
  }
}

export class ToolExecutionError extends ExecutionError {
  readonly toolName: string;
  constructor(toolName: string, message: string) {
    super(`Tool "${toolName}" failed: ${message}`, "TOOL_FAILURE");
    this.toolName = toolName;
  }
}

/** Safe one-line error message extraction (never leaks stack traces). */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown failure";
}
