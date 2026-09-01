/**
 * In-memory sliding window rate limiter for API routes.
 *
 * No external services required — uses a simple Map with automatic cleanup.
 * For production, replace with Redis-backed limiter (e.g. @upstash/ratelimit).
 */

import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum requests per window (default: 60) */
  maxRequests: number;
  /** Window duration in milliseconds (default: 60_000 = 1 minute) */
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000,
};

// Per-route config overrides
const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/auth": { maxRequests: 10, windowMs: 60_000 },        // Auth endpoints: strict
  "/api/mcp/sse": { maxRequests: 5, windowMs: 60_000 },      // SSE connections: very strict
  "/api/mcp/messages": { maxRequests: 30, windowMs: 60_000 }, // MCP messages
  "/api/executions": { maxRequests: 20, windowMs: 60_000 },   // Executions: moderate
};

// Store with automatic cleanup
const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 300_000);

/**
 * Get the rate limit config for a given pathname.
 */
function getConfig(pathname: string): RateLimitConfig {
  // Check for exact match first, then prefix match
  if (ROUTE_LIMITS[pathname]) return ROUTE_LIMITS[pathname];

  for (const [prefix, config] of Object.entries(ROUTE_LIMITS)) {
    if (pathname.startsWith(prefix)) return config;
  }

  return DEFAULT_CONFIG;
}

/**
 * Check rate limit for a given key. Returns null if allowed, or a 429 response if exceeded.
 */
export function checkRateLimit(
  key: string,
  config?: Partial<RateLimitConfig>
): NextResponse | null {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();
  const resetAt = now + fullConfig.windowMs;

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt });
    return null;
  }

  entry.count += 1;

  if (entry.count > fullConfig.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMITED",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(fullConfig.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}

/**
 * Rate limit middleware for API route handlers.
 * Extracts the client key from the request (userId or IP fallback).
 *
 * @example
 * ```ts
 * export async function GET(request: Request) {
 *   const rateLimitResponse = await rateLimit(request);
 *   if (rateLimitResponse) return rateLimitResponse;
 *   // ... handle request
 * }
 * ```
 */
export async function rateLimit(
  request: Request,
  config?: Partial<RateLimitConfig>
): Promise<NextResponse | null> {
  const pathname = new URL(request.url).pathname;
  const routeConfig = getConfig(pathname);
  const mergedConfig = { ...routeConfig, ...config };

  // Use userId if available, fall back to IP
  const userId = request.headers.get("x-user-id") || "anonymous";
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const key = `rl:${userId}:${ip}:${pathname}`;

  return checkRateLimit(key, mergedConfig);
}
