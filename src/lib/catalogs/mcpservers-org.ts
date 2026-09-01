/**
 * mcpservers.org catalog fetcher — parses their sitemaps to discover
 * 9,800+ MCP servers, remote MCP servers, and agent skills.
 *
 * mcpservers.org provides:
 *   - /sitemaps/servers/{1-6}.xml  — local STDIO servers
 *   - /sitemaps/remote-mcp-servers.xml — remote SSE/HTTP servers
 *   - /sitemaps/skills.xml — agent skills
 *   - /sitemaps/priority-servers.xml — featured/verified servers
 */

import { fetchWithRetry, sleep } from "@/lib/fetch-utils";
import { logger } from "@/lib/logger";

const MCPSERVERS_ORG_BASE = "https://mcpservers.org";
const CACHE_TTL = 3600_000; // 1 hour

// ────────────── Types ──────────────

export interface McpServersOrgEntry {
  slug: string;
  url: string;
  source: "servers" | "remote" | "skills" | "priority";
}

// ────────────── Cache ──────────────

interface CacheEntry {
  entries: McpServersOrgEntry[];
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

// ────────────── Sitemap Parsing ──────────────

function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  // Extract all <loc> URLs — filter to English-only (no /zh-CN/, /ja/, etc.)
  const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
  for (const m of locMatches) {
    const url = m[1];
    // Only keep English URLs (no language prefix)
    if (url.startsWith(MCPSERVERS_ORG_BASE) && !url.match(/\/(zh-CN|zh-TW|ja|ko|es|de|fr|pt-BR|ru|hi|tr|vi|id|th)\//)) {
      urls.push(url);
    }
  }
  return urls;
}

function extractSlug(url: string): string {
  // https://mcpservers.org/servers/ahrefs-mcp-server → ahrefs-mcp-server
  // https://mcpservers.org/servers/owner/repo-name → owner/repo-name
  const match = url.match(/\/servers\/(.+?)(?:\?|#|$)/);
  return match?.[1] || "";
}

function extractRemoteSlug(url: string): string {
  const match = url.match(/\/remote-mcp-servers\/(.+?)(?:\?|#|$)/);
  return match?.[1] || "";
}

function extractSkillSlug(url: string): string {
  const match = url.match(/\/agent-skills\/(.+?)(?:\?|#|$)/);
  return match?.[1] || "";
}

// ────────────── Category Mapping ──────────────

const CATEGORY_MAP: Record<string, string> = {
  "development": "DEVELOPER TOOLS",
  "productivity": "PRODUCTIVITY",
  "database": "DATABASES",
  "search": "SEARCH & DATA EXTRACTION",
  "web scraping": "BROWSER AUTOMATION",
  "file system": "FILE SYSTEMS",
  "version control": "DEVELOPER TOOLS",
  "communication": "COMMUNICATION",
  "cloud service": "CLOUD PLATFORMS",
  "cloud storage": "FILE SYSTEMS",
  "marketing": "SOCIAL MEDIA",
  "finance": "FINANCE & FINTECH",
  "design": "MULTIMEDIA PROCESS",
  "memory": "KNOWLEDGE & MEMORY",
  "other": "UTILITIES",
};

export function mapMcpserversOrgCategory(raw: string): string {
  const lower = (raw || "").toLowerCase().trim();
  return CATEGORY_MAP[lower] || "UTILITIES";
}

// ────────────── Main Fetcher ──────────────

/**
 * Fetch all mcpservers.org entries from their sitemaps.
 * Fetches servers (6 pages), remote MCP servers, and skills in parallel.
 */
export async function fetchMcpserversOrg(): Promise<McpServersOrgEntry[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.entries;
  }

  try {
    // Fetch the sitemap index first to discover all sub-sitemaps
    const indexRes = await fetchWithRetry(`${MCPSERVERS_ORG_BASE}/sitemap.xml`, {
      timeoutMs: 10000,
      retries: 2,
    });

    if (!indexRes.ok) {
      logger.warn({ status: indexRes.status }, "mcpservers.org sitemap index fetch failed");
      return cache?.entries || [];
    }

    const indexText = await indexRes.text();

    // Extract all sub-sitemap URLs
    const sitemapUrls: string[] = [];
    const locMatches = indexText.matchAll(/<loc>([^<]+)<\/loc>/g);
    for (const m of locMatches) {
      const url = m[1];
      if (url.includes("mcpservers.org/sitemaps/")) {
        sitemapUrls.push(url);
      }
    }

    // Fetch all sub-sitemaps in parallel (batched)
    const BATCH_SIZE = 4;
    const allEntries: McpServersOrgEntry[] = [];

    for (let i = 0; i < sitemapUrls.length; i += BATCH_SIZE) {
      const batch = sitemapUrls.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
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

      for (const result of results) {
        if (result.status === "fulfilled") {
          for (const url of result.value) {
            let source: McpServersOrgEntry["source"] = "servers";
            let slug = "";

            if (url.includes("/remote-mcp-servers/")) {
              source = "remote";
              slug = extractRemoteSlug(url);
            } else if (url.includes("/agent-skills/")) {
              source = "skills";
              slug = extractSkillSlug(url);
            } else if (url.includes("/servers/")) {
              source = "servers";
              slug = extractSlug(url);
            }

            if (slug) {
              allEntries.push({ slug, url, source });
            }
          }
        }
      }

      if (i + BATCH_SIZE < sitemapUrls.length) {
        await sleep(100);
      }
    }

    // Deduplicate by slug
    const seen = new Set<string>();
    const deduped = allEntries.filter((e) => {
      const key = `${e.source}:${e.slug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    cache = { entries: deduped, fetchedAt: Date.now() };
    logger.info(
      {
        total: deduped.length,
        servers: deduped.filter((e) => e.source === "servers").length,
        remote: deduped.filter((e) => e.source === "remote").length,
        skills: deduped.filter((e) => e.source === "skills").length,
      },
      "mcpservers.org sitemap fetched"
    );

    return deduped;
  } catch (err) {
    logger.error({ err }, "mcpservers.org sitemap fetch failed");
    return cache?.entries || [];
  }
}

/**
 * Convert a mcpservers.org entry into a PublicMcpServer-compatible object.
 * The slug is used as the name and we derive metadata from the URL structure.
 */
export function mcpserversOrgToServer(entry: McpServersOrgEntry): {
  id: string;
  source: "mcpservers-org";
  name: string;
  description: string;
  owner: string;
  repoUrl: string;
  transport: "STDIO" | "SSE";
  command?: string;
  endpointUrl?: string;
  requiresAuthToken: boolean;
  category: string;
  isVerified: boolean;
  language: string;
  scope: string;
  tags: string[];
} {
  const slug = entry.slug;
  const parts = slug.split("/");
  const owner = parts.length > 1 ? parts[0] : "community";
  const repoName = parts.length > 1 ? parts[1] : slug;

  // Clean up the name
  const cleanName = repoName
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bMcp\b/gi, "MCP")
    .replace(/\bServer\b/gi, "Server")
    .trim();

  const isRemote = entry.source === "remote";
  const isSkill = entry.source === "skills";
  const isPriority = entry.source === "priority";

  // Derive transport from source type
  const transport: "STDIO" | "SSE" = isRemote ? "SSE" : "STDIO";

  // Build the repo URL
  const repoUrl = `https://github.com/${slug}`;

  // For remote servers, use the mcpservers.org URL as the endpoint hint
  const endpointUrl = isRemote ? entry.url : undefined;

  // For STDIO servers, derive a reasonable npx command
  const command = !isRemote ? `npx -y ${repoName}` : undefined;

  // Detect auth requirement from slug patterns
  const requiresAuth = /api[-_]?key|token|auth|oauth|secret|password/i.test(slug);

  // Detect language from slug patterns
  let language = "unknown";
  if (/python|py\b/i.test(slug)) language = "python";
  else if(/\bgo\b|golang/i.test(slug)) language = "go";
  else if(/rust|rs\b/i.test(slug)) language = "rust";
  else if(/ruby/i.test(slug)) language = "ruby";
  else if(/java\b/i.test(slug)) language = "java";

  // Category — mcpservers.org has categories on their pages but not in sitemaps
  // We'll use a default and the directory route can enrich from the page if needed
  const category = isSkill ? "UTILITIES" : "UTILITIES";

  // Verified — priority servers are verified
  const isVerified = isPriority;

  return {
    id: `mcpservers-org-${entry.source}-${slug.replace(/\//g, "-")}`,
    source: "mcpservers-org" as const,
    name: `${cleanName} MCP`,
    description: `MCP server from mcpservers.org — ${isRemote ? "Remote SSE server" : isSkill ? "Agent skill" : "Local STDIO server"}. Browse at ${entry.url}`,
    owner,
    repoUrl,
    transport,
    command,
    endpointUrl,
    requiresAuthToken: requiresAuth,
    category,
    isVerified,
    language,
    scope: isRemote ? "cloud" : "local",
    tags: [
      "mcpservers-org",
      isRemote ? "remote" : "local",
      isSkill ? "skill" : "server",
      owner.toLowerCase(),
    ].slice(0, 5),
  };
}
