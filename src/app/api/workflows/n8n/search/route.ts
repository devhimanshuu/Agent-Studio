import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized } from "@/lib/api/handlers";
import { fetchWithRetry } from "@/lib/fetch-utils";

export const revalidate = 300;

interface CacheEntry {
  data: any;
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

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const perPage = Math.min(50, parseInt(url.searchParams.get("perPage") || "24", 10));
  const q = url.searchParams.get("q")?.trim() || "";
  const category = url.searchParams.get("category")?.trim() || "";
  const collection = url.searchParams.get("collection")?.trim() || "";

  const cacheKey = `n8n-search:${page}:${perPage}:${q}:${category}:${collection}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      ...cached.data,
      cached: true,
    });
  }

  try {
    const targetUrl = new URL("https://api.n8n.io/templates/search");
    targetUrl.searchParams.set("page", String(page));
    targetUrl.searchParams.set("perPage", String(perPage));
    if (q) targetUrl.searchParams.set("q", q);
    
    if (category && category !== "ALL") {
      const mappedId = CATEGORY_MAP[category] || category;
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
    const rawWorkflows = json.workflows || [];

    const normalizedWorkflows = rawWorkflows.map((wf: any) => {
      const nodes = Array.isArray(wf.nodes) ? wf.nodes : [];
      const nodeIcons = nodes.slice(0, 6).map((n: any) => ({
        name: n.displayName || n.name || "Node",
        icon: n.iconData?.fileBuffer || null,
        type: n.name || n.type,
      }));

      return {
        id: wf.id,
        name: wf.name,
        description: wf.description || "",
        totalViews: wf.totalViews || wf.views || 0,
        createdAt: wf.createdAt,
        user: {
          name: wf.user?.name || "Community",
          username: wf.user?.username || "n8n",
          avatar: wf.user?.avatar || null,
          verified: Boolean(wf.user?.verified),
        },
        nodeCount: nodes.length,
        nodeIcons,
        nodeTypes: Array.from(new Set(nodes.map((n: any) => n.name || n.displayName))).slice(0, 8),
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

    return NextResponse.json({
      success: true,
      ...responsePayload,
    });
  } catch (error: any) {
    console.error("[n8n search API error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to fetch n8n workflows",
        workflows: [],
        pagination: { page, perPage, totalWorkflows: 0, totalPages: 0 },
      },
      { status: 502 }
    );
  }
}
