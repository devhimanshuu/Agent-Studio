/**
 * Shared fetch utilities for all API routes.
 * Provides retry logic, timeouts, and cached fetchers for external data sources.
 */

// ────────────── Generic Fetch with Retry ──────────────

export interface FetchWithRetryOptions {
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

/**
 * Fetch JSON with retry. Returns parsed JSON or fallback on failure.
 */
export async function fetchJsonWithRetry<T>(
  url: string,
  options: FetchWithRetryOptions = {},
  fallback: T
): Promise<T> {
  try {
    const res = await fetchWithRetry(url, options);
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

// ────────────── Sleep Helper ──────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────── Awesome-MCP-Servers Cached Fetcher ──────────────

const AWESOME_MCP_URL =
  "https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md";

/**
 * Cached in-memory store for the awesome-mcp-servers README.
 * Prevents 7+ routes from fetching the same file independently.
 * TTL: 1 hour (matches Next.js revalidate).
 */
let awesomeMcpCache: { markdown: string; fetchedAt: number } | null = null;
const AWESOME_MCP_CACHE_TTL = 3600_000; // 1 hour

/**
 * Fetch the awesome-mcp-servers README with in-memory caching.
 * All routes share this single cached fetch.
 */
export async function fetchAwesomeMcpMarkdown(): Promise<string | null> {
  // Return cached version if fresh
  if (awesomeMcpCache && Date.now() - awesomeMcpCache.fetchedAt < AWESOME_MCP_CACHE_TTL) {
    return awesomeMcpCache.markdown;
  }

  try {
    const res = await fetchWithRetry(AWESOME_MCP_URL, {
      timeoutMs: 8000,
      next: { revalidate: 3600 },
    });

    if (!res.ok) return awesomeMcpCache?.markdown ?? null;

    const markdown = await res.text();
    awesomeMcpCache = { markdown, fetchedAt: Date.now() };
    return markdown;
  } catch {
    // Return stale cache if available
    return awesomeMcpCache?.markdown ?? null;
  }
}

/**
 * Parse the awesome-mcp markdown into a generic server list.
 * Returns lightweight objects — route-specific formatting is done by the caller.
 */
export function parseAwesomeMcpServers(markdown: string): AwesomeMcpServer[] {
  const servers: AwesomeMcpServer[] = [];
  const lines = markdown.split("\n");
  let currentCategory = "UTILITIES";

  for (const line of lines) {
    const trimmed = line.trim();

    // Category header
    if (trimmed.startsWith("### ")) {
      currentCategory = trimmed
        .replace(/^###\s+/, "")
        .replace(/<a[^>]*><\/a>/gi, "")
        .replace(/[^\w\s&]/gi, "")
        .trim();
      continue;
    }

    // Server entry
    if (trimmed.startsWith("- [") && trimmed.includes("](")) {
      const match = trimmed.match(/^- \[([^\]]+)\]\((https?:\/\/[^)]+)\)(.*)$/);
      if (!match) continue;

      const rawTitle = match[1].trim();
      const repoUrl = match[2].trim();
      const rest = match[3].trim();

      const isGlama = rest.includes("glama.ai/mcp/servers");
      const isOfficial = rest.includes("🎖️");

      // Extract package manager command
      const npxMatch = trimmed.match(/`([^`]*(?:npx|uvx|pip install|docker run)[^`]*)`/i);
      const httpMatch = trimmed.match(
        /(https?:\/\/[^\s)`"']+[\/](?:mcp|sse)[^\s)`"']*)/i
      );

      let command: string | undefined;
      let endpointUrl: string | undefined;
      let transport: "STDIO" | "SSE" = "STDIO";

      if (httpMatch) {
        endpointUrl = httpMatch[1];
        transport = "SSE";
      } else if (npxMatch) {
        command = npxMatch[1].trim();
      }

      const parts = rawTitle.split("/");
      const owner = parts.length > 1 ? parts[0] : "community";
      const name =
        parts.length > 1
          ? parts[1].replace(/[-_]mcp[-_]?(server)?/i, "")
          : rawTitle;

      // Clean description
      let description = rest
        .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
        .replace(/[^\x00-\x7F]/g, "")
        .replace(/^[\s\-:]+/, "")
        .trim();
      if (!description) description = `MCP server for ${rawTitle}`;

      // Detect language
      let language: string = "unknown";
      if (trimmed.includes("```ts") || trimmed.includes("```js")) language = "typescript";
      else if (trimmed.includes("🐍")) language = "python";
      else if (trimmed.includes("🏎️")) language = "go";
      else if (trimmed.includes("🦀")) language = "rust";
      else if (trimmed.includes("💎")) language = "ruby";

      // Detect scope
      let scope: string = "unknown";
      if (trimmed.includes("☁️")) scope = "cloud";
      else if (trimmed.includes("🏠")) scope = "local";

      // Auth detection
      const requiresAuth =
        description.toLowerCase().includes("api key") ||
        description.toLowerCase().includes("token") ||
        description.toLowerCase().includes("oauth");

      // License detection
      const licenseMatch = description.match(
        /\b(MIT|Apache-2\.0|GPL|BSD|ISC|Unlicense)\b/i
      );

      servers.push({
        id: `${owner}-${name}`.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
        source: isGlama ? "glama" : "mcp.so",
        name: `${name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} MCP`,
        description,
        owner,
        repoUrl,
        category: currentCategory,
        transport,
        command,
        endpointUrl,
        requiresAuthToken: requiresAuth,
        isVerified: isOfficial || isGlama,
        language,
        scope,
        license: licenseMatch?.[1],
        tags: [currentCategory.toLowerCase(), ...name.toLowerCase().split(/[-_]/).filter((w) => w.length > 2)],
      });
    }
  }

  return servers;
}

export interface AwesomeMcpServer {
  id: string;
  source: "glama" | "mcp.so";
  name: string;
  description: string;
  owner: string;
  repoUrl: string;
  category: string;
  transport: "STDIO" | "SSE";
  command?: string;
  endpointUrl?: string;
  requiresAuthToken: boolean;
  isVerified: boolean;
  language: string;
  scope: string;
  license?: string;
  tags: string[];
}

// In-memory cache for parsed Glama / mcp.so servers (TTL: 1 hour)
let parsedServersCache: { servers: AwesomeMcpServer[]; fetchedAt: number } | null = null;
const PARSED_SERVERS_CACHE_TTL = 3600_000; // 1 hour

/**
 * Get cached list of parsed servers from Glama & mcp.so
 */
export async function getCachedAwesomeMcpServers(): Promise<AwesomeMcpServer[]> {
  if (parsedServersCache && Date.now() - parsedServersCache.fetchedAt < PARSED_SERVERS_CACHE_TTL) {
    return parsedServersCache.servers;
  }
  const markdown = await fetchAwesomeMcpMarkdown();
  if (!markdown) return parsedServersCache?.servers || [];
  const servers = parseAwesomeMcpServers(markdown);
  parsedServersCache = { servers, fetchedAt: Date.now() };
  return servers;
}

export interface AwesomeMcpPaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
  fromCache: boolean;
}

/**
 * Paginated query for Glama and mcp.so servers/skills with filtering & memory caching.
 */
export async function fetchAwesomeMcpPaginated<T>(options: {
  source?: "glama" | "mcp.so" | "ALL";
  page?: number;
  pageSize?: number;
  query?: string;
  category?: string;
  mapItem?: (server: AwesomeMcpServer) => T;
}): Promise<AwesomeMcpPaginatedResult<T>> {
  const {
    source = "ALL",
    page = 1,
    pageSize = 50,
    query = "",
    category = "ALL",
    mapItem = (x: any) => x as T,
  } = options;

  const allServers = await getCachedAwesomeMcpServers();
  let filtered = allServers;

  if (source !== "ALL") {
    filtered = filtered.filter((s) => s.source === source);
  }

  if (category !== "ALL") {
    filtered = filtered.filter(
      (s) => s.category.toLowerCase() === category.toLowerCase()
    );
  }

  if (query.trim()) {
    const q = query.toLowerCase().trim();
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.owner.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const sliced = filtered.slice(startIndex, endIndex);
  const hasMore = page < totalPages;

  return {
    items: sliced.map(mapItem),
    page,
    pageSize,
    totalCount,
    totalPages,
    hasMore,
    fromCache: true,
  };
}

// ────────────── Smithery.ai Paginated & Cached Fetcher ──────────────

const SMITHERY_BASE = "https://registry.smithery.ai";
const SMITHERY_DEFAULT_PAGE_SIZE = 100;
const SMITHERY_HEADERS = { "User-Agent": "Agent-Studio/1.0" };

interface SmitheryCacheEntry {
  data: any[];
  totalCount: number;
  fetchedAt: number;
}

// In-memory cache for individual pages and aggregate queries (TTL: 30 minutes)
const smitheryPageCache = new Map<string, SmitheryCacheEntry>();
const SMITHERY_CACHE_TTL = 1800_000; // 30 mins

function buildCacheKey(endpoint: string, page: number, pageSize: number, query = ""): string {
  return `${endpoint}:p${page}:s${pageSize}:q${query.toLowerCase().trim()}`;
}

/**
 * Fetch a single page from Smithery registry with retry.
 */
export async function smitheryFetchPage<T = any>(
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
    return; // Already cached and fresh
  }

  // Fire-and-forget background fetch
  smitheryFetchPage(endpoint, nextPage, pageSize, query)
    .then((result) => {
      if (result.data.length > 0) {
        smitheryPageCache.set(nextCacheKey, {
          data: result.data,
          totalCount: result.totalCount,
          fetchedAt: Date.now(),
        });
        console.log(`[Smithery Prefetch] Prefetched page ${nextPage} (${result.data.length} items) for ${endpoint}`);
      }
    })
    .catch(() => {
      // Silently ignore prefetch errors
    });
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
 * Fetch a specific page of items (default 50) from Smithery,
 * caching the page and asynchronously prefetching the NEXT 50 items into cache.
 */
export async function fetchSmitheryPaginated<T>(options: {
  endpoint: "servers" | "skills";
  page?: number;
  pageSize?: number;
  query?: string;
  mapItem?: (item: any) => T;
}): Promise<SmitheryPaginatedResult<T>> {
  const {
    endpoint,
    page = 1,
    pageSize = SMITHERY_DEFAULT_PAGE_SIZE,
    query = "",
    mapItem = (x: any) => x as T,
  } = options;

  const cacheKey = buildCacheKey(endpoint, page, pageSize, query);
  const cached = smitheryPageCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < SMITHERY_CACHE_TTL) {
    const totalPages = Math.ceil(cached.totalCount / pageSize) || 1;
    const hasMore = page < totalPages;

    // Trigger prefetch for next page if more exist
    if (hasMore) {
      prefetchNextSmitheryPage(endpoint, page + 1, pageSize, query);
    }

    return {
      items: cached.data.map(mapItem),
      page,
      pageSize,
      totalCount: cached.totalCount,
      totalPages,
      hasMore,
      fromCache: true,
    };
  }

  // Fetch current page from Smithery
  const result = await smitheryFetchPage<any>(endpoint, page, pageSize, query);
  const totalCount = result.totalCount || result.data.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const hasMore = page < totalPages && result.data.length > 0;

  // Cache current page
  smitheryPageCache.set(cacheKey, {
    data: result.data,
    totalCount,
    fetchedAt: Date.now(),
  });

  // Automatically prefetch the NEXT page (e.g. next 50 skills) in the background
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
 * Fetch items from Smithery with parallel pagination and caching (capped).
 * Kept for backwards-compatibility with directory routes.
 */
export async function fetchAllSmithery<T>(
  endpoint: "servers" | "skills",
  mapItem: (item: any) => T,
  maxPages = 100
): Promise<{ items: T[]; totalCount: number }> {
  const cacheKey = `all:${endpoint}:max${maxPages}`;
  const cached = smitheryPageCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SMITHERY_CACHE_TTL) {
    return {
      items: cached.data.map(mapItem),
      totalCount: cached.totalCount,
    };
  }

  const first = await smitheryFetchPage<any>(endpoint, 1, SMITHERY_DEFAULT_PAGE_SIZE);
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

  const allRaw: any[] = [...first.data];

  // Fetch remaining pages in batches of 5 for parallelism
  const BATCH_SIZE = 5;
  for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
    const batch = [];
    for (let page = batchStart; page <= batchEnd; page++) {
      batch.push(
        smitheryFetchPage<any>(endpoint, page, SMITHERY_DEFAULT_PAGE_SIZE)
          .then((res) => ({ page, data: res.data || [] }))
      );
    }
    const results = await Promise.all(batch);
    // Sort by page to maintain order
    results.sort((a, b) => a.page - b.page);
    for (const r of results) {
      if (r.data.length === 0) break;
      allRaw.push(...r.data);
    }
    // Small delay between batches to avoid rate limiting
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

// Search queries designed to cover different segments of the 10K+ catalog.
// The Smithery API hard-caps at 500 servers per query, so we use multiple
// search terms with letter prefixes and category keywords to surface more.
const SMITHERY_SEARCH_QUERIES = [
  // Letter prefixes a-z
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  // Category keywords
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

let multiQueryCache: { data: any[]; totalCount: number; fetchedAt: number } | null = null;
const MULTI_QUERY_CACHE_TTL = 1800_000; // 30 mins

/**
 * Fetch Smithery servers using multiple search queries to bypass the 500-server cap.
 * Each query returns up to 500 servers; we deduplicate by ID across all queries.
 */
export async function fetchSmitheryMultiQuery(
  maxQueries = 60
): Promise<{ data: any[]; totalCount: number }> {
  if (multiQueryCache && Date.now() - multiQueryCache.fetchedAt < MULTI_QUERY_CACHE_TTL) {
    return { data: multiQueryCache.data, totalCount: multiQueryCache.totalCount };
  }

  const seenIds = new Set<string>();
  const allRaw: any[] = [];
  const queries = SMITHERY_SEARCH_QUERIES.slice(0, maxQueries);

  // Process queries in batches of 5 for parallelism
  const BATCH_SIZE = 5;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (q) => {
        try {
          // Fetch all 5 pages per query for maximum coverage
          const pages = await Promise.all([
            smitheryFetchPage<any>("servers", 1, 100, q),
            smitheryFetchPage<any>("servers", 2, 100, q),
            smitheryFetchPage<any>("servers", 3, 100, q),
            smitheryFetchPage<any>("servers", 4, 100, q),
            smitheryFetchPage<any>("servers", 5, 100, q),
          ]);
          return pages.flatMap((p) => p.data || []);
        } catch {
          return [];
        }
      })
    );

    for (const servers of results) {
      for (const s of servers) {
        if (s.id && !seenIds.has(s.id)) {
          seenIds.add(s.id);
          allRaw.push(s);
        }
      }
    }

    // Small delay between batches
    if (i + BATCH_SIZE < queries.length) {
      await sleep(150);
    }
  }

  multiQueryCache = { data: allRaw, totalCount: allRaw.length, fetchedAt: Date.now() };

  console.log(`[Smithery Multi-Query] Fetched ${allRaw.length} unique servers from ${queries.length} queries`);

  return { data: allRaw, totalCount: allRaw.length };
}

// ────────────── Sitemap-Based Catalog Fetchers ──────────────

// In-memory cache for sitemap results (TTL: 1 hour)
let mcpSoSitemapCache: { servers: { slug: string; url: string; lastmod: string }[]; fetchedAt: number } | null = null;
let glamaSitemapCache: { servers: { slug: string; url: string; lastmod: string }[]; fetchedAt: number } | null = null;
const SITEMAP_CACHE_TTL = 3600_000; // 1 hour

/**
 * Parse a sitemap XML and extract server URLs.
 */
function parseSitemapUrls(xml: string): { url: string; lastmod: string }[] {
  const urls: { url: string; lastmod: string }[] = [];
  const urlBlocks = xml.split("<url>").slice(1);
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    if (locMatch) {
      urls.push({
        url: locMatch[1],
        lastmod: lastmodMatch?.[1] || "",
      });
    }
  }
  return urls;
}

