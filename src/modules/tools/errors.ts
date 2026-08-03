/** Base class for all tool-framework failures. Not an `ExecutionError` — the
 * runtime treats unexpected tool errors as retryable (transient), while the
 * specific subclasses below opt out of retries. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

export class ToolNotFoundError extends ToolError {
  constructor(toolName: string) {
    super(`Tool "${toolName}" is not registered`);
    this.name = "ToolNotFoundError";
  }
}

export class ToolDisabledError extends ToolError {
  constructor(toolName: string) {
    super(`Tool "${toolName}" is disabled`);
    this.name = "ToolDisabledError";
  }
}

/** Input failed the tool's Zod validation. Never retried. */
export class ToolValidationError extends ToolError {
  readonly toolName: string;
  readonly issues: string[];
  constructor(toolName: string, issues: string[]) {
    super(`Invalid input for tool "${toolName}": ${issues.join("; ")}`);
    this.name = "ToolValidationError";
    this.toolName = toolName;
    this.issues = issues;
  }
}

/** Tool exceeded its wall-clock budget. Never retried. */
export class ToolTimeoutError extends ToolError {
  readonly toolName: string;
  constructor(toolName: string, timeoutMs: number) {
    super(`Tool "${toolName}" timed out after ${timeoutMs}ms`);
    this.name = "ToolTimeoutError";
    this.toolName = toolName;
  }
}

/** The tool's execute() rejected. Message = the underlying failure, un-nested
 * (the graph node adds its own `Tool "x" failed:` wrapper). */
export class ToolExecutionFailureError extends ToolError {
  readonly toolName: string;
  constructor(toolName: string, message: string) {
    super(message);
    this.name = "ToolExecutionFailureError";
    this.toolName = toolName;
  }
}
