/**
 * Composio toolkit and tools catalog fetchers.
 */

import { fetchWithRetry, sleep } from "@/lib/fetch-utils";
import { logger } from "@/lib/logger";

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3.1";
const COMPOSIO_CACHE_TTL = 3600_000;

// ────────────── Toolkits ──────────────

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

interface ComposioCacheEntry {
  toolkits: ComposioToolkit[];
  totalCount: number;
  fetchedAt: number;
}

let composioCache: ComposioCacheEntry | null = null;

/**
 * Fetch all Composio toolkits from their API (1000+ toolkits).
 */
export async function fetchComposioToolkits(): Promise<ComposioToolkit[]> {
  if (composioCache && Date.now() - composioCache.fetchedAt < COMPOSIO_CACHE_TTL) {
    return composioCache.toolkits;
  }

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    logger.info("Composio: No API key configured, skipping");
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
          categories: (item.meta?.categories || []).map((c: { id?: string; name?: string }) => ({
            id: c.id,
            name: c.name,
          })),
          noAuth: item.no_auth || false,
        });
      }

      hasMore = items.length === limit;
      offset += limit;
      if (offset >= 2000) break;
      if (hasMore) await sleep(100);
    }

    composioCache = {
      toolkits: allToolkits,
      totalCount: allToolkits.length,
      fetchedAt: Date.now(),
    };

    logger.info({ count: allToolkits.length }, "Composio toolkits fetched");
    return allToolkits;
  } catch (err) {
    logger.error({ err }, "Composio toolkits fetch failed");
    return composioCache?.toolkits || [];
  }
}

// ────────────── Tools (Individual Actions) ──────────────

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
const COMPOSIO_TOOLS_CACHE_TTL = 3600_000;

async function fetchComposioToolsPage(
  cursor?: string,
  limit = 100,
  _toolkitFilter?: string
): Promise<{ tools: ComposioTool[]; nextCursor: string | null; totalItems: number }> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return { tools: [], nextCursor: null, totalItems: 0 };

  try {
    let url = `${COMPOSIO_BASE}/tools?limit=${limit}&toolkit_versions=latest`;
    if (cursor) url += `&cursor=${cursor}`;

    const res = await fetchWithRetry(url, {
      timeoutMs: 15000,
      retries: 2,
      headers: { "x-api-key": apiKey },
    });

    if (!res.ok) return { tools: [], nextCursor: null, totalItems: 0 };
    const json = await res.json();

    const tools: ComposioTool[] = (json.items || []).map((t: Record<string, unknown>) => {
      const toolkit = (t.toolkit as Record<string, unknown>) || {};
      const categories = (toolkit.categories as Record<string, unknown>[]) || [];
      return {
        slug: (t.slug as string) || "",
        name: (t.name as string) || "",
        description: (t.description as string) || "",
        toolkitSlug: (toolkit.slug as string) || "unknown",
        toolkitName: (toolkit.name as string) || "Unknown",
        toolkitLogo: (toolkit.logo as string) || "",
        inputSchema: (t.input_parameters as Record<string, unknown>) || {},
        outputSchema: (t.output_parameters as Record<string, unknown>) || {},
        category: (categories[0]?.name as string) || "other",
        authType: (t.auth_type as string) || "unknown",
      };
    });

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

  while (allTools.length < maxTools) {
    const result = await fetchComposioToolsPage(cursor || undefined, 100);
    if (result.tools.length === 0) break;

    allTools.push(...result.tools);
    totalItems = result.totalItems;
    cursor = result.nextCursor;

    if (!cursor) break;
    await sleep(100);
  }

  composioToolsCache = {
    tools: allTools,
    totalCount: totalItems,
    fetchedAt: Date.now(),
  };

  logger.info({ count: allTools.length, totalAvailable: totalItems }, "Composio tools fetched");
  return allTools;
}
