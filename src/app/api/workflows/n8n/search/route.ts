import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized } from "@/lib/api/handlers";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { logger } from "@/lib/logger";

export const revalidate = 300;

interface CacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const CATEGORY_MAP: Record<string, string> = {
  "AI": "25",
  "Langchain": "48",
  "RAG": "48",
  "Communication": "13",
  "Support": "13",
  "Data & Storage": "30",
  "Development": "16",
  "DevOps": "16",
  "Productivity": "11",
  "Sales": "2",
  "CRM": "39",
  "Marketing": "27",
};

async function fetchN8nRawPage(
  n8nPage: number,
  q: string,
  category: string,
  collection: string,
  rowsLimit: number = 18
) {
  const targetUrl = new URL("https://api.n8n.io/templates/search");
  targetUrl.searchParams.set("page", String(n8nPage));
  targetUrl.searchParams.set("rows", String(rowsLimit));
  targetUrl.searchParams.set("limit", String(rowsLimit));
  targetUrl.searchParams.set("perPage", String(rowsLimit));
  targetUrl.searchParams.set("pageSize", String(rowsLimit));
  if (q) {
    targetUrl.searchParams.set("search", q);
    targetUrl.searchParams.set("q", q);
  }

  if (category && category !== "ALL") {
    const mappedId = CATEGORY_MAP[category] || category;
    targetUrl.searchParams.set("category", mappedId);
    targetUrl.searchParams.set("categories", mappedId);
  }
  if (collection) targetUrl.searchParams.set("collection", collection);

  const res = await fetchWithRetry(targetUrl.toString(), {
    timeoutMs: 12000,
    retries: 2,
  });

  if (!res.ok) {
    throw new Error(`n8n API responded with status ${res.status}`);
  }

  const json = await res.json();
  const totalWorkflows = json.totalWorkflows || json.total || (json.workflows || []).length;
  const rawWorkflows: Record<string, unknown>[] = json.workflows || json.templates || json.data || [];
  return { totalWorkflows, rawWorkflows };
}

async function fetchAndCacheSearch(
  page: number,
  perPage: number,
  q: string,
  category: string,
  collection: string
) {
  const cacheKey = `n8n-search:${page}:${perPage}:${q}:${category}:${collection}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Fetch initial batch
  const { totalWorkflows, rawWorkflows: initialWorkflows } = await fetchN8nRawPage(page, q, category, collection, perPage);
  let rawWorkflows = initialWorkflows;

  // 2. If upstream n8n API hard-caps at 10 items per page, stitch upstream pages to provide exact 18 items
  const startIndex = (page - 1) * perPage;
  if (rawWorkflows.length < perPage && rawWorkflows.length > 0 && startIndex + rawWorkflows.length < totalWorkflows) {
    const upstreamPageSize = rawWorkflows.length; // usually 10
    const u1 = Math.floor(startIndex / upstreamPageSize) + 1;
    const u2 = Math.floor((startIndex + perPage - 1) / upstreamPageSize) + 1;
    const offset = startIndex % upstreamPageSize;

    const fetches: Promise<{ rawWorkflows: Record<string, unknown>[] }>[] = [];
    for (let u = u1; u <= u2; u++) {
      fetches.push(fetchN8nRawPage(u, q, category, collection, upstreamPageSize));
    }

    try {
      const results = await Promise.all(fetches);
      const combined = results.flatMap((r) => r.rawWorkflows);
      rawWorkflows = combined.slice(offset, offset + perPage);
    } catch {
      // If stitching fails, fall back to initial batch
    }
  }

  const normalizedWorkflows = rawWorkflows.map((wf: Record<string, unknown>) => {
    const nodes = Array.isArray(wf.nodes) ? (wf.nodes as Record<string, unknown>[]) : [];
    const nodeIcons = nodes.slice(0, 6).map((n: Record<string, unknown>) => ({
      name: String(n.displayName || n.name || "Node"),
      icon: (n.iconData as Record<string, unknown>)?.fileBuffer ? String((n.iconData as Record<string, unknown>).fileBuffer) : null,
      type: String(n.name || n.type || "unknown"),
    }));

    const userObj = (wf.user as Record<string, unknown>) || {};

    return {
      id: wf.id,
      name: wf.name,
      description: wf.description || "",
      totalViews: wf.totalViews || wf.views || 0,
      createdAt: wf.createdAt,
      user: {
        name: userObj.name || "Community",
        username: userObj.username || "n8n",
        avatar: userObj.avatar || null,
        verified: Boolean(userObj.verified),
      },
      nodeCount: nodes.length,
      nodeIcons,
      nodeTypes: Array.from(new Set(nodes.map((n: Record<string, unknown>) => String(n.name || n.displayName || "")))).slice(0, 8),
      url: `https://n8n.io/workflows/${wf.id}`,
    };
  });

  const responsePayload = {
    workflows: normalizedWorkflows,
    pagination: {
      page,
      perPage,
      totalWorkflows,
      totalPages: Math.ceil(totalWorkflows / perPage),
    },
  };

  searchCache.set(cacheKey, {
    data: responsePayload,
    timestamp: Date.now(),
  });

  return responsePayload;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const perPage = Math.min(50, parseInt(url.searchParams.get("perPage") || "18", 10));
  const q = url.searchParams.get("q")?.trim() || "";
  const category = url.searchParams.get("category")?.trim() || "";
  const collection = url.searchParams.get("collection")?.trim() || "";

  try {
    const responsePayload = await fetchAndCacheSearch(page, perPage, q, category, collection);

    // Background prefetch next page into cache if more pages exist
    if (page < (responsePayload.pagination as { totalPages: number }).totalPages) {
      const nextPage = page + 1;
      const nextCacheKey = `n8n-search:${nextPage}:${perPage}:${q}:${category}:${collection}`;
      if (!searchCache.has(nextCacheKey)) {
        fetchAndCacheSearch(nextPage, perPage, q, category, collection).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      ...responsePayload,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "n8n search API error");
    const message = error instanceof Error ? error.message : "Failed to fetch n8n workflows";
    return NextResponse.json(
      {
        success: false,
        error: message,
        workflows: [],
        pagination: { page, perPage, totalWorkflows: 0, totalPages: 0 },
      },
      { status: 502 }
    );
  }
}
