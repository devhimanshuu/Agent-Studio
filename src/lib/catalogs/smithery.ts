/**
 * Smithery.ai registry fetchers — paginated, cached, with background prefetch.
 */

import { fetchWithRetry, sleep } from "@/lib/fetch-utils";
import { logger } from "@/lib/logger";

const SMITHERY_BASE = "https://registry.smithery.ai";
const SMITHERY_DEFAULT_PAGE_SIZE = 100;
const SMITHERY_HEADERS = { "User-Agent": "Agent-Studio/1.0" };

interface SmitheryCacheEntry {
  data: unknown[];
  totalCount: number;
  fetchedAt: number;
}

// In-memory cache for individual pages and aggregate queries (TTL: 30 minutes)
const smitheryPageCache = new Map<string, SmitheryCacheEntry>();
const SMITHERY_CACHE_TTL = 1800_000;

function buildCacheKey(endpoint: string, page: number, pageSize: number, query = ""): string {
  return `${endpoint}:p${page}:s${pageSize}:q${query.toLowerCase().trim()}`;
}

/**
 * Fetch a single page from Smithery registry with retry.
 */
async function smitheryFetchPage<T = unknown>(
  endpoint: "servers" | "skills",
  page: number,
  pageSize = SMITHERY_DEFAULT_PAGE_SIZE,
  query = "",
  timeoutMs = 15000
): Promise<{ data: T[]; totalCount: number }> {
  const queryParam = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : "";
  const url = `${SMITHERY_BASE}/${endpoint}?page=${page}&pageSize=${pageSize}${queryParam}`;

  try {
    const res = await fetchWithRetry(url, {
      timeoutMs,
      retries: 2,
      headers: SMITHERY_HEADERS,
    });
    if (!res.ok) return { data: [], totalCount: 0 };
    const json = await res.json();
    return {
      data: json.servers || json.skills || [],
      totalCount: json.pagination?.totalCount || json.totalCount || 0,
    };
  } catch {
    return { data: [], totalCount: 0 };
  }
}

/**
 * Background prefetch helper for the next page of Smithery data.
 * Does not block the current request.
 */
function prefetchNextSmitheryPage(
  endpoint: "servers" | "skills",
  nextPage: number,
  pageSize: number,
  query = ""
) {
  const nextCacheKey = buildCacheKey(endpoint, nextPage, pageSize, query);
  const existing = smitheryPageCache.get(nextCacheKey);
  if (existing && Date.now() - existing.fetchedAt < SMITHERY_CACHE_TTL) {
    return;
  }

  smitheryFetchPage(endpoint, nextPage, pageSize, query)
    .then((result) => {
      if (result.data.length > 0) {
        smitheryPageCache.set(nextCacheKey, {
          data: result.data,
          totalCount: result.totalCount,
          fetchedAt: Date.now(),
        });
        logger.info({ page: nextPage, count: result.data.length, endpoint }, "Smithery prefetch completed");
      }
    })
    .catch(() => {});
}

export interface SmitheryPaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
  fromCache: boolean;
}

/**
 * Fetch a specific page from Smithery, caching and background-prefetching the next page.
 */
export async function fetchSmitheryPaginated<T = Record<string, unknown>>(options: {
  endpoint: "servers" | "skills";
  page?: number;
  pageSize?: number;
  query?: string;
  mapItem?: (item: Record<string, unknown>) => T;
}): Promise<SmitheryPaginatedResult<T>> {
  const {
    endpoint,
    page = 1,
    pageSize = SMITHERY_DEFAULT_PAGE_SIZE,
    query = "",
    mapItem = (x: Record<string, unknown>) => x as unknown as T,
  } = options;

  const cacheKey = buildCacheKey(endpoint, page, pageSize, query);
  const cached = smitheryPageCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < SMITHERY_CACHE_TTL) {
    const totalPages = Math.ceil(cached.totalCount / pageSize) || 1;
    const hasMore = page < totalPages;
    if (hasMore) {
      prefetchNextSmitheryPage(endpoint, page + 1, pageSize, query);
    }
    return {
      items: (cached.data as Record<string, unknown>[]).map(mapItem),
      page,
      pageSize,
      totalCount: cached.totalCount,
      totalPages,
      hasMore,
      fromCache: true,
    };
  }

  const result = await smitheryFetchPage<Record<string, unknown>>(endpoint, page, pageSize, query);
  const totalCount = result.totalCount || result.data.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const hasMore = page < totalPages && result.data.length > 0;

  smitheryPageCache.set(cacheKey, {
    data: result.data,
    totalCount,
    fetchedAt: Date.now(),
  });

  if (hasMore) {
    prefetchNextSmitheryPage(endpoint, page + 1, pageSize, query);
  }

  return {
    items: result.data.map(mapItem),
    page,
    pageSize,
    totalCount,
    totalPages,
    hasMore,
    fromCache: false,
  };
}

/**
 * Fetch all Smithery items with parallel pagination (capped).
 * Kept for backwards-compatibility with directory routes.
 */
