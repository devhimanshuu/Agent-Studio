import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized } from "@/lib/api/handlers";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { CANVAS_TEMPLATES } from "@/components/canvas/AgentGraphTemplates";
import { WORKFLOW_TEMPLATES } from "@/components/workflows/WorkflowTemplates";

export const revalidate = 300;

interface CacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

const unifiedSearchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

// Studio Built-in Templates normalized
function mapUnifiedCategoryToN8n(cat: string): string {
  const map: Record<string, string> = {
    ai: "AI",
    marketing: "Marketing",
    sales: "Sales",
    support: "Customer Support",
    operations: "Operations",
    it: "Development",
    knowledge: "Langchain",
    finance: "Finance & Accounting",
  };
  return map[cat.toLowerCase()] || "";
}

function mapUnifiedCategoryToDify(cat: string): string {
  const map: Record<string, string> = {
    ai: "ai",
    marketing: "marketing",
    sales: "sales",
    support: "support",
    operations: "operations",
    it: "it",
    knowledge: "knowledge",
    finance: "finance",
  };
  return map[cat.toLowerCase()] || "";
}

// Studio Built-in Templates normalized
function getStudioTemplates(q: string, category: string, tag: string = "") {
  const allStudio = [
    ...CANVAS_TEMPLATES.map((t) => {
      const isZeroKey =
        t.category.includes("ZERO-KEY") ||
        t.badge.includes("ZERO-KEY") ||
        t.id.includes("trending") ||
        t.id.includes("arxiv") ||
        t.id.includes("weather") ||
        t.id.includes("subreddit") ||
        t.id.includes("wiki") ||
        t.id.includes("jina");

      const isOpenSource =
        t.category.includes("OPEN SOURCE") ||
        t.category.includes("SELF-HOSTED") ||
        t.badge.includes("OPEN SOURCE") ||
        t.badge.includes("LOCAL AI") ||
        t.badge.includes("SELF-HOSTED") ||
        t.id.includes("deep_research") ||
        t.id.includes("docling") ||
        t.id.includes("whisper") ||
        t.id.includes("qdrant") ||
        t.id.includes("windmill");

      const icon = isOpenSource
        ? "Layers"
        : isZeroKey
        ? "Globe"
        : t.category.includes("SECURITY")
        ? "Shield"
        : t.category.includes("FINANCE")
        ? "Coins"
        : "Workflow";

      const categories = [
        t.category.toLowerCase(),
        "multi-agent",
        "orchestration",
        ...(isZeroKey ? ["zero-key", "free-api", "open-api", "no-auth"] : []),
        ...(isOpenSource ? ["open-source", "self-hosted", "local-ai", "privacy", "free-api", "zero-key"] : []),
        ...(t.category.includes("SECURITY") ? ["security", "devops", "cve"] : []),
        ...(t.category.includes("FINANCE") ? ["finance", "fintech", "crypto"] : []),
      ];

      return {
        id: `canvas-${t.id}`,
        provider: "studio" as const,
        providerName: "Agent Studio",
        name: t.name,
        description: t.description,
        readme: `### Built-in Agent Studio Blueprint\n\n**Category:** ${t.category}\n**Badge:** ${t.badge}\n\n${t.description}\n\nClick **OPEN IN CANVAS** to customize and run.`,
        author: "Agent Studio",
        authorUrl: "/dashboard/canvas",
        icon,
        iconBackground: isOpenSource ? "#6366F1" : isZeroKey ? "#059669" : "#4338CA",
        categories,
        primaryCategory: isOpenSource ? "open-source" : isZeroKey ? "zero-key" : t.category.toLowerCase(),
        tags: [
          "multi-agent",
          "graph",
          ...(isOpenSource ? ["Open-Source", "Self-Hosted", "Local AI", "Privacy"] : []),
          ...(isZeroKey ? ["Zero-Key", "Free API", "No Key Required"] : []),
          ...t.graph.nodes.map((n) => n.type),
        ],
        pluginTags: [
          ...(isOpenSource ? ["Open-Source", "Self-Hosted"] : isZeroKey ? ["Zero-Key", "Free Public API"] : ["Agent Graph"]),
          t.badge,
        ],
        nodeCount: t.graph.nodes.length,
        usageCount: isOpenSource ? 3200 : isZeroKey ? 2840 : 1420,
        viewsCount: isOpenSource ? 9800 : isZeroKey ? 8900 : 5200,
        version: "1.0.0",
        badges: isOpenSource ? ["official", "blueprint", "open-source", "self-hosted"] : isZeroKey ? ["official", "blueprint", "zero-key", "no-key-required"] : ["official", "blueprint"],
        sourceUrl: `/dashboard/canvas/new?template=${t.id}`,
        canvasUrl: `/dashboard/canvas/new?template=${t.id}`,
        createdAt: new Date().toISOString(),
      };
    }),
    ...WORKFLOW_TEMPLATES.map((t) => {
      const isZeroKey = t.category.includes("ZERO-KEY") || t.badge.includes("ZERO-KEY");
      const isOpenSource = t.category.includes("OPEN SOURCE") || t.badge.includes("OPEN SOURCE") || t.badge.includes("LOCAL AI");
      return {
        id: `workflow-${t.id}`,
        provider: "studio" as const,
        providerName: "Agent Studio",
        name: t.name,
        description: t.purpose,
        readme: `### Enterprise Workflow Starter\n\n**Instructions:**\n${t.instructions}\n\n**Steps:**\n${t.stepsSummary.join(" → ")}\n\n**Allowed Tools:**\n${t.allowedTools.join(", ")}`,
        author: "Enterprise Blueprints",
        authorUrl: "/dashboard/skills",
        icon: isOpenSource ? "Layers" : isZeroKey ? "Globe" : "Shield",
        iconBackground: isOpenSource ? "#4F46E5" : isZeroKey ? "#0D9488" : "#312E81",
        categories: [
          t.category.toLowerCase(),
          ...(isOpenSource ? ["open-source", "self-hosted", "local-ai", "zero-key"] : []),
          ...(isZeroKey ? ["zero-key", "free-api", "open-api"] : ["hitl", "enterprise"]),
        ],
        primaryCategory: isOpenSource ? "open-source" : isZeroKey ? "zero-key" : t.category.toLowerCase(),
        tags: [...t.allowedTools, ...(isOpenSource ? ["Open-Source", "Self-Hosted"] : []), ...(isZeroKey ? ["Zero-Key", "Free API"] : [])],
        pluginTags: t.allowedTools,
        nodeCount: t.stepsSummary.length,
        usageCount: 980,
        viewsCount: 3900,
        version: "1.0.0",
        badges: isOpenSource ? ["open-source", "self-hosted"] : isZeroKey ? ["zero-key", "free-api", "enterprise"] : ["hitl", "enterprise"],
        sourceUrl: `/dashboard/skills/new`,
        canvasUrl: `/dashboard/canvas/new`,
        createdAt: new Date().toISOString(),
      };
    }),
  ];

  let filtered = allStudio;
  const qLower = (q || "").toLowerCase().trim();
  const tagLower = (tag || "").toLowerCase().trim();

  if (qLower) {
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(qLower) ||
        s.description.toLowerCase().includes(qLower) ||
        s.tags.some((t) => t.toLowerCase().includes(qLower)) ||
        s.pluginTags.some((t) => t.toLowerCase().includes(qLower)) ||
        s.badges.some((b) => b.toLowerCase().includes(qLower)) ||
        s.categories.some((c) => c.toLowerCase().includes(qLower))
    );
  }

  if (tagLower) {
    filtered = filtered.filter(
      (s) =>
        s.tags.some((t) => t.toLowerCase().includes(tagLower)) ||
        s.pluginTags.some((t) => t.toLowerCase().includes(tagLower)) ||
        s.name.toLowerCase().includes(tagLower) ||
        s.description.toLowerCase().includes(tagLower) ||
        s.badges.some((b) => b.toLowerCase().includes(tagLower))
    );
  }

  if (category && category !== "ALL") {
    const catLower = category.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.categories.some((c) => c.toLowerCase().includes(catLower)) ||
        s.primaryCategory.toLowerCase() === catLower
    );
  }

  return filtered;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") || "all";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const perPage = Math.min(50, parseInt(url.searchParams.get("perPage") || "18", 10));
  const q = url.searchParams.get("q")?.trim() || "";
  const category = url.searchParams.get("category")?.trim() || "";
  const tag = url.searchParams.get("tag")?.trim() || "";

  const cacheKey = `unified-search:${provider}:${page}:${perPage}:${q}:${category}:${tag}`;
  const cached = unifiedSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      ...cached.data,
      cached: true,
    });
  }

  const effectiveQuery = tag ? `${q} ${tag}`.trim() : q;
  const totalStudioTemplates = CANVAS_TEMPLATES.length + WORKFLOW_TEMPLATES.length;

  try {
    if (provider === "studio") {
      const studioItems = getStudioTemplates(q, category, tag);
      const total = studioItems.length;
      const offset = (page - 1) * perPage;
      const paginated = studioItems.slice(offset, offset + perPage);

      const payload = {
        provider: "studio",
        workflows: paginated,
        stats: {
          total: 11950 + totalStudioTemplates,
          n8n: 11620,
          dify: 292,
          studio: totalStudioTemplates,
        },
        pagination: {
          page,
          perPage,
          totalWorkflows: total,
          totalPages: Math.max(1, Math.ceil(total / perPage)),
        },
      };

      unifiedSearchCache.set(cacheKey, { data: payload, timestamp: Date.now() });
      return NextResponse.json({ success: true, ...payload });
    }

    if (provider === "n8n") {
      const targetUrl = new URL("https://api.n8n.io/templates/search");
      targetUrl.searchParams.set("page", String(page));
      targetUrl.searchParams.set("rows", String(perPage));
      targetUrl.searchParams.set("perPage", String(perPage));

      const n8nCategory = mapUnifiedCategoryToN8n(category);
      if (n8nCategory) {
        targetUrl.searchParams.set("categories", n8nCategory);
      }

      if (category.toLowerCase() === "zero-key" && !effectiveQuery) {
        targetUrl.searchParams.set("search", "API");
      } else if (effectiveQuery) {
        targetUrl.searchParams.set("search", effectiveQuery);
      }

      const res = await fetchWithRetry(targetUrl.toString(), { timeoutMs: 12000, retries: 2 });
      if (!res.ok) throw new Error(`n8n API error ${res.status}`);
      const json = await res.json();

      const rawWorkflows: Record<string, unknown>[] = json.workflows || [];
      const total = json.totalWorkflows ?? json.total ?? rawWorkflows.length;

      const normalized = rawWorkflows.map((w: Record<string, unknown>) => {
        const userObj = (w.user as Record<string, unknown>) || {};
        const categoriesList = Array.isArray(w.categories) ? (w.categories as Array<string | { name?: string }>) : [];
        const nodesList = Array.isArray(w.nodes) ? (w.nodes as Array<string | { name?: string; type?: string }>) : [];

        return {
          id: w.id,
          provider: "n8n" as const,
          providerName: "n8n",
          name: w.name || `n8n Workflow #${w.id}`,
          description: w.description || "",
          readme: w.description || "",
          author: userObj.username || userObj.name || "n8n Community",
          authorUrl: `https://n8n.io/workflows/${w.id}`,
          icon: "Workflow",
          iconBackground: "#F0506E",
          categories: categoriesList.map((c) => (typeof c === "string" ? c : c.name || "Automation")),
          primaryCategory: (typeof categoriesList[0] === "string" ? categoriesList[0] : categoriesList[0]?.name || "automation").toLowerCase(),
          tags: nodesList.map((n) => (typeof n === "string" ? n : n.name || n.type || "node")),
          pluginTags: nodesList.map((n) => {
            const typeStr = typeof n === "string" ? n : n.type || n.name || "";
            return String(typeStr).replace(/^n8n-nodes-base\./, "");
          }).slice(0, 4),
          nodeCount: nodesList.length,
          usageCount: 0,
          viewsCount: w.views || w.totalViews || 0,
          version: "1.0.0",
          badges: ["community"],
          sourceUrl: `https://n8n.io/workflows/${w.id}`,
          canvasUrl: `/dashboard/canvas/new?n8nId=${w.id}`,
          createdAt: w.createdAt,
        };
      });

      const payload = {
        provider: "n8n",
        workflows: normalized,
        stats: {
          total: (total || 11620) + 292 + totalStudioTemplates,
          n8n: total || 11620,
          dify: 292,
          studio: totalStudioTemplates,
        },
        pagination: {
          page,
          perPage,
          totalWorkflows: total,
          totalPages: Math.max(1, Math.ceil(total / perPage)),
        },
      };

      unifiedSearchCache.set(cacheKey, { data: payload, timestamp: Date.now() });
      return NextResponse.json({ success: true, ...payload });
    }

    if (provider === "dify") {
      const targetUrl = new URL("https://marketplace.dify.ai/api/v1/templates");
      targetUrl.searchParams.set("page", String(page));
      targetUrl.searchParams.set("page_size", String(perPage));
      targetUrl.searchParams.set("limit", String(perPage));

      const difyCategory = mapUnifiedCategoryToDify(category);
      if (difyCategory) {
        targetUrl.searchParams.set("category", difyCategory);
      }

      if (category.toLowerCase() === "zero-key" && !effectiveQuery) {
        targetUrl.searchParams.set("search", "api");
      } else if (effectiveQuery) {
        targetUrl.searchParams.set("search", effectiveQuery);
      }

      const res = await fetchWithRetry(targetUrl.toString(), { timeoutMs: 12000, retries: 2 });
      if (!res.ok) throw new Error(`Dify API error ${res.status}`);
      const json = await res.json();

      const rawTemplates: Record<string, unknown>[] = json.data?.templates || json.templates || [];
      const total = json.data?.total ?? json.total ?? rawTemplates.length;

      const normalized = rawTemplates.map((t: Record<string, unknown>) => {
        const plugins = Array.isArray(t.deps_plugins) ? (t.deps_plugins as string[]) : [];
        const pluginTags = plugins.map((p: string) => {
          const parts = p.split("/");
          return parts[parts.length - 1] || p;
        });

        const categories = Array.isArray(t.categories) ? (t.categories as string[]) : ["operations"];

        return {
          id: t.id,
          provider: "dify" as const,
          providerName: "Dify.ai",
          name: t.template_name || t.name || "Dify Workflow",
          description: t.overview || t.description || "",
          readme: t.readme || "",
          author: t.publisher_unique_handle || (t.publisher_type === "organization" ? "Dify Team" : "Community"),
          authorUrl: `https://marketplace.dify.ai/templates/${t.id}`,
          icon: t.icon || "Layers",
          iconBackground: t.icon_background || "#1C64F2",
          categories,
          primaryCategory: (categories[0] || "operations").toLowerCase(),
          tags: pluginTags,
          pluginTags,
          nodeCount: 0,
          usageCount: typeof t.usage_count === "number" ? t.usage_count : 0,
          viewsCount: 0,
          version: t.version || "1.0.0",
          badges: Array.isArray(t.badges) ? t.badges : [],
          sourceUrl: `https://marketplace.dify.ai/templates/${t.id}`,
          canvasUrl: `/dashboard/canvas/new?difyId=${t.id}`,
          createdAt: t.created_at,
        };
      });

      const payload = {
        provider: "dify",
        workflows: normalized,
        stats: {
          total: 11620 + (total || 292) + totalStudioTemplates,
          n8n: 11620,
          dify: total || 292,
          studio: totalStudioTemplates,
        },
        pagination: {
          page,
          perPage,
          totalWorkflows: total,
          totalPages: Math.max(1, Math.ceil(total / perPage)),
        },
      };

      unifiedSearchCache.set(cacheKey, { data: payload, timestamp: Date.now() });
      return NextResponse.json({ success: true, ...payload });
    }

    // Default: ALL PROVIDERS (Aggregated multi-source)
    const isZeroKeyCategory = category.toLowerCase() === "zero-key";
    const n8nCategory = mapUnifiedCategoryToN8n(category);
    const difyCategory = mapUnifiedCategoryToDify(category);

    const [n8nRes, difyRes] = await Promise.allSettled([
      (async () => {
        const n8nUrl = new URL("https://api.n8n.io/templates/search");
        n8nUrl.searchParams.set("page", String(page));
        n8nUrl.searchParams.set("rows", String(Math.ceil(perPage * 0.7))); // 12 items
        n8nUrl.searchParams.set("perPage", String(Math.ceil(perPage * 0.7)));
        if (effectiveQuery) n8nUrl.searchParams.set("search", effectiveQuery);
        else if (isZeroKeyCategory) n8nUrl.searchParams.set("search", "API");
        if (n8nCategory) n8nUrl.searchParams.set("categories", n8nCategory);

        const res = await fetchWithRetry(n8nUrl.toString(), { timeoutMs: 12000, retries: 1 });
        if (!res.ok) return { total: 11620, workflows: [] };
        const json = await res.json();
        return {
          total: json.totalWorkflows ?? json.total ?? 11620,
          workflows: json.workflows || [],
        };
      })(),
      (async () => {
        const difyUrl = new URL("https://marketplace.dify.ai/api/v1/templates");
        difyUrl.searchParams.set("page", String(page));
        difyUrl.searchParams.set("page_size", String(Math.ceil(perPage * 0.3))); // 6 items
        difyUrl.searchParams.set("limit", String(Math.ceil(perPage * 0.3)));
        if (effectiveQuery) difyUrl.searchParams.set("search", effectiveQuery);
        else if (isZeroKeyCategory) difyUrl.searchParams.set("search", "api");
        if (difyCategory) difyUrl.searchParams.set("category", difyCategory);

        const res = await fetchWithRetry(difyUrl.toString(), { timeoutMs: 12000, retries: 1 });
        if (!res.ok) return { total: 292, workflows: [] };
        const json = await res.json();
        return {
          total: json.data?.total ?? json.total ?? 292,
          workflows: json.data?.templates || json.templates || [],
        };
      })(),
    ]);

    const n8nData = n8nRes.status === "fulfilled" ? n8nRes.value : { total: 11620, workflows: [] };
    const difyData = difyRes.status === "fulfilled" ? difyRes.value : { total: 292, workflows: [] };
    const studioAll = getStudioTemplates(q, category, tag);
    const studioData = isZeroKeyCategory
      ? studioAll.slice((page - 1) * perPage, page * perPage)
      : page === 1
      ? studioAll.slice(0, 4)
      : [];

    const normalizedN8n = (n8nData.workflows || []).map((w: Record<string, unknown>) => {
      const userObj = (w.user as Record<string, unknown>) || {};
      const categoriesList = Array.isArray(w.categories) ? (w.categories as Array<string | { name?: string }>) : [];
      const nodesList = Array.isArray(w.nodes) ? (w.nodes as Array<string | { name?: string; type?: string }>) : [];

      return {
        id: w.id,
        provider: "n8n" as const,
        providerName: "n8n",
        name: w.name || `n8n Workflow #${w.id}`,
        description: w.description || "",
        readme: w.description || "",
        author: userObj.username || userObj.name || "n8n Community",
        authorUrl: `https://n8n.io/workflows/${w.id}`,
        icon: "Workflow",
        iconBackground: "#F0506E",
        categories: categoriesList.map((c) => (typeof c === "string" ? c : c.name || "Automation")),
        primaryCategory: (typeof categoriesList[0] === "string" ? categoriesList[0] : categoriesList[0]?.name || "automation").toLowerCase(),
        tags: nodesList.map((n) => (typeof n === "string" ? n : n.name || n.type || "node")),
        pluginTags: nodesList.map((n) => {
          const typeStr = typeof n === "string" ? n : n.type || n.name || "";
          return String(typeStr).replace(/^n8n-nodes-base\./, "");
        }).slice(0, 4),
        nodeCount: nodesList.length,
        usageCount: 0,
        viewsCount: w.views || w.totalViews || 0,
        version: "1.0.0",
        badges: ["community"],
        sourceUrl: `https://n8n.io/workflows/${w.id}`,
        canvasUrl: `/dashboard/canvas/new?n8nId=${w.id}`,
        createdAt: w.createdAt,
      };
    });

    const normalizedDify = (difyData.workflows || []).map((t: Record<string, unknown>) => {
      const plugins = Array.isArray(t.deps_plugins) ? (t.deps_plugins as string[]) : [];
      const pluginTags = plugins.map((p: string) => {
        const parts = p.split("/");
        return parts[parts.length - 1] || p;
      });

      return {
        id: t.id,
        provider: "dify" as const,
        providerName: "Dify.ai",
        name: t.template_name || t.name || "Dify Workflow",
        description: t.overview || t.description || "",
        readme: t.readme || "",
        author: t.publisher_unique_handle || (t.publisher_type === "organization" ? "Dify Team" : "Community"),
        authorUrl: `https://marketplace.dify.ai/templates/${t.id}`,
        icon: t.icon || "Layers",
        iconBackground: t.icon_background || "#1C64F2",
        categories: Array.isArray(t.categories) ? t.categories : ["operations"],
        primaryCategory: ((Array.isArray(t.categories) ? t.categories[0] : "operations") || "operations").toLowerCase(),
        tags: pluginTags,
        pluginTags,
        nodeCount: 0,
        usageCount: typeof t.usage_count === "number" ? t.usage_count : 0,
        viewsCount: 0,
        version: t.version || "1.0.0",
        badges: Array.isArray(t.badges) ? t.badges : [],
        sourceUrl: `https://marketplace.dify.ai/templates/${t.id}`,
        canvasUrl: `/dashboard/canvas/new?difyId=${t.id}`,
        createdAt: t.created_at,
      };
    });

    // Interleave Studio, Dify, and n8n items for rich multi-provider presentation
    const combinedWorkflows = [];
    let i = 0, j = 0, k = 0;

    // If zero-key category, put Studio zero-key templates first
    if (isZeroKeyCategory) {
      while (k < studioData.length) {
        combinedWorkflows.push(studioData[k++]);
      }
    }

    while (
      (i < normalizedN8n.length || j < normalizedDify.length || k < studioData.length) &&
      combinedWorkflows.length < perPage
    ) {
      if (k < studioData.length) combinedWorkflows.push(studioData[k++]);
      if (j < normalizedDify.length && combinedWorkflows.length < perPage) combinedWorkflows.push(normalizedDify[j++]);
      if (i < normalizedN8n.length && combinedWorkflows.length < perPage) combinedWorkflows.push(normalizedN8n[i++]);
      if (i < normalizedN8n.length && combinedWorkflows.length < perPage) combinedWorkflows.push(normalizedN8n[i++]);
    }

    const totalWorkflows =
      (n8nData.total || 11620) + (difyData.total || 292) + (studioAll.length || totalStudioTemplates);

    const payload = {
      provider: "all",
      workflows: combinedWorkflows,
      stats: {
        total: totalWorkflows,
        n8n: n8nData.total || 11620,
        dify: difyData.total || 292,
        studio: totalStudioTemplates,
      },
      pagination: {
        page,
        perPage,
        totalWorkflows: isZeroKeyCategory ? studioAll.length : totalWorkflows,
        totalPages: Math.max(1, Math.ceil((isZeroKeyCategory ? studioAll.length : totalWorkflows) / perPage)),
      },
    };

    unifiedSearchCache.set(cacheKey, { data: payload, timestamp: Date.now() });
    return NextResponse.json({ success: true, ...payload });
  } catch (error: unknown) {
    console.error("[Unified workflows search API error]:", error);
    const message = error instanceof Error ? error.message : "Failed to search workflows";
    return NextResponse.json(
      {
        success: false,
        error: message,
        workflows: [],
        stats: { total: 11950, n8n: 11620, dify: 292, studio: totalStudioTemplates },
        pagination: { page, perPage, totalWorkflows: 0, totalPages: 0 },
      },
      { status: 502 }
    );
  }
}
