"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  X,
  Loader2,
  GitBranch,
  ExternalLink,
  LayoutGrid,
  List,
  Eye,
  Layers,
  ArrowRight,
  Copy,
  Check,
  Zap,
  Workflow,
  Flame,
  Tag,
  Puzzle,
  BookOpen,
  Filter,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "@/stores/toastStore";
import { Pagination } from "@/components/common/Pagination";
import { N8nOfficialLogo, DifyOfficialLogo } from "@/components/common/BrandLogos";

type WorkflowProvider = "all" | "n8n" | "dify" | "studio";

const PROVIDERS: Array<{
  id: WorkflowProvider;
  name: string;
  statsKey: "total" | "n8n" | "dify" | "studio";
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  activeClass: string;
  pillClass: string;
}> = [
  {
    id: "all",
    name: "ALL PROVIDERS",
    statsKey: "total",
    icon: Layers,
    colorClass: "text-slate-300",
    activeClass: "bg-slate-800 text-white border-slate-700 shadow-sm",
    pillClass: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  },
  {
    id: "n8n",
    name: "N8N WORKFLOWS",
    statsKey: "n8n",
    icon: N8nOfficialLogo,
    colorClass: "text-rose-400",
    activeClass: "bg-rose-600 text-white border-rose-500 shadow-sm shadow-rose-500/30",
    pillClass: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  },
  {
    id: "dify",
    name: "DIFY.AI WORKFLOWS",
    statsKey: "dify",
    icon: DifyOfficialLogo,
    colorClass: "text-blue-400",
    activeClass: "bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/30",
    pillClass: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  },
  {
    id: "studio",
    name: "STUDIO BLUEPRINTS",
    statsKey: "studio",
    icon: Zap,
    colorClass: "text-indigo-400",
    activeClass: "bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-500/30",
    pillClass: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  },
];