export async function fetchAllSmithery<T = Record<string, unknown>>(
  endpoint: "servers" | "skills",
  mapItem: (item: Record<string, unknown>) => T = (x: Record<string, unknown>) => x as unknown as T,
  maxPages = 100
): Promise<{ items: T[]; totalCount: number }> {
  const cacheKey = `all:${endpoint}:max${maxPages}`;
  const cached = smitheryPageCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SMITHERY_CACHE_TTL) {
    return {
      items: (cached.data as Record<string, unknown>[]).map(mapItem),
      totalCount: cached.totalCount,
    };
  }

  const first = await smitheryFetchPage<Record<string, unknown>>(endpoint, 1, SMITHERY_DEFAULT_PAGE_SIZE);
  const totalCount = first.totalCount || first.data.length;
  const totalPages = Math.min(Math.ceil(totalCount / SMITHERY_DEFAULT_PAGE_SIZE), maxPages);

  if (totalPages <= 1) {
    smitheryPageCache.set(cacheKey, {
      data: first.data,
      totalCount,
      fetchedAt: Date.now(),
    });
    return { items: first.data.map(mapItem), totalCount };
  }

  const allRaw: Record<string, unknown>[] = [...first.data];

  const BATCH_SIZE = 5;
  for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
    const batch = [];
    for (let page = batchStart; page <= batchEnd; page++) {
      batch.push(
        smitheryFetchPage<Record<string, unknown>>(endpoint, page, SMITHERY_DEFAULT_PAGE_SIZE)
          .then((res) => ({ page, data: res.data || [] }))
      );
    }
    const results = await Promise.all(batch);
    results.sort((a, b) => a.page - b.page);
    for (const r of results) {
      if (r.data.length === 0) break;
      allRaw.push(...r.data);
    }
    if (batchStart + BATCH_SIZE <= totalPages) {
      await sleep(200);
    }
  }

  smitheryPageCache.set(cacheKey, {
    data: allRaw,
    totalCount,
    fetchedAt: Date.now(),
  });

  return { items: allRaw.map(mapItem), totalCount };
}

// ────────────── Multi-Query Smithery Fetcher ──────────────

const SMITHERY_SEARCH_QUERIES = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "database", "search", "browser", "email", "slack", "github",
  "cloud", "docker", "kubernetes", "ai", "llm", "vector",
  "file", "storage", "payment", "stripe", "calendar",
  "security", "auth", "monitor", "log", "deploy",
  "notion", "jira", "confluence", "linear",
  "postgres", "mysql", "mongo", "redis",
  "openai", "anthropic", "gemini", "claude",
  "youtube", "twitter", "reddit",
  "pdf", "image", "video", "audio",
  "weather", "maps", "excel", "csv", "json",
];

let multiQueryCache: { data: Record<string, unknown>[]; totalCount: number; fetchedAt: number } | null = null;
const MULTI_QUERY_CACHE_TTL = 1800_000;

/**
 * Fetch Smithery servers using multiple search queries to bypass the 500-server cap.
 * Each query returns up to 500 servers; we deduplicate by ID across all queries.
 *
 * NOTE: Reduced from 60 queries × 5 pages (300 requests) to 20 queries × 2 pages
 * (40 requests) to avoid Vercel serverless timeout (60s). The alphabet + keyword
 * queries cover the most common server categories.
 */
export async function fetchSmitheryMultiQuery(
  maxQueries = 20
): Promise<{ data: Record<string, unknown>[]; totalCount: number }> {
  if (multiQueryCache && Date.now() - multiQueryCache.fetchedAt < MULTI_QUERY_CACHE_TTL) {
    return { data: multiQueryCache.data, totalCount: multiQueryCache.totalCount };
  }

  const seenIds = new Set<string>();
  const allRaw: Record<string, unknown>[] = [];
  const queries = SMITHERY_SEARCH_QUERIES.slice(0, maxQueries);

  const BATCH_SIZE = 5;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (q) => {
        try {
          // Only fetch 2 pages per query (200 servers max) instead of 5
          const pages = await Promise.all([
            smitheryFetchPage<Record<string, unknown>>("servers", 1, 100, q),
            smitheryFetchPage<Record<string, unknown>>("servers", 2, 100, q),
          ]);
          return pages.flatMap((p) => p.data || []);
        } catch {
          return [];
        }
      })
    );

    for (const servers of results) {
      for (const s of servers) {
        if (typeof s.id === "string" && !seenIds.has(s.id)) {
          seenIds.add(s.id);
          allRaw.push(s);
        }
      }
    }

    if (i + BATCH_SIZE < queries.length) {
      await sleep(150);
    }
  }

  multiQueryCache = { data: allRaw, totalCount: allRaw.length, fetchedAt: Date.now() };
  logger.info({ count: allRaw.length, queries: queries.length }, "Smithery multi-query completed");

  return { data: allRaw, totalCount: allRaw.length };
}
