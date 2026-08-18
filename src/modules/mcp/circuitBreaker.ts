/**
 * Circuit breaker for external MCP RPC calls.
 *
 * After `failureThreshold` consecutive failures the circuit OPENS and all
 * calls fail fast (with a CircuitOpenError) until `resetTimeoutMs` elapses.
 * After the reset window, a single probe call decides whether the circuit
 * HALF-OPENS (success → CLOSED) or re-OPENS (failure → back to OPEN).
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitOpenError extends Error {
  readonly serverId: string;
  constructor(serverId: string) {
    super(`MCP server "${serverId}" circuit is open — skipping calls until it recovers`);
    this.name = "CircuitOpenError";
    this.serverId = serverId;
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens. Default 3. */
  failureThreshold?: number;
  /** Window (ms) the circuit stays open before a probe is allowed. Default 30s. */
  resetTimeoutMs?: number;
}

interface Bucket {
  failures: number;
  successes: number;
  openedAt: number | null;
  state: CircuitState;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  totalCalls: number;
}

export class CircuitBreaker {
  private bucket: Bucket;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(
    private readonly serverId: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.bucket = this.emptyBucket();
  }

  private emptyBucket(): Bucket {
    return {
      failures: 0,
      successes: 0,
      openedAt: null,
      state: "CLOSED",
      lastFailureAt: null,
      lastSuccessAt: null,
      totalCalls: 0,
    };
  }

  get state(): CircuitState {
    this.maybeTransition();
    return this.bucket.state;
  }

  /** True when a call is allowed to proceed. */
  get allowsCall(): boolean {
    return this.state !== "OPEN";
  }

  /** Success rate over the current window (0-1), for the dashboard. */
  get successRate(): number {
    const total = this.bucket.successes + this.bucket.failures;
    if (total === 0) return 1;
    return this.bucket.successes / total;
  }

  get stats(): { state: CircuitState; successRate: number; totalCalls: number; openedAt: number | null } {
    return {
      state: this.state,
      successRate: this.successRate,
      totalCalls: this.bucket.totalCalls,
      openedAt: this.bucket.openedAt,
    };
  }

  /**
   * Run `fn` guarded by the circuit. When the circuit is OPEN the call is
   * rejected with CircuitOpenError without invoking `fn`.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.allowsCall) {
      throw new CircuitOpenError(this.serverId);
    }
    this.bucket.totalCalls += 1;
    try {
      const value = await fn();
      this.recordSuccess();
      return value;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /** Record a successful external call. */
  recordSuccess(): void {
    this.bucket.successes += 1;
    this.bucket.lastSuccessAt = Date.now();
    if (this.bucket.state === "HALF_OPEN") {
      // Probe succeeded — close the circuit and reset the window.
      this.bucket = { ...this.emptyBucket(), successes: 1, lastSuccessAt: this.bucket.lastSuccessAt, totalCalls: this.bucket.totalCalls };
      this.bucket.state = "CLOSED";
    } else {
      this.bucket.failures = 0;
    }
  }

  /** Record a failed external call. */
  recordFailure(): void {
    this.bucket.failures += 1;
    this.bucket.lastFailureAt = Date.now();
    if (this.bucket.state === "HALF_OPEN") {
      // Probe failed — back to OPEN for another full reset window.
      this.bucket.state = "OPEN";
      this.bucket.openedAt = Date.now();
      return;
    }
    if (this.bucket.failures >= this.failureThreshold) {
      this.bucket.state = "OPEN";
      this.bucket.openedAt = Date.now();
    }
  }

  /** Manually trip the circuit (e.g. connection-level failure). */
  trip(): void {
    this.bucket.state = "OPEN";
    this.bucket.openedAt = Date.now();
  }

  /** Manually close the circuit (e.g. after a successful reconnect). */
  reset(): void {
    const totalCalls = this.bucket.totalCalls;
    this.bucket = this.emptyBucket();
    this.bucket.totalCalls = totalCalls;
  }

  /** Open → HALF_OPEN after the reset window elapses (probe allowed). */
  private maybeTransition(): void {
    if (
      this.bucket.state === "OPEN" &&
      this.bucket.openedAt !== null &&
      Date.now() - this.bucket.openedAt >= this.resetTimeoutMs
    ) {
      this.bucket.state = "HALF_OPEN";
    }
  }
}