/** Formats a live-fetched count for the provider tab pills (e.g. 11950 -> "12.0K+"). */
function formatProviderCount(n: number): string {
  if (n <= 0) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K+`;
  return `${n}+`;
}

const UNIFIED_CATEGORIES = [
  { id: "ALL", label: "ALL CATEGORIES" },
  { id: "zero-key", label: "ZERO-KEY / FREE APIS" },
  { id: "ai", label: "AI & AGENTS" },
  { id: "marketing", label: "MARKETING" },
  { id: "sales", label: "SALES & CRM" },
  { id: "support", label: "SUPPORT" },
  { id: "operations", label: "OPERATIONS" },
  { id: "it", label: "IT & DEVOPS" },
  { id: "knowledge", label: "KNOWLEDGE & RAG" },
  { id: "finance", label: "FINANCE & LEGAL" },
];

const POPULAR_INTEGRATION_TAGS = [
  "Zero-Key",
  "Free API",
  "Jina Reader",
  "Hacker News",
  "ArXiv",
  "Open-Meteo",
  "CoinGecko",
  "Reddit",
  "OpenAI",
  "Anthropic",
  "Google",
  "Slack",
  "GitHub",
  "Notion",
  "PostgreSQL",
  "Discord",
  "Webhook",
];

const PAGE_SIZE = 18;

export interface UnifiedMarketplaceWorkflow {
  id: string | number;
  provider: "n8n" | "dify" | "studio";
  providerName: string;
  name: string;
  description: string;
  readme?: string;
  author?: string;
  authorUrl?: string;
  icon?: string;
  iconBackground?: string;
  categories?: string[];
  primaryCategory?: string;
  tags?: string[];
  pluginTags?: string[];
  nodeCount?: number;
  usageCount?: number;
  viewsCount?: number;
  version?: string;
  badges?: string[];
  sourceUrl?: string;
  canvasUrl?: string;
  createdAt?: string;
  rawDsl?: string;
  rawWorkflowJson?: unknown;
  convertedGraph?: {
    nodes?: Array<{ id: string; label?: string; data?: { label?: string }; type?: string }>;
    edges?: Array<{ id: string; source: string; target: string }>;
  };
  convertedTemplate?: unknown;
}

export function UnifiedWorkflowsMarketplace() {
  const [activeProvider, setActiveProvider] = useState<WorkflowProvider>("all");
  const [workflows, setWorkflows] = useState<UnifiedMarketplaceWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalWorkflows, setTotalWorkflows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [detailWorkflow, setDetailWorkflow] = useState<UnifiedMarketplaceWorkflow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, n8n: 0, dify: 0, studio: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  // In-memory page cache for instant pagination & prefetching
  const pageCacheRef = useRef<Map<number, { workflows: UnifiedMarketplaceWorkflow[]; totalWorkflows: number; totalPages: number }>>(new Map());

  const prefetchNextPage = useCallback(
    async (nextPage: number, maxPages: number) => {
      if (nextPage > maxPages || pageCacheRef.current.has(nextPage)) return;
      try {
        const params = new URLSearchParams();
        params.set("provider", activeProvider);
        params.set("page", String(nextPage));
        params.set("perPage", String(PAGE_SIZE));

        if (search.trim()) params.set("q", search.trim());
        if (activeCategory !== "ALL") params.set("category", activeCategory);
        if (activeTag) params.set("tag", activeTag);

        const res = await fetch(`/api/workflows/search?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
          pageCacheRef.current.set(nextPage, {
            workflows: json.workflows || [],
            totalWorkflows: json.pagination?.totalWorkflows || 0,
            totalPages: json.pagination?.totalPages || 1,
          });
        }
      } catch {
        // Ignored in background
      }
    },
    [activeProvider, search, activeCategory, activeTag]
  );

  const fetchWorkflows = useCallback(
    async (page: number) => {
      const cached = pageCacheRef.current.get(page);
      if (cached) {
        setWorkflows(cached.workflows);
        setTotalWorkflows(cached.totalWorkflows);
        setTotalPages(cached.totalPages);
        setCurrentPage(page);
        setLoading(false);

        if (page < cached.totalPages) {
          prefetchNextPage(page + 1, cached.totalPages);
        }
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("provider", activeProvider);
        params.set("page", String(page));
        params.set("perPage", String(PAGE_SIZE));

        if (search.trim()) params.set("q", search.trim());
        if (activeCategory !== "ALL") params.set("category", activeCategory);
        if (activeTag) params.set("tag", activeTag);

        const res = await fetch(`/api/workflows/search?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
          const fetchedWorkflows = json.workflows || [];
          const fetchedTotal = json.pagination?.totalWorkflows || 0;
          const fetchedPages = json.pagination?.totalPages || 1;

          setWorkflows(fetchedWorkflows);
          setTotalWorkflows(fetchedTotal);
          setTotalPages(fetchedPages);
          setCurrentPage(page);

          if (json.stats) {
            setStats(json.stats);
          }

          pageCacheRef.current.set(page, {
            workflows: fetchedWorkflows,
            totalWorkflows: fetchedTotal,
            totalPages: fetchedPages,
          });

          if (page < fetchedPages) {
            prefetchNextPage(page + 1, fetchedPages);
          }
        } else {
          toast.error("Failed to load workflows", json.error);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error loading workflows";
        toast.error("Error loading workflows", msg);
      } finally {
        setLoading(false);
      }
    },
    [activeProvider, search, activeCategory, activeTag, prefetchNextPage]
  );

  useEffect(() => {
    pageCacheRef.current.clear();
    const timer = setTimeout(() => {
      fetchWorkflows(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [activeProvider, search, activeCategory, activeTag, fetchWorkflows]);

  const loadWorkflowDetails = async (wf: UnifiedMarketplaceWorkflow) => {
    setDetailWorkflow(wf);
    if (wf.provider === "studio") return;

    setDetailLoading(true);
    try {
      const endpoint =
        wf.provider === "dify" ? `/api/workflows/dify/${wf.id}` : `/api/workflows/n8n/${wf.id}`;
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success && json.data) {
        setDetailWorkflow({
          ...wf,
          ...json.data,
        });
      }
    } catch {
      // Ignored
    } finally {
      setDetailLoading(false);
    }
  };

  const copyDslOrJson = (content: unknown, id: string) => {
    if (!content) return;
    const textToCopy = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    toast.success("Workflow copied!", "Workflow definition copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Provider Breakdown */}
      <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-blue-950/20 p-5 sm:p-6 backdrop-blur-md shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                <Workflow className="h-3 w-3 text-indigo-400" />
                UNIFIED WORKFLOW ECOSYSTEM
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {stats.total.toLocaleString()}+ Community &amp; Enterprise Workflows
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Workflows &amp; AI Automations Marketplace
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
              Discover, search, and import verified automation workflows from <strong>n8n</strong>, <strong>Dify.ai</strong>, and <strong>Agent Studio</strong>. 1-click import converts any workflow into an interactive visual canvas graph.
            </p>
          </div>

          {/* Quick Stats Counter Chips */}
          <div className="grid grid-cols-3 gap-2 shrink-0 self-stretch sm:self-auto font-mono">
            <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-950/20 text-center">
              <div className="text-[10px] text-rose-300 font-bold">n8n</div>
              <div className="text-xs font-black text-rose-200">{stats.n8n.toLocaleString()}+</div>
            </div>
            <div className="p-2.5 rounded-lg border border-blue-500/30 bg-blue-950/20 text-center">
              <div className="text-[10px] text-blue-300 font-bold">Dify.ai</div>
              <div className="text-xs font-black text-blue-200">{stats.dify.toLocaleString()}+</div>
            </div>
            <div className="p-2.5 rounded-lg border border-indigo-500/30 bg-indigo-950/20 text-center">
              <div className="text-[10px] text-indigo-300 font-bold">Studio</div>
              <div className="text-xs font-black text-indigo-200">{stats.studio}+</div>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Tabs Selector */}
      <div className="flex flex-wrap items-center gap-2 font-mono">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
          <Filter className="h-3 w-3 text-indigo-400" /> Source:
        </span>
        {PROVIDERS.map((p) => {
          const isActive = activeProvider === p.id;
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveProvider(p.id)}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer shadow-sm",
                isActive
                  ? p.activeClass
                  : "border-slate-200 dark:border-indigo-950/70 bg-white/70 dark:bg-[#0c0d12]/70 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-indigo-800 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Icon className={clsx("h-3.5 w-3.5", isActive ? "text-white" : p.colorClass)} />
              <span>{p.name}</span>
              <span
                className={clsx(
                  "ml-1 px-1.5 py-0.2 rounded-full text-[8px] font-extrabold",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                {formatProviderCount(stats[p.statsKey])}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search, View Mode, Categories & Integration Filters */}
      <div className="space-y-3 font-mono">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeProvider === "all" ? `${formatProviderCount(stats.total)} workflows` : activeProvider.toUpperCase()} (e.g. RAG, Slack, OpenAI, Stripe, Scraper)...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded border border-slate-300 dark:border-indigo-950/80 bg-white/90 dark:bg-[#0c0d12]/90 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-inner"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View Mode & Count */}
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
            <span className="text-[11px] text-slate-500">
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-400" /> Loading...
                </span>
              ) : (
                <>
                  <strong className="text-slate-200 font-bold">{totalWorkflows.toLocaleString()}</strong> workflows found
                </>
              )}
            </span>

            <div className="flex items-center border border-slate-300 dark:border-indigo-950/80 rounded bg-white/70 dark:bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={clsx(
                  "p-1.5 rounded transition-all cursor-pointer",
                  viewMode === "grid"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
                title="Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={clsx(
                  "p-1.5 rounded transition-all cursor-pointer",
                  viewMode === "list"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
                title="List View"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {UNIFIED_CATEGORIES.map((cat) => {
            const isActive = activeCategory.toLowerCase() === cat.id.toLowerCase();
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setActiveTag(null);
                }}
                className={clsx(
                  "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
                  isActive
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                    : "border-slate-200 dark:border-indigo-950/70 bg-white/60 dark:bg-[#0c0d12]/70 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-300"
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Integration & Provider Tags */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px]">
          <span className="text-slate-500 font-semibold text-[9px] uppercase tracking-wider mr-1 flex items-center gap-1">
            <Tag className="h-2.5 w-2.5" /> Integrations:
          </span>
          {POPULAR_INTEGRATION_TAGS.map((tag) => {
            const isTagActive = activeTag?.toLowerCase() === tag.toLowerCase();
            return (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setActiveTag(isTagActive ? null : tag);
                  if (!isTagActive) setSearch("");
                }}
                className={clsx(
                  "px-2 py-0.5 rounded text-[9px] border transition-all cursor-pointer",
                  isTagActive
                    ? "border-indigo-400 bg-indigo-500/20 text-indigo-200 font-bold"
                    : "border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 hover:border-slate-600"
                )}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid / List Views */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 font-mono">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="text-xs text-slate-400">Fetching unified workflow ecosystem...</span>
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-16 font-mono space-y-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20">
          <Workflow className="h-8 w-8 text-indigo-400 mx-auto opacity-70" />
          <p className="text-sm font-bold text-slate-300">No workflows found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query, provider selection, or category filter to discover more workflows.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActiveCategory("ALL");
              setActiveTag(null);
              setActiveProvider("all");
            }}
            className="px-3 py-1.5 rounded border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase transition-all cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6 font-mono">
          {viewMode === "grid" ? (
            /* Unified Grid View (18 items) */
            <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((wf) => {
                const isN8n = wf.provider === "n8n";
                const isDify = wf.provider === "dify";

                return (
                  <div
                    key={`${wf.provider}-${wf.id}`}
                    onClick={() => loadWorkflowDetails(wf)}
                    className="group rounded-xl border border-slate-200 dark:border-indigo-950/80 bg-white/80 dark:bg-[#0c0d12]/90 hover:border-indigo-500/60 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all p-4 flex flex-col justify-between space-y-3 cursor-pointer relative overflow-hidden"
                  >
                    {/* Top Row: Author, Version & Provider Pill */}
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] text-slate-500 block truncate">
                            by <span className="font-semibold text-slate-700 dark:text-slate-300">@{wf.author}</span>
                          </span>
                          <span className="text-[8px] text-slate-400 block font-sans">
                            v{wf.version || "1.0.0"}
                          </span>
                        </div>

                        {/* Provider Brand Pill */}
                        <div className="flex items-center gap-1 shrink-0">
                          {wf.badges?.includes("zero-key") && (
                            <span className="px-1.5 py-0.5 rounded-full text-[7.5px] font-bold uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 inline-flex items-center gap-0.5">
                              <Zap className="h-2 w-2" /> NO API KEY
                            </span>
                          )}
                          <span
                            className={clsx(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border inline-flex items-center gap-1",
                              isN8n
                                ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                                : isDify
                                ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                                : "border-indigo-500/40 bg-indigo-500/10 text-indigo-400"
                            )}
                          >
                            {isN8n && <N8nOfficialLogo className="h-2.5 w-2.5 shrink-0" />}
                            {isDify && <DifyOfficialLogo className="h-2.5 w-2.5 shrink-0" />}
                            {wf.providerName}
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {wf.name}
                      </h3>

                      {/* Description */}
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed font-sans">
                        {wf.description?.replace(/#+\s*/g, "")?.slice(0, 160) || "Workflow ready for 1-click import."}
                      </p>

                      {/* Plugins & Category Tags */}
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {wf.pluginTags?.slice(0, 3).map((p: string, i: number) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[8px] bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                          >
                            +{p}
                          </span>
                        ))}
                        {wf.categories?.slice(0, 2).map((c: string, i: number) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[8px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 uppercase"
                          >
                            #{c}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 text-[9px] text-slate-500">
                        {Boolean(wf.usageCount && wf.usageCount > 0) ? (
                          <span className="flex items-center gap-1 text-amber-500 font-semibold">
                            <Flame className="h-3 w-3 fill-amber-400" />
                            {Number(wf.usageCount).toLocaleString()} uses
                          </span>
                        ) : Boolean(wf.viewsCount && wf.viewsCount > 0) ? (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Eye className="h-3 w-3 text-slate-500" />
                            {Number(wf.viewsCount).toLocaleString()}
                          </span>
                        ) : Boolean(wf.nodeCount && wf.nodeCount > 0) ? (
                          <span>{wf.nodeCount} nodes</span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={wf.canvasUrl || "/dashboard/canvas/new"}
                          onClick={(e) => e.stopPropagation()}
                          className={clsx(
                            "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border text-white shadow-sm transition-all cursor-pointer",
                            isN8n
                              ? "border-rose-500 bg-rose-600 hover:bg-rose-500 shadow-rose-500/20"
                              : isDify
                              ? "border-blue-500 bg-blue-600 hover:bg-blue-500 shadow-blue-500/20"
                              : "border-indigo-500 bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
                          )}
                        >
                          <GitBranch className="h-3 w-3" />
                          CANVAS
                        </Link>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadWorkflowDetails(wf);
                          }}
                          className="px-2.5 py-1.5 rounded text-[10px] font-semibold border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                          title="View Details"
                        >
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Unified List View */
            <div className="space-y-2.5">
              {workflows.map((wf) => {
                const isN8n = wf.provider === "n8n";
                const isDify = wf.provider === "dify";
                return (
                  <div
                    key={`${wf.provider}-${wf.id}`}
                    onClick={() => loadWorkflowDetails(wf)}
                    className="group rounded-lg border border-slate-200 dark:border-indigo-950/80 bg-white/80 dark:bg-[#0c0d12]/90 hover:border-indigo-500/50 transition-all p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {wf.name}
                        </h3>
                        {wf.badges?.includes("zero-key") && (
                          <span className="px-1.5 py-0.2 rounded text-[7.5px] font-bold uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shrink-0 inline-flex items-center gap-0.5">
                            <Zap className="h-2 w-2" /> NO API KEY
                          </span>
                        )}
                        <span
                          className={clsx(
                            "px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border shrink-0",
                            isN8n
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                              : isDify
                              ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                              : "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                          )}
                        >
                          {wf.providerName}
                        </span>
                        <span className="text-[9px] text-slate-500 truncate">
                          by @{wf.author}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 font-sans">
                        {wf.description?.replace(/#+\s*/g, "")?.slice(0, 140)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      {Boolean(wf.usageCount && wf.usageCount > 0) && (
                        <span className="flex items-center gap-1 text-[9px] text-amber-500 font-semibold">
                          <Flame className="h-3 w-3 fill-amber-400" />
                          {Number(wf.usageCount).toLocaleString()}
                        </span>
                      )}
                      <Link
                        href={wf.canvasUrl || "/dashboard/canvas/new"}
                        onClick={(e) => e.stopPropagation()}
                        className={clsx(
                          "inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-bold text-white",
                          isN8n
                            ? "bg-rose-600 hover:bg-rose-500"
                            : isDify
                            ? "bg-blue-600 hover:bg-blue-500"
                            : "bg-indigo-600 hover:bg-indigo-500"
                        )}
                      >
                        <GitBranch className="h-3 w-3" /> CANVAS
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Unified Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => {
              fetchWorkflows(p);
              gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            loading={loading}
            totalCount={totalWorkflows}
          />
        </div>
      )}

      {/* Unified Workflow Detail Modal */}
      {detailWorkflow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setDetailWorkflow(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl border border-indigo-500/40 bg-white dark:bg-[#0c0d12] shadow-2xl font-mono text-xs flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-indigo-950 bg-white/95 dark:bg-[#0c0d12]/95 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={clsx(
                    "h-10 w-10 rounded-lg border flex items-center justify-center text-xl shrink-0",
                    detailWorkflow.provider === "n8n"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                      : detailWorkflow.provider === "dify"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                      : "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                  )}
                >
                  {detailWorkflow.provider === "n8n" ? (
                    <N8nOfficialLogo className="h-5 w-5" />
                  ) : detailWorkflow.provider === "dify" ? (
                    <DifyOfficialLogo className="h-5 w-5" />
                  ) : (
                    <Layers className="h-5 w-5 text-indigo-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {detailWorkflow.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="font-semibold text-indigo-400">{detailWorkflow.providerName}</span>
                    <span>•</span>
                    <span>by @{detailWorkflow.author}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailWorkflow(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 flex-1 overflow-y-auto">
              {detailLoading && (
                <div className="flex items-center gap-2 text-indigo-400 p-2 bg-indigo-500/10 rounded border border-indigo-500/20">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading full workflow graph and setup guide...</span>
                </div>
              )}

              {/* Overview */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Overview</h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans text-xs bg-slate-50 dark:bg-black/30 p-3 rounded border border-slate-200 dark:border-slate-800/80">
                  {detailWorkflow.description || "No overview provided for this workflow."}
                </p>
              </div>

              {/* Categories & Included Integrations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="h-3 w-3 text-indigo-400" /> Categories
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {(detailWorkflow.categories || []).map((c: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Puzzle className="h-3 w-3 text-blue-400" /> Integrations &amp; Tools
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const tagsList = detailWorkflow.pluginTags || detailWorkflow.tags || [];
                      return tagsList.length > 0 ? (
                        tagsList.map((p: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[9px] bg-slate-100 dark:bg-slate-900 text-slate-300 border border-slate-300 dark:border-slate-800">
                            +{p}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-500">None specified</span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Setup Guide (Readme) */}
              {detailWorkflow.readme && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                    Setup Instructions
                  </h4>
                  <div className="p-3.5 rounded bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-sans whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                    {detailWorkflow.readme}
                  </div>
                </div>
              )}

              {/* Converted Canvas Nodes Preview */}
              {detailWorkflow.convertedGraph && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-indigo-400" />
                    Canvas Graph Architecture ({detailWorkflow.convertedGraph.nodes?.length || 0} nodes · {detailWorkflow.convertedGraph.edges?.length || 0} edges)
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(detailWorkflow.convertedGraph.nodes || []).map((n, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded text-[10px] bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-300"
                      >
                        {n.data?.label || n.label || n.id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-indigo-950 bg-slate-50/90 dark:bg-[#0c0d12]/90 backdrop-blur-sm rounded-b-xl">
              {detailWorkflow.sourceUrl && (
                <a
                  href={detailWorkflow.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> View on {detailWorkflow.providerName}
                </a>
              )}

              <div className="flex items-center gap-2">
                {Boolean(detailWorkflow.rawDsl || detailWorkflow.rawWorkflowJson) && (
                  <button
                    type="button"
                    onClick={() =>
                      copyDslOrJson(
                        detailWorkflow.rawDsl || detailWorkflow.rawWorkflowJson,
                        String(detailWorkflow.id)
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-800 text-slate-300 hover:bg-slate-800 transition-all cursor-pointer text-[10px] font-bold uppercase"
                  >
                    {copiedId === String(detailWorkflow.id) ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" /> COPIED
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> COPY WORKFLOW
                      </>
                    )}
                  </button>
                )}

                <Link
                  href={detailWorkflow.canvasUrl || "/dashboard/canvas/new"}
                  className={clsx(
                    "inline-flex items-center gap-1.5 px-4 py-1.5 rounded border text-white font-bold text-[10px] uppercase tracking-wider shadow-md transition-all cursor-pointer",
                    detailWorkflow.provider === "n8n"
                      ? "border-rose-500 bg-rose-600 hover:bg-rose-500 shadow-rose-500/20"
                      : detailWorkflow.provider === "dify"
                      ? "border-blue-500 bg-blue-600 hover:bg-blue-500 shadow-blue-500/20"
                      : "border-indigo-500 bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
                  )}
                >
                  <GitBranch className="h-3.5 w-3.5" /> OPEN IN CANVAS
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
