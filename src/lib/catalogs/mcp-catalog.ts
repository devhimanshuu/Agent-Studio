/**
 * Awesome MCP Servers catalog — fetches and parses the curated README list.
 * In-memory cached (1 hour TTL) so multiple routes share one fetch.
 */

import { fetchWithRetry } from "@/lib/fetch-utils";

const AWESOME_MCP_URL =
  "https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md";

export interface AwesomeMcpServer {
  /** Real GitHub star count when the upstream source provides one. */
  stars?: number;
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

export interface AwesomeMcpPaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
  fromCache: boolean;
}

// In-memory cache (TTL: 1 hour)
let awesomeMcpCache: { markdown: string; fetchedAt: number } | null = null;
const AWESOME_MCP_CACHE_TTL = 3600_000;

/**
 * Fetch the awesome-mcp-servers README with in-memory caching.
 * All routes share this single cached fetch.
 */
export async function fetchAwesomeMcpMarkdown(): Promise<string | null> {
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

    if (trimmed.startsWith("### ")) {
      currentCategory = trimmed
        .replace(/^###\s+/, "")
        .replace(/<a[^>]*><\/a>/gi, "")
        .replace(/[^\w\s&]/gi, "")
        .trim();
      continue;
    }

    if (trimmed.startsWith("- [") && trimmed.includes("](")) {
      const match = trimmed.match(/^- \[([^\]]+)\]\((https?:\/\/[^)]+)\)(.*)$/);
      if (!match) continue;

      const rawTitle = match[1].trim();
      const repoUrl = match[2].trim();
      const rest = match[3].trim();

      const isGlama = rest.includes("glama.ai/mcp/servers");
      const isOfficial = rest.includes("🎖️");

      const npxMatch = trimmed.match(/`([^`]*(?:npx|uvx|pip install|docker run)[^`]*)`/i);
      const httpMatch = trimmed.match(
        /(https?:\/\/[^\\s)`"']+[\/](?:mcp|sse)[^\\s)`"']*)/i
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

      let description = rest
        .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
        .replace(/[^\x00-\x7F]/g, "")
        .replace(/^[\s\-:]+/, "")
        .trim();
      if (!description) description = `MCP server for ${rawTitle}`;

      let language = "unknown";
      if (trimmed.includes("```ts") || trimmed.includes("```js")) language = "typescript";
      else if (trimmed.includes("🐍")) language = "python";
      else if (trimmed.includes("🏎️")) language = "go";
      else if (trimmed.includes("🦀")) language = "rust";
      else if (trimmed.includes("💎")) language = "ruby";

      let scope = "unknown";
      if (trimmed.includes("☁️")) scope = "cloud";
      else if (trimmed.includes("🏠")) scope = "local";

      const requiresAuth =
        description.toLowerCase().includes("api key") ||
        description.toLowerCase().includes("token") ||
        description.toLowerCase().includes("oauth");

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

// In-memory cache for parsed servers (TTL: 1 hour)
let parsedServersCache: { servers: AwesomeMcpServer[]; fetchedAt: number } | null = null;
const PARSED_SERVERS_CACHE_TTL = 3600_000;

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
    mapItem = (x: unknown) => x as T,
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
