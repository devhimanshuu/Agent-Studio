"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Search,
  Globe,
  Download,
  Loader2,
  ExternalLink,
  ArrowRight,
  X,
  FileCode,
  Mail,
  Play,
  Copy,
  Check,
  BookOpen,
} from "lucide-react";
import { clsx } from "clsx";
import { ItemIcon } from "@/components/common/ItemIcon";
import { Pagination } from "@/components/common/Pagination";
import { OpenApiParsedSpecDTO } from "@/types/openapi";

interface DirectoryApiItem {
  id: string;
  provider: string;
  name: string;
  description: string;
  fullDescription?: string;
  specUrl: string;
  specYamlUrl?: string;
  openapiVer: string;
  categories: string[];
  logoUrl?: string;
  version: string;
  updatedAt?: string;
  externalDocsUrl?: string;
  license?: string;
  contactEmail?: string;
  contactUrl?: string;
  originUrl?: string;
}

interface DirectoryMetrics {
  numAPIs: number;
  numEndpoints: number;
  numSpecs: number;
}

interface OpenApiDirectoryBrowserProps {
  onSelectSpecUrl: (url: string) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

const TOP_PROVIDER_SHORTCUTS = [
  { id: "all", label: "ALL PROVIDERS" },
  { id: "googleapis.com", label: "GOOGLE" },
  { id: "azure.com", label: "AZURE" },
  { id: "amazonaws.com", label: "AWS" },
  { id: "github.com", label: "GITHUB" },
  { id: "stripe.com", label: "STRIPE" },
  { id: "twilio.com", label: "TWILIO" },
  { id: "cloudflare.com", label: "CLOUDFLARE" },
  { id: "spotify.com", label: "SPOTIFY" },
  { id: "slack.com", label: "SLACK" },
];

export function OpenApiDirectoryBrowser({ onSelectSpecUrl }: OpenApiDirectoryBrowserProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [provider, setProvider] = useState("all");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<DirectoryApiItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<DirectoryMetrics | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [installedSpecUrls, setInstalledSpecUrls] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem("openapi-installed") || "[]"));
    } catch {
      return new Set();
    }
  });

  // Detail Modal
  const [detailItem, setDetailItem] = useState<DirectoryApiItem | null>(null);

  // Container Ref for scrolling to top when page changes
  const containerRef = useRef<HTMLDivElement>(null);

  const _toggleInstalled = useCallback((specUrl: string) => {
    setInstalledSpecUrls((prev) => {
      const next = new Set(prev);
      if (next.has(specUrl)) {
        next.delete(specUrl);
      } else {
        next.add(specUrl);
      }
      try {
        localStorage.setItem("openapi-installed", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const fetchDirectory = useCallback(
    async (
      searchQuery: string,
      categoryFilter: string,
      providerFilter: string,
      pageNum: number
    ) => {
      setLoading(true);

      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
        if (providerFilter && providerFilter !== "all") params.set("provider", providerFilter);
        params.set("page", String(pageNum));
        params.set("limit", "24");

        const res = await fetch(`/api/openapi/directory?${params.toString()}`);
        const json = await res.json();
        if (res.ok && json.success) {
          const newItems: DirectoryApiItem[] = json.data.items;
          setItems(newItems);
          setTotalCount(json.data.total);
          if (json.data.metrics) setMetrics(json.data.metrics);
          if (json.data.categories && categories.length === 0) {
            setCategories(json.data.categories);
          }
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    },
    [categories.length]
  );

  // Reset to page 1 on filter or search changes
  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => {
      fetchDirectory(search, category, provider, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, category, provider, fetchDirectory]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchDirectory(search, category, provider, newPage);
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const totalPages = useMemo(() => Math.ceil(totalCount / 24), [totalCount]);

  // Client-side installed filter
  const filteredItems = useMemo(() => {
    if (!showInstalledOnly) return items;
    return items.filter((item) => installedSpecUrls.has(item.specUrl));
  }, [items, showInstalledOnly, installedSpecUrls]);

  return (
    <div ref={containerRef} className="space-y-4 w-full font-mono">
      {/* Directory Metrics Top Box */}
      {metrics && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-md border border-slate-200 dark:border-indigo-950/80 bg-white dark:bg-[#08080c] shadow-xs">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              APIs.guru Registry Index
            </span>
            <span className="px-1.5 py-0.2 rounded text-[8px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold uppercase border border-emerald-300 dark:border-emerald-700/40">
              Live
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
            <span>{pad(metrics.numAPIs)} APIS</span>
            <span>·</span>
            <span>{pad(metrics.numEndpoints)} OPERATIONS</span>
            <span>·</span>
            <span>{pad(metrics.numSpecs)} SPECS</span>
          </div>
        </div>
      )}

      {/* Provider Filter Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {TOP_PROVIDER_SHORTCUTS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProvider(p.id)}
            className={clsx(
              "px-2.5 py-1 rounded text-[10px] font-semibold whitespace-nowrap transition-all border uppercase cursor-pointer",
              provider === p.id
                ? "border-indigo-400 bg-indigo-600 text-white shadow-xs"
                : "border-slate-300 dark:border-indigo-950/60 bg-white dark:bg-[#0a0a0a]/60 text-slate-700 dark:text-slate-400 hover:border-indigo-400"
            )}
          >
            {p.label}
          </button>
        ))}
        <div className="w-px h-5 bg-slate-200 dark:bg-indigo-950 mx-1" />
        <button
          type="button"
          onClick={() => setShowInstalledOnly((p) => !p)}
          className={clsx(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold whitespace-nowrap transition-all border uppercase cursor-pointer",
            showInstalledOnly
              ? "border-emerald-400 bg-emerald-600 text-white shadow-xs"
              : "border-slate-300 dark:border-indigo-950/60 bg-white dark:bg-[#0a0a0a]/60 text-slate-700 dark:text-slate-400 hover:border-emerald-400"
          )}
        >
          <Check className="h-3 w-3" />
          INSTALLED
          {installedSpecUrls.size > 0 && <span className="opacity-75">({installedSpecUrls.size})</span>}
        </button>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2 p-2 rounded-md border border-slate-200 dark:border-indigo-950/60 bg-white dark:bg-[#08080c]">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search 2,500+ APIs (e.g. Spotify, Stripe, NASA, Google, Weather)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#050508] border border-slate-200 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        {categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#050508] border border-slate-200 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono uppercase"
          >
            <option value="all">All Categories ({totalCount})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.toUpperCase()}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2 text-indigo-500" /> SEARCHING APIS.GURU INDEX...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-300 dark:border-indigo-900/60 rounded-md space-y-1 bg-white/40 dark:bg-[#08080c]/60">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">NO APIS FOUND</p>
          <p className="text-[11px] text-slate-500">{showInstalledOnly ? "No installed APIs match this filter." : "Try searching for a different keyword or provider name."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredItems.map((item) => {
              const isInstalled = installedSpecUrls.has(item.specUrl);
              return (
              <div
                key={item.id}
                onClick={() => setDetailItem(item)}
                className="p-3.5 rounded-md border border-slate-200 dark:border-indigo-950/60 bg-white dark:bg-[#08080c] flex flex-col justify-between gap-3 hover:border-indigo-500/60 transition-all group shadow-xs cursor-pointer"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <ItemIcon
                        name={item.name}
                        logoUrl={item.logoUrl}
                        category={item.categories[0]}
                        tags={item.categories}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-400 transition-colors uppercase tracking-wide truncate">
                          {item.name}
                        </h4>
                        <p className="text-[9px] font-mono text-indigo-500 dark:text-indigo-400 truncate">
                          {item.provider} · v{item.version}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isInstalled && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                          <Check className="h-2.5 w-2.5" /> INSTALLED
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 text-[8px] font-mono font-semibold rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-indigo-950 uppercase">
                        OAS {item.openapiVer}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description || "No description provided."}
                  </p>

                  {item.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.categories.slice(0, 3).map((c) => (
                        <span
                          key={c}
                          className="px-1.5 py-0.2 text-[8px] uppercase font-semibold rounded bg-slate-100 dark:bg-indigo-950/30 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-indigo-950"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 hover:text-indigo-400 flex items-center gap-1">
                    Inspect Details <ArrowRight className="w-2.5 h-2.5" />
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSpecUrl(item.specUrl);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 shadow-sm shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> IMPORT SPEC
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>

          {/* Proper Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      )}

      {/* Detail Dialog Modal */}
      {detailItem && (
        <DirectoryApiDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onImport={() => {
            const url = detailItem.specUrl;
            setDetailItem(null);
            onSelectSpecUrl(url);
          }}
        />
      )}
    </div>
  );
}

/* ────────────── Detail Modal Component ────────────── */

function DirectoryApiDetailModal({
  item,
  onClose,
  onImport,
}: {
  item: DirectoryApiItem;
  onClose: () => void;
  onImport: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "ENDPOINTS" | "SPEC">("OVERVIEW");
  const [specData, setSpecData] = useState<OpenApiParsedSpecDTO | null>(null);
  const [specLoading, setSpecLoading] = useState(false);
  const [specError, setSpecError] = useState<string | null>(null);
  const [endpointSearch, setEndpointSearch] = useState("");
  const [copied, setCopied] = useState(false);

  // Auto-introspect spec when Endpoints tab is opened
  useEffect(() => {
    if (activeTab === "ENDPOINTS" && !specData && !specLoading && !specError) {
      setSpecLoading(true);
      fetch("/api/openapi/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specUrl: item.specUrl }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setSpecData(json.data);
          } else {
            setSpecError(json.error || "Failed to introspect endpoints");
          }
        })
        .catch((err) => {
          setSpecError(err instanceof Error ? err.message : "Network error");
        })
        .finally(() => {
          setSpecLoading(false);
        });
    }
  }, [activeTab, item.specUrl, specData, specLoading, specError]);

  const copySpecUrl = () => {
    navigator.clipboard.writeText(item.specUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredEndpoints = specData?.endpoints.filter((ep) => {
    const q = endpointSearch.toLowerCase();
    return (
      ep.summary.toLowerCase().includes(q) ||
      ep.path.toLowerCase().includes(q) ||
      ep.operationId.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-mono animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] rounded-lg border border-slate-300 dark:border-indigo-900/80 bg-white dark:bg-[#08080c] shadow-2xl shadow-indigo-500/10 flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-[#0a0a0e]">
          <div className="flex items-center gap-3 min-w-0">
            <ItemIcon
              name={item.name}
              logoUrl={item.logoUrl}
              category={item.categories[0]}
              tags={item.categories}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-pixel text-pixel-glow text-indigo-700 dark:text-indigo-300 uppercase tracking-wide truncate">
                  {item.name}
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-semibold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-indigo-950 uppercase shrink-0">
                  OAS {item.openapiVer}
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-500 truncate">
                Provider: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.provider}</span> · v{item.version}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-indigo-950/40 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 py-2 bg-slate-100/50 dark:bg-[#050508] border-b border-slate-200 dark:border-indigo-950 text-[10px] font-mono font-semibold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab("OVERVIEW")}
            className={clsx(
              "px-3 py-1 rounded transition-all cursor-pointer",
              activeTab === "OVERVIEW"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            Overview & Specs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ENDPOINTS")}
            className={clsx(
              "px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1",
              activeTab === "ENDPOINTS"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Play className="w-2.5 h-2.5" /> Endpoints Introspection
            {specData && <span className="text-[8px] opacity-80">({specData.endpoints.length})</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SPEC")}
            className={clsx(
              "px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1",
              activeTab === "SPEC"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <FileCode className="w-2.5 h-2.5" /> Spec URL & Links
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-mono">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "OVERVIEW" && (
            <div className="space-y-4">
              {/* Full Description */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  DESCRIPTION:
                </p>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-[#06060a] p-3 rounded border border-slate-200 dark:border-indigo-950/80">
                  {item.fullDescription || item.description || "No description provided."}
                </p>
              </div>

              {/* Micro Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded border border-slate-200 dark:border-indigo-950/80 bg-slate-50/50 dark:bg-[#06060a] space-y-1">
                  <span className="text-[9px] uppercase text-slate-500 font-bold">PROVIDER / HOST:</span>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{item.provider}</p>
                </div>

                <div className="p-3 rounded border border-slate-200 dark:border-indigo-950/80 bg-slate-50/50 dark:bg-[#06060a] space-y-1">
                  <span className="text-[9px] uppercase text-slate-500 font-bold">OPENAPI SPEC VERSION:</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    OpenAPI {item.openapiVer} (API v{item.version})
                  </p>
                </div>

                {item.license && (
                  <div className="p-3 rounded border border-slate-200 dark:border-indigo-950/80 bg-slate-50/50 dark:bg-[#06060a] space-y-1">
                    <span className="text-[9px] uppercase text-slate-500 font-bold">LICENSE:</span>
                    <p className="text-xs font-bold text-violet-600 dark:text-violet-400">{item.license}</p>
                  </div>
                )}

                {item.updatedAt && (
                  <div className="p-3 rounded border border-slate-200 dark:border-indigo-950/80 bg-slate-50/50 dark:bg-[#06060a] space-y-1">
                    <span className="text-[9px] uppercase text-slate-500 font-bold">LAST UPDATED IN INDEX:</span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Categories */}
              {item.categories.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    CATEGORIES & TAGS:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.categories.map((cat) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 text-[9px] uppercase font-semibold rounded bg-slate-100 dark:bg-indigo-950/40 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-indigo-900/60"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ENDPOINTS INTROSPECTION */}
          {activeTab === "ENDPOINTS" && (
            <div className="space-y-3">
              {specLoading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                  <p className="text-[11px] text-slate-500">Introspecting OpenAPI specification endpoints...</p>
                </div>
              ) : specError ? (
                <div className="p-3 rounded border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-[11px]">
                  {specError}
                </div>
              ) : specData ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter endpoints by path or operation..."
                      value={endpointSearch}
                      onChange={(e) => setEndpointSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#050508] border border-slate-200 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {filteredEndpoints && filteredEndpoints.length > 0 ? (
                      filteredEndpoints.map((ep) => (
                        <div
                          key={ep.id}
                          className="p-2.5 rounded border border-slate-200 dark:border-indigo-950/80 bg-white dark:bg-[#0a0a0e] flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded border ${getMethodBadge(
                                ep.method
                              )}`}
                            >
                              {ep.method}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">
                                {ep.summary || ep.operationId}
                              </p>
                              <p className="text-[10px] font-mono text-slate-500 truncate">{ep.path}</p>
                            </div>
                          </div>

                          <span className="text-[9px] font-mono text-slate-500 shrink-0">
                            {ep.parameters.length} params
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-6 text-xs text-slate-500">No matching endpoints.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 3: SPEC & LINKS */}
          {activeTab === "SPEC" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <span className="text-[9px] uppercase text-slate-500 font-bold">RAW SPECIFICATION URL:</span>
                <div className="flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-[#06060a]">
                  <input
                    type="text"
                    readOnly
                    value={item.specUrl}
                    className="flex-1 bg-transparent text-[10px] font-mono text-slate-700 dark:text-slate-300 focus:outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={copySpecUrl}
                    className="px-2 py-1 rounded bg-slate-200 dark:bg-indigo-950/60 text-[9px] font-bold uppercase hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {item.externalDocsUrl && (
                  <a
                    href={item.externalDocsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded border border-slate-200 dark:border-indigo-950/80 bg-slate-50/50 dark:bg-[#06060a] hover:border-indigo-500 flex items-center justify-between text-[11px] transition-all"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> View Documentation
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}

                {item.specYamlUrl && (
                  <a
                    href={item.specYamlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded border border-slate-200 dark:border-indigo-950/80 bg-slate-50/50 dark:bg-[#06060a] hover:border-indigo-500 flex items-center justify-between text-[11px] transition-all"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-amber-400" /> View YAML Spec
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}

                {item.originUrl && (
                  <a
                    href={item.originUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded border border-slate-200 dark:border-indigo-950/80 bg-slate-50/50 dark:bg-[#06060a] hover:border-indigo-500 flex items-center justify-between text-[11px] transition-all"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" /> Original Source Spec
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}

                {item.contactEmail && (
                  <a
                    href={`mailto:${item.contactEmail}`}
                    className="p-3 rounded border border-slate-200 dark:border-indigo-950/80 bg-slate-50/50 dark:bg-[#06060a] hover:border-indigo-500 flex items-center justify-between text-[11px] transition-all"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-sky-400" /> Contact Developer
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-[#0a0a0e]">
          <span className="text-[10px] text-slate-500">APIs.guru Registry Specification</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase text-slate-600 dark:text-slate-400 hover:text-slate-800 cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={onImport}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5" /> 1-Click Import Specification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getMethodBadge(method: string) {
  switch (method) {
    case "GET":
      return "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300";
    case "POST":
      return "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300";
    case "PUT":
    case "PATCH":
      return "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300";
    case "DELETE":
      return "border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300";
    default:
      return "border-slate-300 dark:border-indigo-900/60 bg-slate-100 dark:bg-indigo-950/40 text-slate-700 dark:text-slate-300";
  }
}
