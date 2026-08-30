interface RetryOptions {
  /** Total attempts including the first (must be >= 1). */
  attempts: number;
  /** Delay between attempts in ms. */
  delayMs?: number;
  /** Predicate deciding whether a failure is worth retrying. */
  isRetryable?: (error: unknown) => boolean;
  /** Called before each retry with the attempt number (1-based) + error. */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Default: retry only errors explicitly flagged as retryable (LLMError with
 * retryable=true, tool errors opting in). Non-retryable errors fail fast.
 */
function defaultRetryable(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error as { retryable?: boolean }).retryable === true
  );
}

/** Runs `fn`, retrying up to `attempts` times when the error is retryable. */
export async function withRetries<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { attempts, delayMs = 0, isRetryable = defaultRetryable, onRetry } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryable(error)) throw error;
      onRetry?.(attempt, error);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}
