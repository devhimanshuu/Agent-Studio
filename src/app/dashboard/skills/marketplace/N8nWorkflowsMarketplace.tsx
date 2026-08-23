"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Loader2,
  GitBranch,
  ExternalLink,
  Sparkles,
  LayoutGrid,
  List,
  Eye,
  Bot,
  Layers,
  ArrowRight,
  Copy,
  Check,
  Zap,
  Globe,
  Workflow,
  ShieldCheck,
  DownloadCloud,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "@/stores/toastStore";
import { skillsApi } from "@/lib/api/skills";
import { Pagination } from "@/components/common/Pagination";

const N8N_CATEGORIES = [
  { id: "ALL", label: "ALL WORKFLOWS", icon: Layers },
  { id: "AI", label: "AI & AGENTS", icon: Bot },
  { id: "Langchain", label: "LANGCHAIN / RAG", icon: Sparkles },
  { id: "Communication", label: "COMMUNICATION", icon: Globe },
  { id: "Data & Storage", label: "DATA & STORAGE", icon: Zap },
  { id: "Development", label: "DEV & CODE", icon: GitBranch },
  { id: "Productivity", label: "PRODUCTIVITY", icon: Workflow },
];

const POPULAR_TAGS = [
  "Zero-Key",
  "Free API",
  "RAG",
  "OpenAI",
  "Slack",
  "Supabase",
  "Google Sheets",
  "Discord",
  "Postgres",
  "Webhook",
  "RSS",
];

const PAGE_SIZE = 18;

