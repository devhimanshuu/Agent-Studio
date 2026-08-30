import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized } from "@/lib/api/handlers";
import { fetchWithRetry } from "@/lib/fetch-utils";

export const revalidate = 300;

interface CacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

const difySearchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

async function fetchDifyRawPage(
  page: number,
  perPage: number,
  q: string,
  category: string
) {
  const targetUrl = new URL("https://marketplace.dify.ai/api/v1/templates");
  targetUrl.searchParams.set("page", String(page));
  targetUrl.searchParams.set("page_size", String(perPage));
  targetUrl.searchParams.set("limit", String(perPage));

  if (q) {
    targetUrl.searchParams.set("search", q);
    targetUrl.searchParams.set("q", q);
    targetUrl.searchParams.set("keyword", q);
  }

  if (category && category !== "ALL") {
    targetUrl.searchParams.set("category", category.toLowerCase());
  }

  const res = await fetchWithRetry(targetUrl.toString(), {
    timeoutMs: 12000,
    retries: 2,
  });

  if (!res.ok) {
    throw new Error(`Dify marketplace API responded with status ${res.status}`);
  }

  const json = await res.json();
  const rawTemplates: Record<string, unknown>[] = json.data?.templates || json.templates || [];
  const total = json.data?.total ?? json.total ?? rawTemplates.length;

  return { total, rawTemplates };
}

async function fetchAndCacheDifySearch(
  page: number,
  perPage: number,
  q: string,
  category: string
) {
  const cacheKey = `dify-search:${page}:${perPage}:${q}:${category}`;
  const cached = difySearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const { total, rawTemplates: initialTemplates } = await fetchDifyRawPage(page, perPage, q, category);
  let rawTemplates = initialTemplates;

  // Client-side search filtering fallback if upstream API did not filter by keyword
  if (q && rawTemplates.length > 0) {
    const qLower = q.toLowerCase().trim();
    const filtered = rawTemplates.filter((t) => {
      const name = String(t.template_name || t.name || "").toLowerCase();
      const overview = String(t.overview || t.description || "").toLowerCase();
      const tags = Array.isArray(t.categories) ? (t.categories as string[]).map((c: string) => c.toLowerCase()) : [];
      const plugins = Array.isArray(t.deps_plugins) ? (t.deps_plugins as string[]).map((p: string) => p.toLowerCase()) : [];
      return (
        name.includes(qLower) ||
        overview.includes(qLower) ||
        tags.some((c: string) => c.includes(qLower)) ||
        plugins.some((p: string) => p.includes(qLower))
      );
    });
    if (filtered.length > 0) {
      rawTemplates = filtered;
    }
  }

  // Client-side category filtering fallback if upstream did not filter
  if (category && category !== "ALL" && rawTemplates.length > 0) {
    const catLower = category.toLowerCase().trim();
    const catFiltered = rawTemplates.filter((t) => {
      const cats = Array.isArray(t.categories) ? (t.categories as string[]).map((c: string) => c.toLowerCase()) : [];
      return cats.includes(catLower);
    });
    if (catFiltered.length > 0) {
      rawTemplates = catFiltered;
    }
  }

  const normalizedWorkflows = rawTemplates.map((t: Record<string, unknown>) => {
    const plugins = Array.isArray(t.deps_plugins) ? (t.deps_plugins as string[]) : [];
    const pluginTags = plugins.map((p: string) => {
      const parts = p.split("/");
      return parts[parts.length - 1] || p;
    });

    return {
      id: t.id,
      name: t.template_name || t.name || "Dify Workflow",
      description: t.overview || t.description || "",
      readme: t.readme || "",
      categories: Array.isArray(t.categories) ? t.categories : ["operations"],
      depsPlugins: plugins,
      pluginTags,
      preferredLanguages: t.preferred_languages || ["en"],
      icon: t.icon || null,
      iconBackground: t.icon_background || "#EFF1F5",
      iconFileKey: t.icon_file_key || null,
      author: t.publisher_unique_handle || (t.publisher_type === "organization" ? "Dify Team" : "Community"),
      publisherType: t.publisher_type || "individual",
      usageCount: typeof t.usage_count === "number" ? t.usage_count : 0,
      version: t.version || "1.0.0",
      badges: Array.isArray(t.badges) ? t.badges : [],
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      source: "dify",
      url: `https://marketplace.dify.ai/templates/${t.id}`,
    };
  });

  const responsePayload = {
    workflows: normalizedWorkflows,
    pagination: {
      page,
      perPage,
      totalWorkflows: total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    },
  };

  difySearchCache.set(cacheKey, {
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

  try {
    const responsePayload = await fetchAndCacheDifySearch(page, perPage, q, category);

    // Background prefetch next page into cache if more pages exist
    if (page < (responsePayload.pagination as { totalPages: number }).totalPages) {
      const nextPage = page + 1;
      const nextCacheKey = `dify-search:${nextPage}:${perPage}:${q}:${category}`;
      if (!difySearchCache.has(nextCacheKey)) {
        fetchAndCacheDifySearch(nextPage, perPage, q, category).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      ...responsePayload,
    });
  } catch (error: unknown) {
    console.error("[Dify templates search API error]:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch Dify workflow templates";
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
