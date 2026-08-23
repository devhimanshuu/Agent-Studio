"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  X,
  Loader2,
  ExternalLink,
  Layers,
  ArrowRight,
  GitBranch,
  Copy,
  Check,
  LayoutGrid,
  List,
  Sparkles,
  BookOpen,
  Puzzle,
  Flame,
  Globe,
  Tag,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "@/stores/toastStore";
import { Pagination } from "@/components/common/Pagination";

const DIFY_CATEGORIES = [
  { id: "ALL", label: "ALL CATEGORIES" },
  { id: "marketing", label: "MARKETING" },
  { id: "sales", label: "SALES" },
  { id: "support", label: "SUPPORT" },
  { id: "operations", label: "OPERATIONS" },
  { id: "it", label: "IT & DEV" },
  { id: "knowledge", label: "KNOWLEDGE" },
  { id: "design", label: "DESIGN" },
  { id: "others", label: "OTHERS" },
];

const POPULAR_PLUGIN_TAGS = [
  "Zero-Key",
  "Jina",
  "OpenAI",
  "DeepSeek",
  "Tavily",
  "Google",
  "Qdrant",
  "Gemini",
  "Slack",
  "Groq",
];

const CATEGORY_COLORS: Record<string, string> = {
  marketing: "border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300",
  sales: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  support: "border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  operations: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  it: "border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300",
  knowledge: "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
  design: "border-pink-300 dark:border-pink-500/40 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300",
  others: "border-slate-300 dark:border-slate-500/40 bg-slate-50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300",
};

const PAGE_SIZE = 18;

