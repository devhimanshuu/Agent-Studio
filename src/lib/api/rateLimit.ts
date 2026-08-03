import { NextResponse } from "next/server";

/**
 * In-memory sliding-window rate limiter.
 *
 * Guards expensive/state-changing actions (execution start, replay, resume,
 * approval responses) against bursts and simple abuse. State lives in-process
 * and is pruned on access, so the map never grows unbounded. Suitable for a
 * single-instance deployment; swap for a shared store (Redis/Upstash) when the
 * app scales horizontally.
 */

interface Bucket {
  /** Timestamps (ms) of accepted calls within the window. */
  hits: number[];
}

const WINDOW_MS = 60_000;
const MAX_HITS = 20; // 20 actions / minute / user — generous for real use.

const buckets = new Map<string, Bucket>();

function prune(windowStart: number): void {
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => t >= windowStart);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

/**
 * Checks + records a call for `key`. When the limit is exceeded, returns a
 * 429 response with `Retry-After`; otherwise returns null (caller proceeds).
 */
export function rateLimit(key: string): NextResponse | null {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  prune(windowStart);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t >= windowStart);

  if (bucket.hits.length >= MAX_HITS) {
    const retryAfterSec = Math.ceil((bucket.hits[0] + WINDOW_MS - now) / 1000);
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests — slow down",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, retryAfterSec)) },
      }
    );
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return null;
}
