import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized } from "@/lib/api/handlers";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { CANVAS_TEMPLATES } from "@/components/canvas/AgentGraphTemplates";
import { WORKFLOW_TEMPLATES } from "@/components/workflows/WorkflowTemplates";

export const revalidate = 300;

interface CacheEntry {
  data: any;
  timestamp: number;
}

const unifiedSearchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

// Studio Built-in Templates normalized
function getStudioTemplates(q: string, category: string) {
  const allStudio = [
    ...CANVAS_TEMPLATES.map((t) => ({
      id: `canvas-${t.id}`,
      provider: "studio" as const,
      providerName: "Agent Studio",
      name: t.name,
      description: t.description,
      readme: `### Built-in Agent Studio Blueprint\n\n**Category:** ${t.category}\n**Badge:** ${t.badge}\n\n${t.description}\n\nClick **OPEN IN CANVAS** to customize and run.`,
      author: "Agent Studio",
      authorUrl: "/dashboard/canvas",
      icon: "⚡",
      iconBackground: "#4338CA",
      categories: [t.category.toLowerCase(), "multi-agent", "orchestration"],
      primaryCategory: t.category.toLowerCase(),
      tags: ["multi-agent", "graph", "supervisor", "critic"],
      pluginTags: ["Agent Graph", "Supervisor", "Critic"],
      nodeCount: t.graph.nodes.length,
      usageCount: 1420,
      viewsCount: 5200,
      version: "1.0.0",
      badges: ["official", "blueprint"],
      sourceUrl: `/dashboard/canvas/new?template=${t.id}`,
      canvasUrl: `/dashboard/canvas/new?template=${t.id}`,
      createdAt: new Date().toISOString(),
    })),
    ...WORKFLOW_TEMPLATES.map((t) => ({
      id: `workflow-${t.id}`,
      provider: "studio" as const,
      providerName: "Agent Studio",
      name: t.name,
      description: t.purpose,
      readme: `### Enterprise Workflow Starter\n\n**Instructions:**\n${t.instructions}\n\n**Steps:**\n${t.stepsSummary.join(" → ")}\n\n**Allowed Tools:**\n${t.allowedTools.join(", ")}`,
      author: "Enterprise Blueprints",
      authorUrl: "/dashboard/skills",
      icon: "🛡️",
      iconBackground: "#312E81",
      categories: [t.category.toLowerCase(), "hitl", "enterprise"],
      primaryCategory: t.category.toLowerCase(),
      tags: t.allowedTools,
      pluginTags: t.allowedTools,
      nodeCount: t.stepsSummary.length,
      usageCount: 890,
      viewsCount: 3400,
      version: "1.0.0",
      badges: ["hitl", "enterprise"],
      sourceUrl: `/dashboard/skills/new`,
      canvasUrl: `/dashboard/canvas/new`,
      createdAt: new Date().toISOString(),
    })),
  ];

  let filtered = allStudio;
  if (q) {
    const qLower = q.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(qLower) ||
        s.description.toLowerCase().includes(qLower) ||
        s.tags.some((tag) => tag.toLowerCase().includes(qLower))
    );
  }

  if (category && category !== "ALL") {
    const catLower = category.toLowerCase();
    filtered = filtered.filter((s) => s.categories.some((c) => c.includes(catLower)));
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

  try {
    if (provider === "studio") {
      const studioItems = getStudioTemplates(effectiveQuery, category);
      const total = studioItems.length;
      const offset = (page - 1) * perPage;
      const paginated = studioItems.slice(offset, offset + perPage);

      const payload = {
        provider: "studio",
        workflows: paginated,
        stats: {
          total: 11950,
          n8n: 11620,
          dify: 292,
          studio: studioItems.length,
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
      if (effectiveQuery) targetUrl.searchParams.set("search", effectiveQuery);
      if (category && category !== "ALL") targetUrl.searchParams.set("categories", category);

      const res = await fetchWithRetry(targetUrl.toString(), { timeoutMs: 12000, retries: 2 });
      if (!res.ok) throw new Error(`n8n API error ${res.status}`);
      const json = await res.json();

      const rawWorkflows: any[] = json.workflows || [];
      const total = json.totalWorkflows ?? json.total ?? rawWorkflows.length;

      const normalized = rawWorkflows.map((w: any) => ({
        id: w.id,
        provider: "n8n" as const,
        providerName: "n8n",
        name: w.name || `n8n Workflow #${w.id}`,
        description: w.description || "",
        readme: w.description || "",
        author: w.user?.username || w.user?.name || "n8n Community",
        authorUrl: `https://n8n.io/workflows/${w.id}`,
        icon: "⚡",
        iconBackground: "#F0506E",
        categories: (w.categories || []).map((c: any) => (typeof c === "string" ? c : c.name || "Automation")),
        primaryCategory: (w.categories?.[0]?.name || w.categories?.[0] || "automation").toLowerCase(),
        tags: (w.nodes || []).map((n: any) => (typeof n === "string" ? n : n.name || n.type)),
        pluginTags: (w.nodes || []).map((n: any) => {
          const typeStr = typeof n === "string" ? n : n.type || n.name || "";
          return typeStr.replace(/^n8n-nodes-base\./, "");
        }).slice(0, 4),
        nodeCount: Array.isArray(w.nodes) ? w.nodes.length : 0,
        usageCount: 0,
        viewsCount: w.views || w.totalViews || 0,
        version: "1.0.0",
        badges: ["community"],
        sourceUrl: `https://n8n.io/workflows/${w.id}`,
        canvasUrl: `/dashboard/canvas/new?n8nId=${w.id}`,
        createdAt: w.createdAt,
      }));

      const payload = {
        provider: "n8n",
        workflows: normalized,
        stats: {
          total: 11950,
          n8n: total || 11620,
          dify: 292,
          studio: 15,
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
      if (effectiveQuery) targetUrl.searchParams.set("search", effectiveQuery);
      if (category && category !== "ALL") targetUrl.searchParams.set("category", category.toLowerCase());

      const res = await fetchWithRetry(targetUrl.toString(), { timeoutMs: 12000, retries: 2 });
      if (!res.ok) throw new Error(`Dify API error ${res.status}`);
      const json = await res.json();

      const rawTemplates: any[] = json.data?.templates || json.templates || [];
      const total = json.data?.total ?? json.total ?? rawTemplates.length;

      const normalized = rawTemplates.map((t: any) => {
        const plugins = Array.isArray(t.deps_plugins) ? t.deps_plugins : [];
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
          icon: t.icon || "🤖",
          iconBackground: t.icon_background || "#1C64F2",
          categories: Array.isArray(t.categories) ? t.categories : ["operations"],
          primaryCategory: (t.categories?.[0] || "operations").toLowerCase(),
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
          total: 11950,
          n8n: 11620,
          dify: total || 292,
          studio: 15,
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
    const [n8nRes, difyRes] = await Promise.allSettled([
      (async () => {
        const n8nUrl = new URL("https://api.n8n.io/templates/search");
        n8nUrl.searchParams.set("page", String(page));
        n8nUrl.searchParams.set("rows", String(Math.ceil(perPage * 0.7))); // 12 items
        n8nUrl.searchParams.set("perPage", String(Math.ceil(perPage * 0.7)));
        if (effectiveQuery) n8nUrl.searchParams.set("search", effectiveQuery);
        if (category && category !== "ALL") n8nUrl.searchParams.set("categories", category);

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
        if (category && category !== "ALL") difyUrl.searchParams.set("category", category.toLowerCase());

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
    const studioData = page === 1 ? getStudioTemplates(effectiveQuery, category).slice(0, 2) : [];

    const normalizedN8n = (n8nData.workflows || []).map((w: any) => ({
      id: w.id,
      provider: "n8n" as const,
      providerName: "n8n",
      name: w.name || `n8n Workflow #${w.id}`,
      description: w.description || "",
      readme: w.description || "",
      author: w.user?.username || w.user?.name || "n8n Community",
      authorUrl: `https://n8n.io/workflows/${w.id}`,
      icon: "⚡",
      iconBackground: "#F0506E",
      categories: (w.categories || []).map((c: any) => (typeof c === "string" ? c : c.name || "Automation")),
      primaryCategory: (w.categories?.[0]?.name || w.categories?.[0] || "automation").toLowerCase(),
      tags: (w.nodes || []).map((n: any) => (typeof n === "string" ? n : n.name || n.type)),
      pluginTags: (w.nodes || []).map((n: any) => {
        const typeStr = typeof n === "string" ? n : n.type || n.name || "";
        return typeStr.replace(/^n8n-nodes-base\./, "");
      }).slice(0, 4),
      nodeCount: Array.isArray(w.nodes) ? w.nodes.length : 0,
      usageCount: 0,
      viewsCount: w.views || w.totalViews || 0,
      version: "1.0.0",
      badges: ["community"],
      sourceUrl: `https://n8n.io/workflows/${w.id}`,
      canvasUrl: `/dashboard/canvas/new?n8nId=${w.id}`,
      createdAt: w.createdAt,
    }));

    const normalizedDify = (difyData.workflows || []).map((t: any) => {
      const plugins = Array.isArray(t.deps_plugins) ? t.deps_plugins : [];
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
        icon: t.icon || "🤖",
        iconBackground: t.icon_background || "#1C64F2",
        categories: Array.isArray(t.categories) ? t.categories : ["operations"],
        primaryCategory: (t.categories?.[0] || "operations").toLowerCase(),
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

    // Interleave Dify, Studio, and n8n items for rich multi-provider presentation
    const combinedWorkflows = [];
    let i = 0, j = 0, k = 0;
    while (
      (i < normalizedN8n.length || j < normalizedDify.length || k < studioData.length) &&
      combinedWorkflows.length < perPage
    ) {
      if (k < studioData.length) combinedWorkflows.push(studioData[k++]);
      if (j < normalizedDify.length && combinedWorkflows.length < perPage) combinedWorkflows.push(normalizedDify[j++]);
      if (i < normalizedN8n.length && combinedWorkflows.length < perPage) combinedWorkflows.push(normalizedN8n[i++]);
      if (i < normalizedN8n.length && combinedWorkflows.length < perPage) combinedWorkflows.push(normalizedN8n[i++]);
    }

    const totalWorkflows = (n8nData.total || 11620) + (difyData.total || 292) + 15;

    const payload = {
      provider: "all",
      workflows: combinedWorkflows,
      stats: {
        total: totalWorkflows,
        n8n: n8nData.total || 11620,
        dify: difyData.total || 292,
        studio: 15,
      },
      pagination: {
        page,
        perPage,
        totalWorkflows,
        totalPages: Math.max(1, Math.ceil(totalWorkflows / perPage)),
      },
    };

    unifiedSearchCache.set(cacheKey, { data: payload, timestamp: Date.now() });
    return NextResponse.json({ success: true, ...payload });
  } catch (error: any) {
    console.error("[Unified workflows search API error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to search workflows",
        workflows: [],
        stats: { total: 11950, n8n: 11620, dify: 292, studio: 15 },
        pagination: { page, perPage, totalWorkflows: 0, totalPages: 0 },
      },
      { status: 502 }
    );
  }
}