export function N8nWorkflowsMarketplace() {
  const router = useRouter();
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
  const [importingId, setImportingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
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

        const res = await fetch(`/api/workflows/n8n/search?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
          pageCacheRef.current.set(nextPage, {
            workflows: json.workflows || [],
            totalWorkflows: json.pagination?.totalWorkflows || 0,
            totalPages: json.pagination?.totalPages || 1,
          });
        }
      } catch {
        // Non-blocking background prefetch error ignored
      }
    },
    [activeTag, search, activeCategory]
  );

  const fetchWorkflows = useCallback(
    async (page: number) => {
      // Check client-side cache for instant display
      const cached = pageCacheRef.current.get(page);
      if (cached) {
        setWorkflows(cached.workflows);
        setTotalWorkflows(cached.totalWorkflows);
        setTotalPages(cached.totalPages);
        setCurrentPage(page);
        setLoading(false);

        // Pre-fetch the subsequent page
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

        const res = await fetch(`/api/workflows/n8n/search?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
          const fetchedWorkflows = json.workflows || [];
          const fetchedTotal = json.pagination?.totalWorkflows || 0;
          const fetchedPages = json.pagination?.totalPages || 1;

          setWorkflows(fetchedWorkflows);
          setTotalWorkflows(fetchedTotal);
          setTotalPages(fetchedPages);
          setCurrentPage(page);

          // Cache current page
          pageCacheRef.current.set(page, {
            workflows: fetchedWorkflows,
            totalWorkflows: fetchedTotal,
            totalPages: fetchedPages,
          });

          // Prefetch next page into cache
          if (page < fetchedPages) {
            prefetchNextPage(page + 1, fetchedPages);
          }
        } else {
          toast.error("Failed to load n8n workflows", json.error);
        }
      } catch (err: any) {
        toast.error("Error fetching workflows", err.message);
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

  const loadWorkflowDetails = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/workflows/n8n/${id}`);
      const json = await res.json();
      if (json.success) {
        setDetailWorkflow(json.data);
      } else {
        toast.error("Failed to load workflow details", json.error);
      }
    } catch (err: any) {
      toast.error("Error fetching details", err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleImportToStudio = async (wf: any) => {
    setImportingId(wf.id);
    try {
      let wfData = wf;
      if (!wf.convertedTemplate) {
        const res = await fetch(`/api/workflows/n8n/${wf.id}`);
        const json = await res.json();
        if (json.success) wfData = json.data;
      }

      const template = wfData.convertedTemplate;
      const created = await skillsApi.create({
        name: wfData.name,
        purpose: template?.purpose || wfData.description || `Automated workflow imported from n8n: ${wfData.name}`,
        instructions: template?.instructions || wfData.description || `n8n workflow: ${wfData.name}`,
        allowedTools: template?.allowedTools || ["document_search", "web_search"],
        inputSchema: template?.inputSchema,
        outputSchema: template?.outputSchema,
        examples: template?.examples,
        actionsRequiringApproval: template?.actionsRequiringApproval,
        maxExecutionSteps: template?.maxExecutionSteps,
        graphDefinition: wfData.convertedGraph || undefined,
      });

      toast.success("Workflow imported to Studio!", `Created skill: ${created.name}`);
      router.push(`/dashboard/skills/${created.id}`);
    } catch (err: any) {
      let msg = err?.message || "Failed to import workflow";
      if (err?.fields) {
        const details = Object.entries(err.fields)
          .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
          .join(" | ");
        msg = `${msg} (${details})`;
      }
      toast.error("Import failed", msg);
    } finally {
      setImportingId(null);
    }
  };

  const handleCopyJson = (wf: any) => {
    const jsonStr = JSON.stringify(wf.rawWorkflowJson || wf, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedId(wf.id);
    toast.success("n8n Workflow JSON copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 w-full font-mono">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-black p-6 backdrop-blur-md shadow-xl">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[10px] font-bold tracking-wider">
              <Sparkles className="h-3 w-3 text-rose-400" />
              N8N COMMUNITY WORKFLOW REPOSITORY · 11,600+ WORKFLOWS
            </div>
            <h2 className="text-xl sm:text-2xl font-pixel text-slate-100 tracking-wide">
              N8N WORKFLOWS MARKETPLACE
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Browse, inspect, and 1-click import production automations and AI agent architectures
              from the global n8n community directly into Agent Studio Canvas and Workflow Studio.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://n8n.io/workflows/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs transition-all"
            >
              <Globe className="h-3.5 w-3.5 text-rose-400" />
              n8n.io Library
              <ExternalLink className="h-3 w-3 ml-0.5 text-slate-400" />
            </a>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (activeTag) setActiveTag(null);
              }}
              placeholder="Search 11,600+ workflows by keywords, node types, tools..."
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-indigo-950/80 bg-white/80 dark:bg-black/50 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* View Switcher */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto border border-slate-200 dark:border-indigo-950 p-1 rounded-lg bg-white/50 dark:bg-black/40">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={clsx(
                "p-1.5 rounded transition-all",
                viewMode === "grid"
                  ? "bg-indigo-600 text-white"
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
                "p-1.5 rounded transition-all",
                viewMode === "list"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              )}
              title="List View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {N8N_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id && !activeTag;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setActiveTag(null);
                }}
                className={clsx(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
                  active
                    ? "bg-rose-600 text-white shadow-sm shadow-rose-500/30"
                    : "border border-slate-200 dark:border-indigo-950 bg-white/70 dark:bg-black/40 text-slate-500 dark:text-slate-400 hover:border-rose-400/50"
                )}
              >
                <Icon className="h-3 w-3" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Popular Tags */}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[9px] mr-1">
            TRENDING:
          </span>
          {POPULAR_TAGS.map((tag) => {
            const isSelected = activeTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setActiveTag(null);
                  } else {
                    setActiveTag(tag);
                    setSearch("");
                  }
                }}
                className={clsx(
                  "px-2 py-0.5 rounded border transition-all cursor-pointer",
                  isSelected
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : "border-slate-200 dark:border-indigo-950/60 bg-slate-100/70 dark:bg-black/30 text-slate-500 dark:text-slate-400 hover:border-indigo-400"
                )}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-rose-500" />
          <p className="text-xs text-slate-400">Loading n8n community workflows...</p>
        </div>
      )}

      {/* Workflows Grid / List */}
      {!loading && (
        <div ref={gridRef} className="space-y-6">
          {workflows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-indigo-950/80 bg-white/50 dark:bg-black/30 p-12 text-center space-y-3">
              <Bot className="h-8 w-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">No workflows found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Try searching for different keywords, such as &quot;RAG&quot;, &quot;Slack&quot;, &quot;Support&quot;, or &quot;OpenAI&quot;.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => {
                    setDetailWorkflow(wf);
                    loadWorkflowDetails(wf.id);
                  }}
                  className="group rounded-xl border border-slate-200 dark:border-indigo-950/80 bg-white/80 dark:bg-[#0c0d12]/90 hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-950/10 transition-all p-4 flex flex-col justify-between space-y-4 cursor-pointer relative"
                >
                  <div className="space-y-2.5">
                    {/* Author & Views Header */}
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {wf.user?.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={wf.user.avatar}
                            alt={wf.user.name}
                            className="w-4 h-4 rounded-full border border-slate-700 object-cover"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[8px] text-slate-300">
                            {wf.user?.name?.charAt(0) || "U"}
                          </div>
                        )}
                        <span className="truncate max-w-[120px] font-medium text-slate-300">
                          {wf.user?.name || "Community"}
                        </span>
                        {wf.user?.verified && (
                          <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-[9px] text-slate-500 shrink-0">
                        <Eye className="h-3 w-3 text-slate-400" />
                        {Number(wf.totalViews || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xs font-bold text-slate-100 group-hover:text-rose-300 transition-colors line-clamp-2 leading-snug">
                      {wf.name}
                    </h3>

                    {/* Description preview */}
                    <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed font-sans font-normal">
                      {wf.description
                        ?.replace(/#+\s*/g, "")
                        ?.replace(/\n+/g, " ")
                        ?.slice(0, 160) || "No description provided."}
                    </p>

                    {/* Nodes Breakdown / Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border border-rose-500/30 bg-rose-500/10 text-rose-300">
                        {wf.nodeCount} NODES
                      </span>
                      {wf.nodeTypes?.slice(0, 3).map((nt: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded text-[8px] bg-slate-100 dark:bg-black/50 text-slate-400 border border-slate-200 dark:border-indigo-950"
                        >
                          {nt.replace(/^n8n-nodes-base\./, "")}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/canvas/new?n8nId=${wf.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border border-rose-500 bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
                    >
                      <GitBranch className="h-3 w-3" />
                      OPEN IN CANVAS
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailWorkflow(wf);
                        loadWorkflowDetails(wf.id);
                      }}
                      className="px-2.5 py-1.5 rounded text-[10px] font-semibold border border-slate-300 dark:border-slate-800 text-slate-300 hover:bg-slate-800 transition-all cursor-pointer"
                      title="View Details"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
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
                  className="group rounded-lg border border-slate-200 dark:border-indigo-950/80 bg-white/80 dark:bg-[#0c0d12]/90 hover:border-rose-500/50 transition-all p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border border-rose-500/30 bg-rose-500/10 text-rose-300">
                        {wf.nodeCount} NODES
                      </span>
                      <h3 className="text-xs font-bold text-slate-100 group-hover:text-rose-300 transition-colors truncate">
                        {wf.name}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1 font-sans">
                      {wf.description?.replace(/#+\s*/g, "")?.slice(0, 140)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <span className="flex items-center gap-1 text-[9px] text-slate-500">
                      <Eye className="h-3 w-3 text-slate-400" />
                      {Number(wf.totalViews || 0).toLocaleString()}
                    </span>
                    <Link
                      href={`/dashboard/canvas/new?n8nId=${wf.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-bold border border-rose-500 bg-rose-600 hover:bg-rose-500 text-white"
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

      {/* Deep Detail Modal */}
      {detailWorkflow && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setDetailWorkflow(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl border border-indigo-500/40 bg-slate-950 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300">
                    N8N TEMPLATE #{detailWorkflow.id}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Eye className="h-3 w-3 text-slate-500" />
                    {Number(detailWorkflow.views || detailWorkflow.totalViews || 0).toLocaleString()} views
                  </span>
                  {detailLoading && (
                    <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading details...
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">
                  {detailWorkflow.name}
                </h2>
                {detailWorkflow.user && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>By {detailWorkflow.user.name || detailWorkflow.user.username}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDetailWorkflow(null)}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center gap-2.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
              <Link
                href={`/dashboard/canvas/new?n8nId=${detailWorkflow.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border border-rose-500 bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-500/30 transition-all cursor-pointer"
              >
                <GitBranch className="h-3.5 w-3.5" />
                OPEN IN AGENT CANVAS
              </Link>

              <button
                type="button"
                disabled={importingId === detailWorkflow.id}
                onClick={() => handleImportToStudio(detailWorkflow)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-indigo-500/40 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 transition-all cursor-pointer"
              >
                {importingId === detailWorkflow.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <DownloadCloud className="h-3.5 w-3.5" />
                )}
                IMPORT AS STUDIO SKILL
              </button>

              <button
                type="button"
                onClick={() => handleCopyJson(detailWorkflow)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-slate-800 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
              >
                {copiedId === detailWorkflow.id ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                COPY JSON
              </button>

              <a
                href={detailWorkflow.url || `https://n8n.io/workflows/${detailWorkflow.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                View on n8n.io <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Converted Graph Architecture Info */}
            {detailWorkflow.convertedGraph && (
              <div className="space-y-2 p-4 rounded-xl border border-indigo-950 bg-indigo-950/20">
                <div className="flex items-center justify-between text-xs text-indigo-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    AGENT STUDIO CANVAS MAPPING
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {detailWorkflow.convertedGraph.nodes.length} Nodes · {detailWorkflow.convertedGraph.edges.length} Edges
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  This workflow has been translated into an Agent Studio visual graph definition. Opening it on the canvas will render all triggers, agent LLM steps, conditional routers, and tool connectors with wiring intact.
                </p>
              </div>
            )}

            {/* Description & Overview */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Workflow Overview & Instructions
              </h4>
              <div className="text-xs text-slate-300/90 font-sans leading-relaxed whitespace-pre-wrap bg-slate-900/40 p-4 rounded-xl border border-slate-900 max-h-80 overflow-y-auto">
                {detailWorkflow.description || "No detailed description available."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
