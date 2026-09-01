/**
 * Core fetch utilities — retry, timeout, and backoff.
 *
 * Domain-specific fetchers have moved to src/lib/catalogs/:
 *   - mcp-catalog.ts   (Awesome MCP servers)
 *   - smithery.ts      (Smithery registry)
 *   - composio.ts      (Composio toolkits & tools)
 *   - sitemaps.ts      (mcp.so / Glama sitemaps)
 *   - arcade.ts        (Arcade integrations)
 *   - github.ts        (GitHub API)
 *
 * This file re-exports everything for backwards compatibility.
 */

// ────────────── Generic Fetch with Retry ──────────────

interface FetchWithRetryOptions {
  /** Maximum retry attempts (default: 3) */
  retries?: number;
  /** Base delay between retries in ms (default: 1000) */
  retryDelayMs?: number;
  /** Request timeout in ms (default: 10000) */
  timeoutMs?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Next.js cache config */
  next?: { revalidate?: number; tags?: string[] };
}

/**
 * Fetch with exponential backoff retry and timeout.
 * Handles 429 rate limits, 5xx errors, and network failures.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    retries = 3,
    retryDelayMs = 1000,
    timeoutMs = 10000,
    headers = {},
    next,
  } = options;

  const defaultHeaders = {
    "User-Agent": "Agent-Studio/1.0",
    ...headers,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: defaultHeaders,
        signal: AbortSignal.timeout(timeoutMs),
        ...(next ? { next } : {}),
      });

      // Rate limited — wait for Retry-After header
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
        await sleep(retryAfter * 1000);
        continue;
      }

      // Server error — retry with backoff
      if (!res.ok && attempt < retries) {
        await sleep(retryDelayMs * attempt);
        continue;
      }

      return res;
    } catch (error) {
      // Network/timeout error — retry with backoff
      if (attempt < retries) {
        await sleep(retryDelayMs * attempt);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`fetchWithRetry: max retries (${retries}) exceeded for ${url}`);
}

// ────────────── Sleep Helper ──────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────── Re-exports from domain modules ──────────────

export {
  fetchAwesomeMcpMarkdown,
  parseAwesomeMcpServers,
  getCachedAwesomeMcpServers,
  fetchAwesomeMcpPaginated,
  type AwesomeMcpServer,
  type AwesomeMcpPaginatedResult,
} from "./catalogs/mcp-catalog";

export {
  fetchSmitheryPaginated,
  fetchAllSmithery,
  fetchSmitheryMultiQuery,
  type SmitheryPaginatedResult,
} from "./catalogs/smithery";

export {
  fetchMcpSoSitemap,
  fetchGlamaSitemap,
} from "./catalogs/sitemaps";

export {
  fetchComposioToolkits,
  fetchAllComposioTools,
  type ComposioToolkit,
  type ComposioTool,
} from "./catalogs/composio";

export { fetchArcadeIntegrations } from "./catalogs/arcade";
export { fetchGitHub } from "./catalogs/github";
