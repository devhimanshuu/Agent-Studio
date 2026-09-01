/**
 * Typed API error classes.
 *
 * Services and repositories should throw these instead of plain Error
 * so that handleApiError can map them to the correct HTTP status without
 * fragile message-string matching.
 *
 * Legacy plain Error throws with "not found" / "access" in the message
 * will still be caught by handleApiError's fallback, but those should
 * be migrated over time.
 */

/** Resource not found → 404 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Insufficient permissions → 403 */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Invalid input → 400 */
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

/** Not authenticated → 401 */
export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Type guard — checks if a value is an instance of any known API error class.
 */
export function isApiError(error: unknown): error is NotFoundError | ForbiddenError | BadRequestError | UnauthorizedError {
  return (
    error instanceof NotFoundError ||
    error instanceof ForbiddenError ||
    error instanceof BadRequestError ||
    error instanceof UnauthorizedError
  );
}