export function DifyWorkflowsMarketplace() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalWorkflows, setTotalWorkflows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [detailWorkflow, setDetailWorkflow] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // In-memory page cache for instant pagination & prefetching
  const pageCacheRef = useRef<Map<number, { workflows: any[]; totalWorkflows: number; totalPages: number }>>(new Map());

  const prefetchNextPage = useCallback(
    async (nextPage: number, maxPages: number) => {
      if (nextPage > maxPages || pageCacheRef.current.has(nextPage)) return;
      try {
        const params = new URLSearchParams();
        params.set("page", String(nextPage));
        params.set("perPage", String(PAGE_SIZE));

        const queryTerm = activeTag || search.trim();
        if (queryTerm) params.set("q", queryTerm);
        if (activeCategory !== "ALL") params.set("category", activeCategory);

        const res = await fetch(`/api/workflows/dify/search?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
          pageCacheRef.current.set(nextPage, {
            workflows: json.workflows || [],
            totalWorkflows: json.pagination?.totalWorkflows || 0,
            totalPages: json.pagination?.totalPages || 1,
          });
        }
      } catch {
        // Background prefetch error ignored
      }
    },
    [activeTag, search, activeCategory]
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
        params.set("page", String(page));
        params.set("perPage", String(PAGE_SIZE));

        const queryTerm = activeTag || search.trim();
        if (queryTerm) params.set("q", queryTerm);
        if (activeCategory !== "ALL") params.set("category", activeCategory);

        const res = await fetch(`/api/workflows/dify/search?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
          const fetchedWorkflows = json.workflows || [];
          const fetchedTotal = json.pagination?.totalWorkflows || 0;
          const fetchedPages = json.pagination?.totalPages || 1;

          setWorkflows(fetchedWorkflows);
          setTotalWorkflows(fetchedTotal);
          setTotalPages(fetchedPages);
          setCurrentPage(page);

          pageCacheRef.current.set(page, {
            workflows: fetchedWorkflows,
            totalWorkflows: fetchedTotal,
            totalPages: fetchedPages,
          });

          if (page < fetchedPages) {
            prefetchNextPage(page + 1, fetchedPages);
          }
        } else {
          toast.error("Failed to load Dify templates", json.error);
        }
      } catch (err: any) {
        toast.error("Error fetching Dify templates", err.message);
      } finally {
        setLoading(false);
      }
    },
    [activeTag, search, activeCategory, prefetchNextPage]
  );

  useEffect(() => {
    pageCacheRef.current.clear();
    const timer = setTimeout(() => {
      fetchWorkflows(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [search, activeCategory, activeTag, fetchWorkflows]);

  const loadWorkflowDetails = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/workflows/dify/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDetailWorkflow(json.data);
      }
    } catch {
      // Ignored
    } finally {
      setDetailLoading(false);
    }
  };

  const copyDslToClipboard = (dsl: string, id: string) => {
    if (!dsl) return;
    navigator.clipboard.writeText(dsl);
    setCopiedId(id);
    toast.success("DSL copied!", "Dify workflow YAML copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/20 p-5 sm:p-6 backdrop-blur-md shadow-xl shadow-blue-500/5">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40">
                <Sparkles className="h-3 w-3 text-blue-400" />
                DIFY.AI MARKETPLACE
              </span>
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <Globe className="h-3 w-3" /> marketplace.dify.ai
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Dify AI Workflow Templates
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Explore 290+ production-grade AI workflows, RAG agents, chatflows, and multi-model pipelines created by the Dify community. Import and run directly on Agent Studio Canvas with zero friction.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto">
            <a
              href="https://marketplace.dify.ai/templates"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-mono font-semibold border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 transition-all cursor-pointer w-full sm:w-auto"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              VISIT DIFY MARKETPLACE
            </a>
          </div>
        </div>
      </div>

      {/* Controls: Search, View Mode & Filters */}
      <div className="space-y-3 font-mono">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Dify workflows (e.g. RAG, Customer Support, OpenAI, Scraping)..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveTag(null);
              }}
              className="w-full pl-9 pr-8 py-2 rounded border border-slate-300 dark:border-indigo-950/80 bg-white/90 dark:bg-[#0c0d12]/90 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all shadow-inner"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
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
                  <Loader2 className="h-3 w-3 animate-spin text-blue-400" /> Loading...
                </span>
              ) : (
                <>
                  <strong className="text-slate-200 font-bold">{totalWorkflows.toLocaleString()}</strong> templates
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
                    ? "bg-blue-600 text-white shadow-sm"
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
                    ? "bg-blue-600 text-white shadow-sm"
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
          {DIFY_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id && !activeTag;
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
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                    : "border-slate-200 dark:border-indigo-950/70 bg-white/60 dark:bg-[#0c0d12]/70 text-slate-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-300"
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Popular Plugin Tags */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px]">
          <span className="text-slate-500 font-semibold text-[9px] uppercase tracking-wider mr-1 flex items-center gap-1">
            <Tag className="h-2.5 w-2.5" /> Plugins:
          </span>
          {POPULAR_PLUGIN_TAGS.map((tag) => {
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
                    ? "border-blue-400 bg-blue-500/20 text-blue-200 font-bold"
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
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-xs text-slate-400">Fetching Dify workflow templates...</span>
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-16 font-mono space-y-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20">
          <Sparkles className="h-8 w-8 text-blue-400 mx-auto opacity-70" />
          <p className="text-sm font-bold text-slate-300">No Dify workflows found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query or category filter to discover more templates.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActiveCategory("ALL");
              setActiveTag(null);
            }}
            className="px-3 py-1.5 rounded border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-bold uppercase transition-all cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6 font-mono">
          {viewMode === "grid" ? (
            /* Grid View (18 cards) */
            <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((wf) => {
                const primaryCat = (wf.categories?.[0] || "operations").toLowerCase();
                const catColor = CATEGORY_COLORS[primaryCat] || CATEGORY_COLORS.operations;

                return (
                  <div
                    key={wf.id}
                    onClick={() => {
                      setDetailWorkflow(wf);
                      loadWorkflowDetails(wf.id);
                    }}
                    className="group rounded-xl border border-slate-200 dark:border-indigo-950/80 bg-white/80 dark:bg-[#0c0d12]/90 hover:border-blue-500/60 dark:hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all p-4 flex flex-col justify-between space-y-3 cursor-pointer relative overflow-hidden"
                  >
                    {/* Top Row: Author & Badges */}
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] text-slate-500 block truncate">
                            by <span className="font-semibold text-slate-700 dark:text-slate-300">@{wf.author}</span>
                          </span>
                          <span className="text-[8px] text-slate-400 block font-sans">
                            v{wf.version}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {wf.badges?.includes("partner") && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30">
                              PARTNER
                            </span>
                          )}
                          <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border", catColor)}>
                            {primaryCat}
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                        {wf.name}
                      </h3>

                      {/* Description */}
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed font-sans">
                        {wf.description?.replace(/#+\s*/g, "")?.slice(0, 160) || "Dify workflow template ready to deploy."}
                      </p>

                      {/* Plugin & Category Tags */}
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {wf.pluginTags?.slice(0, 3).map((p: string, i: number) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[8px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50"
                          >
                            +{p}
                          </span>
                        ))}
                        {wf.categories?.slice(1, 3).map((c: string, i: number) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[8px] bg-slate-100 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                          >
                            #{c}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 text-[9px] text-slate-500">
                        {wf.usageCount > 0 && (
                          <span className="flex items-center gap-1 text-amber-500 font-semibold">
                            <Flame className="h-3 w-3 fill-amber-400" />
                            {Number(wf.usageCount).toLocaleString()} uses
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/canvas/new?difyId=${wf.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-500 bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
                        >
                          <GitBranch className="h-3 w-3" />
                          CANVAS
                        </Link>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailWorkflow(wf);
                            loadWorkflowDetails(wf.id);
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
            /* List View */
            <div className="space-y-2.5">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => {
                    setDetailWorkflow(wf);
                    loadWorkflowDetails(wf.id);
                  }}
                  className="group rounded-lg border border-slate-200 dark:border-indigo-950/80 bg-white/80 dark:bg-[#0c0d12]/90 hover:border-blue-500/50 transition-all p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {wf.name}
                      </h3>
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-bold border border-blue-500/30 bg-blue-500/10 text-blue-300 shrink-0">
                        @{wf.author}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 font-sans">
                      {wf.description?.replace(/#+\s*/g, "")?.slice(0, 140)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    {wf.usageCount > 0 && (
                      <span className="flex items-center gap-1 text-[9px] text-amber-500 font-semibold">
                        <Flame className="h-3 w-3 fill-amber-400" />
                        {Number(wf.usageCount).toLocaleString()}
                      </span>
                    )}
                    <Link
                      href={`/dashboard/canvas/new?difyId=${wf.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-bold border border-blue-500 bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      <GitBranch className="h-3 w-3" /> CANVAS
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
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

      {/* Workflow Detail Modal */}
      {detailWorkflow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setDetailWorkflow(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl border border-blue-500/40 bg-white dark:bg-[#0c0d12] shadow-2xl font-mono text-xs flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-indigo-950 bg-white/95 dark:bg-[#0c0d12]/95 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: detailWorkflow.iconBackground || "#EFF1F5" }}
                >
                  {detailWorkflow.icon || "🤖"}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {detailWorkflow.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>by @{detailWorkflow.author}</span>
                    <span>•</span>
                    <span>v{detailWorkflow.version || "1.0.0"}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailWorkflow(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 flex-1 overflow-y-auto">
              {detailLoading && (
                <div className="flex items-center gap-2 text-blue-400 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading full workflow graph and setup instructions...</span>
                </div>
              )}

              {/* Overview */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Overview</h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans text-xs bg-slate-50 dark:bg-black/30 p-3 rounded border border-slate-200 dark:border-slate-800/80">
                  {detailWorkflow.description || "No overview provided for this workflow."}
                </p>
              </div>

              {/* Categories & Dependent Plugins */}
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
                    <Puzzle className="h-3 w-3 text-blue-400" /> Dependencies &amp; Tools
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {(detailWorkflow.depsPlugins || []).length > 0 ? (
                      detailWorkflow.depsPlugins.map((p: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-300 border border-blue-500/30">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-500">None required</span>
                    )}
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

              {/* Converted Canvas Graph Info */}
              {detailWorkflow.convertedGraph && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-blue-400" />
                    Canvas Graph Nodes ({detailWorkflow.nodeCount || detailWorkflow.convertedGraph.nodes?.length || 0})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(detailWorkflow.convertedGraph.nodes || []).map((n: any, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded text-[10px] bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-300"
                      >
                        {n.label || n.id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-indigo-950 bg-slate-50/90 dark:bg-[#0c0d12]/90 backdrop-blur-sm rounded-b-xl">
              <a
                href={detailWorkflow.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-400 transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> View on Dify
              </a>

              <div className="flex items-center gap-2">
                {detailWorkflow.rawDsl && (
                  <button
                    type="button"
                    onClick={() => copyDslToClipboard(detailWorkflow.rawDsl, detailWorkflow.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-800 text-slate-300 hover:bg-slate-800 transition-all cursor-pointer text-[10px] font-bold uppercase"
                  >
                    {copiedId === detailWorkflow.id ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" /> COPIED DSL
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> COPY DSL
                      </>
                    )}
                  </button>
                )}

                <Link
                  href={`/dashboard/canvas/new?difyId=${detailWorkflow.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded border border-blue-500 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all cursor-pointer"
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
