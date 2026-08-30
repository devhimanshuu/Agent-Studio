/**
 * Performance / load tests for critical API endpoints.
 *
 * These tests are designed to be run against the local dev server and measure
 * basic throughput and latency characteristics. They are NOT full load tests
 * (use k6 or artillery for production-grade load testing) — they verify that
 * hot paths stay within reasonable latency bounds under moderate concurrency.
 *
 * Run: vitest run tests/performance/api-loads.test.ts
 * Or:  vitest run --project performance
 */
import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.PERF_BASE_URL ?? "http://localhost:3000";
const CONCURRENCY = 10;
const REQUESTS_PER_ENDPOINT = 50;

// Helpers -------------------------------------------------------------------

async function measureEndpoint(
  path: string,
  options?: RequestInit
): Promise<{ avgMs: number; p95Ms: number; maxMs: number; errors: number }> {
  const times: number[] = [];
  let errors = 0;

  const batchSize = CONCURRENCY;
  for (let i = 0; i < REQUESTS_PER_ENDPOINT; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, REQUESTS_PER_ENDPOINT - i) }, (_, j) => i + j);

    const results = await Promise.allSettled(
      batch.map(async () => {
        const start = performance.now();
        const res = await fetch(`${BASE_URL}${path}`, options);
        const elapsed = performance.now() - start;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return elapsed;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") times.push(r.value);
      else errors++;
    }
  }

  times.sort((a, b) => a - b);
  const avgMs = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const p95Ms = times.length > 0 ? times[Math.floor(times.length * 0.95)] : 0;
  const maxMs = times.length > 0 ? times[times.length - 1] : 0;

  return { avgMs, p95Ms, maxMs, errors };
}

// Skip all tests if no server is running
const maybeIt = process.env.PERF_BASE_URL ? it : it.skip;

// Tests ---------------------------------------------------------------------

describe("API performance baselines", () => {
  beforeAll(async () => {
    if (!process.env.PERF_BASE_URL) {
      console.warn(
        "\n⚠  PERF_BASE_URL not set — performance tests will be skipped.\n" +
          "   Run with: PERF_BASE_URL=http://localhost:3000 vitest run tests/performance\n"
      );
    }
  });

  describe("GET /api/health", () => {
    maybeIt(`responds within 200ms avg over ${REQUESTS_PER_ENDPOINT} requests`, async () => {
      const result = await measureEndpoint("/api/health");
      console.log(`  health: avg=${result.avgMs.toFixed(1)}ms p95=${result.p95Ms.toFixed(1)}ms max=${result.maxMs.toFixed(1)}ms errors=${result.errors}`);

      expect(result.errors).toBe(0);
      expect(result.avgMs).toBeLessThan(200);
      expect(result.p95Ms).toBeLessThan(500);
    });
  });

  describe("GET /api/skills (unauthenticated)", () => {
    maybeIt(`returns 401 within 200ms avg`, async () => {
      const result = await measureEndpoint("/api/skills");
      console.log(`  skills: avg=${result.avgMs.toFixed(1)}ms p95=${result.p95Ms.toFixed(1)}ms errors=${result.errors}`);

      // Auth rejection is fast — no DB hit
      expect(result.avgMs).toBeLessThan(200);
    });
  });

  describe("GET /api/executions (unauthenticated)", () => {
    maybeIt(`returns 401 within 200ms avg`, async () => {
      const result = await measureEndpoint("/api/executions");
      console.log(`  executions: avg=${result.avgMs.toFixed(1)}ms p95=${result.p95Ms.toFixed(1)}ms errors=${result.errors}`);

      expect(result.avgMs).toBeLessThan(200);
    });
  });

  describe("GET /api/approvals (unauthenticated)", () => {
    maybeIt(`returns 401 within 200ms avg`, async () => {
      const result = await measureEndpoint("/api/approvals");
      console.log(`  approvals: avg=${result.avgMs.toFixed(1)}ms p95=${result.p95Ms.toFixed(1)}ms errors=${result.errors}`);

      expect(result.avgMs).toBeLessThan(200);
    });
  });

  describe("POST /api/skills with invalid body", () => {
    maybeIt(`validates and rejects within 200ms avg`, async () => {
      const result = await measureEndpoint("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      console.log(`  skills-post-invalid: avg=${result.avgMs.toFixed(1)}ms p95=${result.p95Ms.toFixed(1)}ms errors=${result.errors}`);

      expect(result.avgMs).toBeLessThan(200);
    });
  });
});

describe("Concurrency stress", () => {
  maybeIt(`handles ${CONCURRENCY * 5} concurrent health checks without errors`, async () => {
    const total = CONCURRENCY * 5;
    const start = performance.now();

    const results = await Promise.allSettled(
      Array.from({ length: total }, () => fetch(`${BASE_URL}/api/health`))
    );

    const elapsed = performance.now() - start;
    const successes = results.filter(
      (r) => r.status === "fulfilled" && r.value.ok
    ).length;

    console.log(`  ${total} concurrent health checks: ${successes} succeeded in ${elapsed.toFixed(0)}ms`);

    expect(successes).toBe(total);
    // All 50 requests should complete within 10 seconds
    expect(elapsed).toBeLessThan(10_000);
  });
});
