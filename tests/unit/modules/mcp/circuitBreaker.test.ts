import { describe, it, expect, vi } from "vitest";
import { CircuitBreaker, CircuitOpenError } from "@/modules/mcp/circuitBreaker";

describe("CircuitBreaker", () => {
  it("starts CLOSED and allows calls", () => {
    const breaker = new CircuitBreaker("s1");
    expect(breaker.state).toBe("CLOSED");
    expect(breaker.allowsCall).toBe(true);
  });

  it("opens after the failure threshold and fails fast", async () => {
    const breaker = new CircuitBreaker("s1", { failureThreshold: 2, resetTimeoutMs: 60_000 });
    const fn = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(breaker.run(fn)).rejects.toThrow("boom");
    await expect(breaker.run(fn)).rejects.toThrow("boom");
    expect(breaker.state).toBe("OPEN");

    // Circuit open — the underlying fn must NOT be invoked.
    await expect(breaker.run(fn)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("recovers through HALF_OPEN after the reset window (probe success closes)", async () => {
    const breaker = new CircuitBreaker("s1", { failureThreshold: 1, resetTimeoutMs: 5 });
    await expect(breaker.run(async () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    expect(breaker.state).toBe("OPEN");

    await vi.waitFor(() => {
      expect(breaker.state).toBe("HALF_OPEN");
    });

    const result = await breaker.run(async () => "recovered");
    expect(result).toBe("recovered");
    expect(breaker.state).toBe("CLOSED");
  });

  it("re-opens when the half-open probe fails", async () => {
    const breaker = new CircuitBreaker("s1", { failureThreshold: 1, resetTimeoutMs: 5 });
    await expect(breaker.run(async () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    await vi.waitFor(() => {
      expect(breaker.state).toBe("HALF_OPEN");
    });
    await expect(breaker.run(async () => Promise.reject(new Error("still down")))).rejects.toThrow("still down");
    expect(breaker.state).toBe("OPEN");
  });

  it("resets failure count on success and tracks success rate", async () => {
    const breaker = new CircuitBreaker("s1", { failureThreshold: 3 });
    await breaker.run(async () => "ok");
    expect(breaker.successRate).toBe(1);
    await breaker.run(async () => Promise.reject(new Error("x"))).catch(() => {});
    await breaker.run(async () => "ok");
    // One failure then a success — the success clears the failure streak.
    expect(breaker.state).toBe("CLOSED");
    expect(breaker.stats.totalCalls).toBe(3);
  });

  it("supports manual trip and reset", async () => {
    const breaker = new CircuitBreaker("s1");
    breaker.trip();
    expect(breaker.state).toBe("OPEN");
    expect(() => breaker.run(async () => 1)).rejects.toBeInstanceOf(CircuitOpenError);

    breaker.reset();
    expect(breaker.state).toBe("CLOSED");
    await expect(breaker.run(async () => 1)).resolves.toBe(1);
  });
});