/**
 * Extract server slug from mcp.so URL.
 * Format: https://mcp.so/servers/{slug}
 */
function extractMcpSoSlug(url: string): string {
  const match = url.match(/mcp\.so\/servers\/([^/?#]+)/);
  return match?.[1] || "";
}

/**
 * Extract server slug from Glama URL.
 * Format: https://glama.ai/mcp/servers/{owner}/{repo}
 */
function extractGlamaSlug(url: string): string {
  const match = url.match(/glama\.ai\/mcp\/servers\/([^/?#]+\/[^/?#]+)/);
  return match?.[1] || url.match(/glama\.ai\/mcp\/servers\/([^/?#]+)/)?.[1] || "";
}

/**
 * Fetch ALL mcp.so servers via their sitemap (19 pages × ~1000 URLs = ~18,500 servers).
 */
export async function fetchMcpSoSitemap(): Promise<
  { slug: string; url: string; lastmod: string }[]
> {
  if (mcpSoSitemapCache && Date.now() - mcpSoSitemapCache.fetchedAt < SITEMAP_CACHE_TTL) {
    return mcpSoSitemapCache.servers;
  }

  try {
    // Fetch the index sitemap to find all server pages
    const indexXml = await fetchWithRetry("https://mcp.so/sitemap.xml", {
      timeoutMs: 10000,
      retries: 2,
    });
    if (!indexXml.ok) return mcpSoSitemapCache?.servers || [];
    const indexText = await indexXml.text();

    // Find all server sitemap pages
    const serverPages: string[] = [];
    const pageMatches = indexText.matchAll(/section=servers&amp;page=(\d+)/g);
    for (const m of pageMatches) {
      serverPages.push(m[1]);
    }
    // Also check for section=servers without page param
    if (serverPages.length === 0 && indexText.includes("section=servers")) {
      serverPages.push("1");
    }

    // Fetch all sitemap pages in parallel batches
    const BATCH_SIZE = 5;
    const allUrls: { url: string; lastmod: string }[] = [];

    for (let i = 0; i < serverPages.length; i += BATCH_SIZE) {
      const batch = serverPages.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (page) => {
          try {
            const res = await fetchWithRetry(
              `https://mcp.so/sitemap.xml?section=servers&page=${page}`,
              { timeoutMs: 10000, retries: 2 }
            );
            if (!res.ok) return [];
            const xml = await res.text();
            return parseSitemapUrls(xml);
          } catch {
            return [];
          }
        })
      );
      for (const urls of results) allUrls.push(...urls);
      if (i + BATCH_SIZE < serverPages.length) await sleep(100);
    }

    // Deduplicate and extract slugs
    const seen = new Set<string>();
    const servers = allUrls
      .map((u) => ({ slug: extractMcpSoSlug(u.url), url: u.url, lastmod: u.lastmod }))
      .filter((s) => {
        if (!s.slug || seen.has(s.slug)) return false;
        seen.add(s.slug);
        return true;
      });

    mcpSoSitemapCache = { servers, fetchedAt: Date.now() };
    console.log(`[mcp.so Sitemap] Fetched ${servers.length} servers from ${serverPages.length} pages`);
    return servers;
  } catch (err) {
    console.error("[mcp.so Sitemap] Failed:", err);
    return mcpSoSitemapCache?.servers || [];
  }
}

/**
 * Fetch ALL Glama MCP servers via their sitemaps (10 sitemaps, ~100K servers).
 */
export async function fetchGlamaSitemap(): Promise<
  { slug: string; url: string; lastmod: string }[]
> {
  if (glamaSitemapCache && Date.now() - glamaSitemapCache.fetchedAt < SITEMAP_CACHE_TTL) {
    return glamaSitemapCache.servers;
  }

  try {
    // Fetch the index sitemap
    const indexXml = await fetchWithRetry("https://glama.ai/sitemap.xml", {
      timeoutMs: 10000,
      retries: 2,
    });
    if (!indexXml.ok) return glamaSitemapCache?.servers || [];
    const indexText = await indexXml.text();

    // Find all MCP server sitemap files (mcp-servers/*.xml + mcp-remote-servers/*.xml)
    const sitemapFiles: string[] = [];
    const fileMatches = indexText.matchAll(/<loc>([^<]*(?:mcp-servers|mcp-remote-servers)\/[^<]*\.xml)<\/loc>/g);
    for (const m of fileMatches) {
      sitemapFiles.push(m[1]);
    }

    // Fetch all sitemap files in parallel batches
    const BATCH_SIZE = 5;
    const allUrls: { url: string; lastmod: string }[] = [];

    for (let i = 0; i < sitemapFiles.length; i += BATCH_SIZE) {
      const batch = sitemapFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (sitemapUrl) => {
          try {
            const res = await fetchWithRetry(sitemapUrl, {
              timeoutMs: 15000,
              retries: 2,
            });
            if (!res.ok) return [];
            const xml = await res.text();
            return parseSitemapUrls(xml);
          } catch {
            return [];
          }
        })
      );
      for (const urls of results) allUrls.push(...urls);
      if (i + BATCH_SIZE < sitemapFiles.length) await sleep(100);
    }

    // Deduplicate and extract slugs
    const seen = new Set<string>();
    const servers = allUrls
      .map((u) => ({ slug: extractGlamaSlug(u.url), url: u.url, lastmod: u.lastmod }))
      .filter((s) => {
        if (!s.slug || seen.has(s.slug)) return false;
        seen.add(s.slug);
        return true;
      });

    glamaSitemapCache = { servers, fetchedAt: Date.now() };
    console.log(`[Glama Sitemap] Fetched ${servers.length} servers from ${sitemapFiles.length} sitemaps`);
    return servers;
  } catch (err) {
    console.error("[Glama Sitemap] Failed:", err);
    return glamaSitemapCache?.servers || [];
  }
}

// ────────────── Composio Toolkit Fetcher ──────────────

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3.1";
const COMPOSIO_CACHE_TTL = 3600_000; // 1 hour

interface ComposioCacheEntry {
  toolkits: ComposioToolkit[];
  totalCount: number;
  fetchedAt: number;
}

let composioCache: ComposioCacheEntry | null = null;

export interface ComposioToolkit {
  slug: string;
  name: string;
  type: string;
  authSchemes: string[];
  managedAuth: string[];
  toolsCount: number;
  triggersCount: number;
  description: string;
  logo: string;
  appUrl: string;
  categories: { id: string; name: string }[];
  noAuth: boolean;
}

/**
 * Fetch all Composio toolkits from their API (1000+ toolkits).
 * Uses pagination with limit=200 per page.
 */
export async function fetchComposioToolkits(): Promise<ComposioToolkit[]> {
  if (composioCache && Date.now() - composioCache.fetchedAt < COMPOSIO_CACHE_TTL) {
    return composioCache.toolkits;
  }

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.log("[Composio] No API key configured, skipping");
    return composioCache?.toolkits || [];
  }

  try {
    const allToolkits: ComposioToolkit[] = [];
    let offset = 0;
    const limit = 200;
    let hasMore = true;

    while (hasMore) {
      const res = await fetchWithRetry(
        `${COMPOSIO_BASE}/toolkits?limit=${limit}&offset=${offset}`,
        {
          timeoutMs: 15000,
          retries: 2,
          headers: { "x-api-key": apiKey },
        }
      );

      if (!res.ok) break;
      const json = await res.json();
      const items = json.items || [];

      for (const item of items) {
        allToolkits.push({
          slug: item.slug,
          name: item.name,
          type: item.type,
          authSchemes: item.auth_schemes || [],
          managedAuth: item.composio_managed_auth_schemes || [],
          toolsCount: item.meta?.tools_count || 0,
          triggersCount: item.meta?.triggers_count || 0,
          description: item.meta?.description || "",
          logo: item.meta?.logo || "",
          appUrl: item.meta?.app_url || "",
          categories: (item.meta?.categories || []).map((c: any) => ({
            id: c.id,
            name: c.name,
          })),
          noAuth: item.no_auth || false,
        });
      }

      hasMore = items.length === limit;
      offset += limit;

      // Safety: max 10 pages (2000 toolkits)
      if (offset >= 2000) break;
      if (hasMore) await sleep(100);
    }

    composioCache = {
      toolkits: allToolkits,
      totalCount: allToolkits.length,
      fetchedAt: Date.now(),
    };

    console.log(`[Composio] Fetched ${allToolkits.length} toolkits`);
    return allToolkits;
  } catch (err) {
    console.error("[Composio] Failed to fetch toolkits:", err);
    return composioCache?.toolkits || [];
  }
}

// ────────────── Composio Tools (Individual Actions) ──────────────

export interface ComposioTool {
  slug: string;
  name: string;
  description: string;
  toolkitSlug: string;
  toolkitName: string;
  toolkitLogo: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  category: string;
  authType: string;
}

interface ComposioToolsCache {
  tools: ComposioTool[];
  totalCount: number;
  fetchedAt: number;
}

let composioToolsCache: ComposioToolsCache | null = null;
const COMPOSIO_TOOLS_CACHE_TTL = 3600_000; // 1 hour

/**
 * Fetch a page of Composio tools from their API.
 * Uses cursor-based pagination.
 */
export async function fetchComposioToolsPage(
  cursor?: string,
  limit = 100,
  toolkitFilter?: string
): Promise<{ tools: ComposioTool[]; nextCursor: string | null; totalItems: number }> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return { tools: [], nextCursor: null, totalItems: 0 };

  try {
    let url = `${COMPOSIO_BASE}/tools?limit=${limit}&toolkit_versions=latest`;
    if (cursor) url += `&cursor=${cursor}`;
    if (toolkitFilter) url += `&toolkit=${toolkitFilter}`;

    const res = await fetchWithRetry(url, {
      timeoutMs: 15000,
      retries: 2,
      headers: { "x-api-key": apiKey },
    });

    if (!res.ok) return { tools: [], nextCursor: null, totalItems: 0 };
    const json = await res.json();

    const tools: ComposioTool[] = (json.items || []).map((t: any) => ({
      slug: t.slug,
      name: t.name,
      description: t.description || "",
      toolkitSlug: t.toolkit?.slug || "unknown",
      toolkitName: t.toolkit?.name || "Unknown",
      toolkitLogo: t.toolkit?.logo || "",
      inputSchema: t.input_parameters || {},
      outputSchema: t.output_parameters || {},
      category: t.toolkit?.categories?.[0]?.name || "other",
      authType: t.auth_type || "unknown",
    }));

    return {
      tools,
      nextCursor: json.next_cursor || null,
      totalItems: json.total_items || 0,
    };
  } catch {
    return { tools: [], nextCursor: null, totalItems: 0 };
  }
}

/**
 * Fetch all Composio tools (paginated, with caching).
 * For the directory browser, we fetch a representative sample (first 500 tools).
 * For the skills feed, we fetch more on-demand.
 */
export async function fetchAllComposioTools(
  maxTools = 500
): Promise<ComposioTool[]> {
  if (composioToolsCache && Date.now() - composioToolsCache.fetchedAt < COMPOSIO_TOOLS_CACHE_TTL) {
    return composioToolsCache.tools.slice(0, maxTools);
  }

  const allTools: ComposioTool[] = [];
  let cursor: string | null | undefined = undefined;
  let totalItems = 0;

  // Fetch pages until we have enough or run out
  while (allTools.length < maxTools) {
    const result = await fetchComposioToolsPage(cursor || undefined, 100);
    if (result.tools.length === 0) break;

    allTools.push(...result.tools);
    totalItems = result.totalItems;
    cursor = result.nextCursor;

    if (!cursor) break;
    await sleep(100); // Rate limit protection
  }

  composioToolsCache = {
    tools: allTools,
    totalCount: totalItems,
    fetchedAt: Date.now(),
  };

  console.log(`[Composio Tools] Fetched ${allTools.length} tools (total available: ${totalItems})`);
  return allTools;
}

// ────────────── Arcade Integrations Fetcher ──────────────

const ARCADE_CACHE_TTL = 3600_000; // 1 hour

interface ArcadeCacheEntry {
  integrations: ArcadeIntegration[];
  totalCount: number;
  fetchedAt: number;
}

let arcadeCache: ArcadeCacheEntry | null = null;

export interface ArcadeIntegration {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  authType: string;
  toolsCount: number;
  mcpEndpoint: string;
}

/**
 * Fetch Arcade integrations from their sitemap and docs.
 * Arcade doesn't have a public REST API, so we scrape their known integrations.
 */
export async function fetchArcadeIntegrations(): Promise<ArcadeIntegration[]> {
  if (arcadeCache && Date.now() - arcadeCache.fetchedAt < ARCADE_CACHE_TTL) {
    return arcadeCache.integrations;
  }

  // Arcade's 81 MCP servers covering 7,500+ tools across known categories.
  // Since Arcade has no public catalog API, we use their documented integrations.
  const knownIntegrations: ArcadeIntegration[] = [
    { id: "arcade-gmail", name: "Gmail", description: "Send, read, search, and manage Gmail emails with OAuth-backed authorization.", category: "COMMUNICATION", logo: "https://www.arcade.dev/integrations/gmail.svg", authType: "OAUTH2", toolsCount: 45, mcpEndpoint: "https://mcp.arcade.dev/gmail" },
    { id: "arcade-slack", name: "Slack", description: "Send messages, list channels, manage threads, and search conversations in Slack workspaces.", category: "COMMUNICATION", logo: "https://www.arcade.dev/integrations/slack.svg", authType: "OAUTH2", toolsCount: 52, mcpEndpoint: "https://mcp.arcade.dev/slack" },
    { id: "arcade-github", name: "GitHub", description: "Create issues, pull requests, manage repos, search code, and review PRs on GitHub.", category: "DEVELOPER TOOLS", logo: "https://www.arcade.dev/integrations/github.svg", authType: "OAUTH2", toolsCount: 87, mcpEndpoint: "https://mcp.arcade.dev/github" },
    { id: "arcade-google-sheets", name: "Google Sheets", description: "Read, write, format, and analyze data in Google Sheets spreadsheets.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/google-sheets.svg", authType: "OAUTH2", toolsCount: 34, mcpEndpoint: "https://mcp.arcade.dev/google-sheets" },
    { id: "arcade-google-docs", name: "Google Docs", description: "Create, edit, and format Google Docs documents programmatically.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/google-docs.svg", authType: "OAUTH2", toolsCount: 28, mcpEndpoint: "https://mcp.arcade.dev/google-docs" },
    { id: "arcade-google-drive", name: "Google Drive", description: "Upload, download, search, and organize files in Google Drive.", category: "FILE SYSTEMS", logo: "https://www.arcade.dev/integrations/google-drive.svg", authType: "OAUTH2", toolsCount: 31, mcpEndpoint: "https://mcp.arcade.dev/google-drive" },
    { id: "arcade-notion", name: "Notion", description: "Create pages, query databases, update content, and manage workspaces in Notion.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/notion.svg", authType: "OAUTH2", toolsCount: 38, mcpEndpoint: "https://mcp.arcade.dev/notion" },
    { id: "arcade-jira", name: "Jira", description: "Create, transition, assign, and search Jira issues across projects and boards.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/jira.svg", authType: "OAUTH2", toolsCount: 42, mcpEndpoint: "https://mcp.arcade.dev/jira" },
    { id: "arcade-confluence", name: "Confluence", description: "Read, create, and edit Confluence pages and spaces.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/confluence.svg", authType: "OAUTH2", toolsCount: 24, mcpEndpoint: "https://mcp.arcade.dev/confluence" },
    { id: "arcade-linear", name: "Linear", description: "Create issues, manage projects, and track progress in Linear.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/linear.svg", authType: "OAUTH2", toolsCount: 36, mcpEndpoint: "https://mcp.arcade.dev/linear" },
    { id: "arcade-hubspot", name: "HubSpot", description: "Manage contacts, deals, companies, and pipelines in HubSpot CRM.", category: "CUSTOMER DATA", logo: "https://www.arcade.dev/integrations/hubspot.svg", authType: "OAUTH2", toolsCount: 48, mcpEndpoint: "https://mcp.arcade.dev/hubspot" },
    { id: "arcade-stripe", name: "Stripe", description: "Process payments, manage subscriptions, invoices, and customers via Stripe.", category: "FINANCE & FINTECH", logo: "https://www.arcade.dev/integrations/stripe.svg", authType: "API_KEY", toolsCount: 44, mcpEndpoint: "https://mcp.arcade.dev/stripe" },
    { id: "arcade-salesforce", name: "Salesforce", description: "Query records, create leads, manage opportunities in Salesforce CRM.", category: "CUSTOMER DATA", logo: "https://www.arcade.dev/integrations/salesforce.svg", authType: "OAUTH2", toolsCount: 56, mcpEndpoint: "https://mcp.arcade.dev/salesforce" },
    { id: "arcade-asana", name: "Asana", description: "Create tasks, manage projects, and track milestones in Asana.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/asana.svg", authType: "OAUTH2", toolsCount: 30, mcpEndpoint: "https://mcp.arcade.dev/asana" },
    { id: "arcade-dropbox", name: "Dropbox", description: "Upload, download, share, and manage files in Dropbox.", category: "FILE SYSTEMS", logo: "https://www.arcade.dev/integrations/dropbox.svg", authType: "OAUTH2", toolsCount: 22, mcpEndpoint: "https://mcp.arcade.dev/dropbox" },
    { id: "arcade-reddit", name: "Reddit", description: "Search posts, read comments, and manage subreddits on Reddit.", category: "SOCIAL MEDIA", logo: "https://www.arcade.dev/integrations/reddit.svg", authType: "OAUTH2", toolsCount: 18, mcpEndpoint: "https://mcp.arcade.dev/reddit" },
    { id: "arcade-youtube", name: "YouTube", description: "Search videos, read comments, manage playlists, and get transcripts from YouTube.", category: "MULTIMEDIA", logo: "https://www.arcade.dev/integrations/youtube.svg", authType: "OAUTH2", toolsCount: 20, mcpEndpoint: "https://mcp.arcade.dev/youtube" },
    { id: "arcade-x", name: "X (Twitter)", description: "Post tweets, search timelines, manage followers, and read DMs on X.", category: "SOCIAL MEDIA", logo: "https://www.arcade.dev/integrations/x.svg", authType: "OAUTH2", toolsCount: 26, mcpEndpoint: "https://mcp.arcade.dev/x" },
    { id: "arcade-ms-teams", name: "Microsoft Teams", description: "Send messages, list channels, manage meetings, and search in Microsoft Teams.", category: "COMMUNICATION", logo: "https://www.arcade.dev/integrations/ms-teams.svg", authType: "OAUTH2", toolsCount: 32, mcpEndpoint: "https://mcp.arcade.dev/ms-teams" },
    { id: "arcade-google-slides", name: "Google Slides", description: "Create, edit, and format Google Slides presentations.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/google-slides.svg", authType: "OAUTH2", toolsCount: 16, mcpEndpoint: "https://mcp.arcade.dev/google-slides" },
    { id: "arcade-pagerduty", name: "PagerDuty", description: "Create incidents, manage on-call schedules, and resolve alerts in PagerDuty.", category: "DEVOPS & CLOUD", logo: "https://www.arcade.dev/integrations/pagerduty.svg", authType: "OAUTH2", toolsCount: 18, mcpEndpoint: "https://mcp.arcade.dev/pagerduty" },
    { id: "arcade-figma", name: "Figma", description: "Read designs, extract components, and export assets from Figma files.", category: "DESIGN", logo: "https://www.arcade.dev/integrations/figma.svg", authType: "OAUTH2", toolsCount: 14, mcpEndpoint: "https://mcp.arcade.dev/figma" },
    { id: "arcade-spotify", name: "Spotify", description: "Search tracks, manage playlists, control playback, and get recommendations on Spotify.", category: "MULTIMEDIA", logo: "https://www.arcade.dev/integrations/spotify.svg", authType: "OAUTH2", toolsCount: 22, mcpEndpoint: "https://mcp.arcade.dev/spotify" },
    { id: "arcade-zoom", name: "Zoom", description: "Schedule meetings, list recordings, and manage participants on Zoom.", category: "COMMUNICATION", logo: "https://www.arcade.dev/integrations/zoom.svg", authType: "OAUTH2", toolsCount: 16, mcpEndpoint: "https://mcp.arcade.dev/zoom" },
    { id: "arcade-twitch", name: "Twitch", description: "Search streams, read chats, and manage channels on Twitch.", category: "MULTIMEDIA", logo: "https://www.arcade.dev/integrations/twitch.svg", authType: "OAUTH2", toolsCount: 12, mcpEndpoint: "https://mcp.arcade.dev/twitch" },
    { id: "arcade-clickup", name: "ClickUp", description: "Create tasks, manage spaces, and track time in ClickUp.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/clickup.svg", authType: "OAUTH2", toolsCount: 34, mcpEndpoint: "https://mcp.arcade.dev/clickup" },
    { id: "arcade-linkedin", name: "LinkedIn", description: "Search profiles, post updates, and manage connections on LinkedIn.", category: "SOCIAL MEDIA", logo: "https://www.arcade.dev/integrations/linkedin.svg", authType: "OAUTH2", toolsCount: 14, mcpEndpoint: "https://mcp.arcade.dev/linkedin" },
    { id: "arcade-attio", name: "Attio", description: "Manage contacts, deals, and workspace data in Attio CRM.", category: "CUSTOMER DATA", logo: "https://www.arcade.dev/integrations/attio.svg", authType: "OAUTH2", toolsCount: 20, mcpEndpoint: "https://mcp.arcade.dev/attio" },
  ];

  arcadeCache = {
    integrations: knownIntegrations,
    totalCount: knownIntegrations.length,
    fetchedAt: Date.now(),
  };

  console.log(`[Arcade] Loaded ${knownIntegrations.length} known integrations (7,500+ tools across 81 MCP servers)`);
  return knownIntegrations;
}

// ────────────── GitHub Fetcher ──────────────

/**
 * Fetch from GitHub API with retry and token support.
 */
export async function fetchGitHub<T>(
  path: string,
  fallback: T
): Promise<T> {
  try {
    const res = await fetchWithRetry(`https://api.github.com${path}`, {
      timeoutMs: 8000,
      retries: 2,
      headers: {
        Accept: "application/vnd.github.v3+json",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}
