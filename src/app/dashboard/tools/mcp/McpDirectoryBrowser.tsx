"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Globe,
  Search,
  Star,
  Sparkles,
  ExternalLink,
  Plus,
  Loader2,
  X,
  ShieldCheck,
  Zap,
  Terminal,
  Server,
  Tag,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Code,
  Database,
  Monitor,
  Cpu,
  Brain,
  BookOpen,
  Wrench,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Heart,
  Activity,
  Clock,
  FileText,
  ArrowUpDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
} from "lucide-react";
import { clsx } from "clsx";
import { ItemIcon } from "@/components/common/ItemIcon";
import {
  PublicMcpServer,
  PublicMcpSource,
  McpDirectoryResponse,
  GitHubRepoInfo,
  ServerHealthPing,
} from "@/types/mcp-directory";
import { ServerQualityScore, QualityGrade } from "@/types/agent-studio-registry";

interface McpDirectoryBrowserProps {
  onMount: (server: PublicMcpServer) => void;
  mountedServerIds?: string[];
}

const SOURCES: { id: "ALL" | PublicMcpSource; label: string; countKey?: "glamaCount" | "mcpSoCount" | "smitheryCount" | "composioCount" | "arcadeCount" }[] = [
  { id: "ALL", label: "ALL REGISTRIES" },
  { id: "glama", label: "GLAMA DIRECTORY", countKey: "glamaCount" },
  { id: "mcp.so", label: "MCP.SO & CURATED", countKey: "mcpSoCount" },
  { id: "smithery", label: "SMITHERY (9K+)", countKey: "smitheryCount" },
  { id: "composio", label: "COMPOSIO (1K+)", countKey: "composioCount" },
  { id: "arcade", label: "ARCADE (7.5K+)", countKey: "arcadeCount" },
];

const CATEGORIES = [
  { id: "ALL", label: "ALL CATEGORIES", icon: Sparkles },
  { id: "DATABASES", label: "DATABASES", icon: Database },
  { id: "BROWSER AUTOMATION", label: "BROWSER AUTO", icon: Monitor },
  { id: "SEARCH & DATA EXTRACTION", label: "SEARCH & WEB", icon: Globe },
  { id: "DEVELOPER TOOLS", label: "DEV TOOLS", icon: Code },
  { id: "CLOUD PLATFORMS", label: "CLOUD", icon: Cpu },
  { id: "PRODUCTIVITY", label: "PRODUCTIVITY", icon: Zap },
  { id: "AI & REASONING", label: "AI & REASONING", icon: Brain },
  { id: "KNOWLEDGE & MEMORY", label: "KNOWLEDGE", icon: BookOpen },
  { id: "COMMUNICATION", label: "COMMUNICATION", icon: Globe },
  { id: "FINANCE & FINTECH", label: "FINANCE", icon: Zap },
  { id: "SECURITY", label: "SECURITY", icon: ShieldCheck },
  { id: "DEVOPS & CLOUD", label: "DEVOPS", icon: Cpu },
  { id: "FILE SYSTEMS", label: "FILES", icon: FileText },
  { id: "MULTIMEDIA PROCESS", label: "MEDIA", icon: Monitor },
  { id: "OS AUTOMATION", label: "OS AUTO", icon: Terminal },
  { id: "RESEARCH", label: "RESEARCH", icon: BookOpen },
  { id: "UTILITIES", label: "UTILITIES", icon: Wrench },
];

const LANGUAGES = [
  { id: "ALL", label: "ALL LANGUAGES" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "csharp", label: "C#" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C/C++" },
  { id: "ruby", label: "Ruby" },
];

const LANGUAGE_COLORS: Record<string, string> = {
  typescript: "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300",
  python: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300",
  go: "border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300",
  rust: "border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300",
  csharp: "border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300",
  java: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
  cpp: "border-pink-300 dark:border-pink-500/40 bg-pink-50 dark:bg-pink-950/40 text-pink-800 dark:text-pink-300",
  ruby: "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300",
};

const TRANSPORTS = [
  { id: "ALL", label: "ALL TRANSPORTS" },
  { id: "STDIO", label: "STDIO (LOCAL)" },
  { id: "SSE", label: "SSE (REMOTE)" },
];

const SORT_OPTIONS = [
  { id: "default", label: "DEFAULT" },
  { id: "stars", label: "MOST POPULAR" },
  { id: "name", label: "A-Z" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["id"];

const PAGE_SIZE = 36;

// ────────────── Favorites Hook (localStorage) ──────────────

function useDirectoryFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("mcp-dir-favorites") || "[]");
    } catch {
      return [];
    }
  });

  const toggleFavorite = useCallback((serverId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(serverId) ? prev.filter((id) => id !== serverId) : [...prev, serverId];
      try {
        localStorage.setItem("mcp-dir-favorites", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isFavorite = useCallback((serverId: string) => favorites.includes(serverId), [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}

// ────────────── Main Component ──────────────

export function McpDirectoryBrowser({ onMount, mountedServerIds = [] }: McpDirectoryBrowserProps) {
  const [servers, setServers] = useState<PublicMcpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"ALL" | PublicMcpSource>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [transport, setTransport] = useState<string>("ALL");
  const [language, setLanguage] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [counts, setCounts] = useState<{ glamaCount: number; mcpSoCount: number; smitheryCount: number; composioCount: number; arcadeCount: number }>({ glamaCount: 0, mcpSoCount: 0, smitheryCount: 0, composioCount: 0, arcadeCount: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailServer, setDetailServer] = useState<PublicMcpServer | null>(null);
  const [qualityScores, setQualityScores] = useState<Map<string, ServerQualityScore>>(new Map());
  const [qualityLoading, setQualityLoading] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [dirViewMode, setDirViewMode] = useState<"grid" | "row">("grid");

  const { favorites, toggleFavorite, isFavorite } = useDirectoryFavorites();

  const mountedSet = useMemo(() => new Set(mountedServerIds), [mountedServerIds]);

  const fetchDirectory = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (source !== "ALL") params.set("source", source);
      if (category !== "ALL") params.set("category", category);
      if (transport !== "ALL") params.set("transport", transport);
      if (language !== "ALL") params.set("language", language);

      const res = await fetch(`/api/mcp/directory?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const json: McpDirectoryResponse = await res.json();
      if (json.success) {
        setServers(json.data);
        if (json.sources) setCounts({
          glamaCount: json.sources.glamaCount || 0,
          mcpSoCount: json.sources.mcpSoCount || 0,
          smitheryCount: json.sources.smitheryCount || 0,
          composioCount: json.sources.composioCount || 0,
          arcadeCount: json.sources.arcadeCount || 0,
        });
        setCurrentPage(1);
      } else {
        throw new Error("Failed to load directory");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error connecting to directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDirectory();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, source, category, transport, language]);

  // Fetch quality scores for visible servers
  useEffect(() => {
    if (servers.length === 0) return;
    setQualityLoading(true);
    fetch("/api/mcp/quality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        servers: servers.slice(0, 20).map((s) => ({
          id: s.id,
          name: s.name,
          transport: s.transport,
          endpointUrl: s.endpointUrl,
          repoUrl: s.repoUrl,
          description: s.description,
          stars: s.stars,
          isVerified: s.isVerified,
        })),
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          const map = new Map<string, ServerQualityScore>();
          for (const score of json.data) {
            map.set(score.serverId, score);
          }
          setQualityScores(map);
        }
      })
      .catch(() => {})
      .finally(() => setQualityLoading(false));
  }, [servers]);

  const copyCommand = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Apply sorting + favorites filter
  const processedServers = useMemo(() => {
    let list = [...servers];

    // Favorites filter
    if (showFavoritesOnly) {
      list = list.filter((s) => favorites.includes(s.id));
    }

    // Sorting
    if (sortBy === "stars") {
      list.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    } else if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    // "default" keeps API order (verified first, then stars)

    return list;
  }, [servers, sortBy, showFavoritesOnly, favorites]);

  const totalPages = Math.max(1, Math.ceil(processedServers.length / PAGE_SIZE));

  // Scroll to top of grid on page change
  useEffect(() => {
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentPage]);

  // Clamp current page when totalPages shrinks (e.g. favorites filter, search)
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const visibleServers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return processedServers.slice(start, start + PAGE_SIZE);
  }, [processedServers, currentPage]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Header */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-black/40 p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 500+ servers (e.g. Supabase, Notion, Obsidian, Postgres, GitHub, Playwright)..."
            className="w-full pl-9 pr-8 py-2 text-xs font-mono rounded border border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-black/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Source Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SOURCES.map((s) => {
            const active = source === s.id;
            const badgeCount =
              s.id === "ALL"
                ? counts.glamaCount + counts.mcpSoCount + counts.smitheryCount + counts.composioCount + counts.arcadeCount
                : s.countKey
                ? counts[s.countKey]
                : 0;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSource(s.id)}
                className={clsx(
                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
                  active
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/40 text-slate-600 dark:text-slate-400 hover:border-indigo-400"
                )}
              >
                <Globe className="h-3 w-3" />
                {s.label}
                {badgeCount > 0 && <span className="opacity-75 font-normal">({badgeCount})</span>}
              </button>
            );
          })}
        </div>

        {/* Transport Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-black/60 p-1 rounded border border-slate-200 dark:border-indigo-950">
          {TRANSPORTS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTransport(t.id)}
              className={clsx(
                "px-2 py-1 rounded text-[9px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer",
                transport === t.id
                  ? "bg-white dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Language Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold shrink-0 flex items-center gap-1">
          <Code className="h-3 w-3" /> LANG:
        </span>
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            type="button"
            onClick={() => setLanguage(lang.id)}
            className={clsx(
              "px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer shrink-0",
              language === lang.id
                ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                : "border-slate-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/40 text-slate-500 dark:text-slate-400 hover:border-indigo-400"
            )}
          >
            {lang.label}
          </button>
        ))}
      </div>

      {/* Category Pills + Sort + Favorites */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = category === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={clsx(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
                  active
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/40 text-slate-600 dark:text-slate-400 hover:border-indigo-400"
                )}
              >
                <Icon className="h-3 w-3" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Sort + Favorites Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Favorites toggle */}
          <button
            type="button"
            onClick={() => setShowFavoritesOnly((prev) => !prev)}
            className={clsx(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
              showFavoritesOnly
                ? "border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 shadow-sm"
                : "border-slate-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/40 text-slate-500 dark:text-slate-400 hover:border-rose-300 hover:text-rose-600"
            )}
          >
            <Heart className={clsx("h-3 w-3", showFavoritesOnly && "fill-rose-500")} />
            {favorites.length > 0 && <span>({favorites.length})</span>}
          </button>

          {/* Sort dropdown */}
          <div className="relative">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-black/60 p-1 rounded border border-slate-200 dark:border-indigo-950">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortBy(opt.id)}
                  className={clsx(
                    "px-2 py-1 rounded text-[9px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer",
                    sortBy === opt.id
                      ? "bg-white dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Count & Status */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          {loading ? "FETCHING 500+ SERVERS FROM GLAMA & MCP.SO..." : `DISPLAYING ${visibleServers.length} OF ${processedServers.length} COMPATIBLE MCP SERVERS`}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase hidden sm:block">GLAMA.AI • MCP.SO • SMITHERY</span>
          {!loading && processedServers.length > 0 && (
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-slate-100 dark:bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => setDirViewMode("grid")}
                className={clsx(
                  "p-1.5 rounded text-xs font-mono transition-all cursor-pointer",
                  dirViewMode === "grid"
                    ? "bg-white dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                title="Card Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDirViewMode("row")}
                className={clsx(
                  "p-1.5 rounded text-xs font-mono transition-all cursor-pointer",
                  dirViewMode === "row"
                    ? "bg-white dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                title="Row List View"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-xs font-mono text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Grid of Servers */}
      {loading && servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <p className="text-xs font-mono text-slate-500">Querying Glama Directory &amp; mcp.so...</p>
        </div>
      ) : processedServers.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 dark:border-indigo-900/50 p-12 text-center space-y-2">
          <Globe className="h-8 w-8 text-indigo-400 mx-auto" />
          <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">NO DIRECTORY SERVERS FOUND</p>
          <p className="text-xs font-mono text-slate-500">
            {showFavoritesOnly
              ? "No favorite servers yet. Star servers to add them here."
              : `No public MCP servers matched "${search}". Try adjusting your search query or category filter.`}
          </p>
        </div>
      ) : (
        <>
          {dirViewMode === "grid" ? (
          <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {visibleServers.map((server) => {
              const isSse = server.transport === "SSE";
              const targetCmd = isSse ? server.endpointUrl ?? "" : server.command ?? "";
              const isMounted = mountedSet.has(server.id);
              const isFav = isFavorite(server.id);

              return (
                <div
                  key={server.id}
                  onClick={() => setDetailServer(server)}
                  className="group rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 hover:border-indigo-500/60 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all p-4 flex flex-col justify-between space-y-3 cursor-pointer"
                >
                  {/* Card Top */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <ItemIcon
                          name={server.name}
                          category={server.category}
                          tags={server.tags}
                          owner={server.owner}
                          repoUrl={server.repoUrl}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {server.name}
                            </h4>
                            {server.isVerified && (
                              <span title="Verified Server">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              </span>
                            )}
                            {isMounted && (
                              <span title="Already mounted" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/50">
                                <Check className="h-2.5 w-2.5" /> MOUNTED
                              </span>
                            )}
                            {(() => {
                              const score = qualityScores.get(server.id);
                              if (!score) return null;
                              return (
                                <QualityBadge grade={score.overall} score={score.overallScore} />
                              );
                            })()}
                          </div>
                          <p className="text-[10px] font-mono text-slate-500 truncate">
                            by <span className="font-semibold text-slate-700 dark:text-slate-300">{server.owner || "community"}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Favorite button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(server.id);
                          }}
                          title={isFav ? "Remove from favorites" : "Add to favorites"}
                          className="cursor-pointer p-0.5 transition-all"
                        >
                          <Heart
                            className={clsx(
                              "h-3.5 w-3.5 transition-colors",
                              isFav ? "text-rose-500 fill-rose-500" : "text-slate-300 hover:text-rose-400"
                            )}
                          />
                        </button>

                        {/* Transport Tag */}
                        <span
                          className={clsx(
                            "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border uppercase tracking-wider",
                            isSse
                              ? "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300"
                              : "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                          )}
                        >
                          {server.transport}
                        </span>

                        {/* Source Tag */}
                        <span className={clsx(
                          "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border",
                          server.source === "smithery"
                            ? "border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
                            : "bg-slate-100 dark:bg-indigo-950/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-indigo-900/50"
                        )}>
                          {server.source === "smithery" ? "SMITHERY" : server.source}
                        </span>

                        {/* Language Tag */}
                        {server.language && server.language !== "unknown" && (
                          <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", LANGUAGE_COLORS[server.language] || "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-400")}>
                            {server.language}
                          </span>
                        )}

                        {/* License Tag */}
                        {server.license && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300">
                            {server.license}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {server.description}
                    </p>

                    {/* Tags */}
                    {server.tags && server.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {server.tags.slice(0, 4).map((t, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-slate-100 dark:bg-black/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-indigo-950"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Command/Endpoint Snippet */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-indigo-950/60">
                    <div className="relative rounded border border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-black/80 px-2.5 py-1.5 flex items-center justify-between gap-2">
                      <span className="text-[9px] font-mono text-slate-600 dark:text-slate-300 truncate">
                        {targetCmd}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyCommand(server.id, targetCmd);
                        }}
                        title="Copy command"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
                      >
                        {copiedId === server.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                        {server.stars !== undefined && server.stars > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                            <Star className="h-3 w-3 fill-amber-400" /> {server.stars}
                          </span>
                        )}
                        {server.repoUrl && (
                          <a
                            href={server.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            Repo <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMount(server);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-mono font-semibold uppercase tracking-wider shadow-sm shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> 1-CLICK MOUNT
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
          /* ────────────── Row / List View ────────────── */
          <div ref={gridRef} className="space-y-2.5">
            {visibleServers.map((server) => {
              const isSse = server.transport === "SSE";
              const targetCmd = isSse ? server.endpointUrl ?? "" : server.command ?? "";
              const isMounted = mountedSet.has(server.id);
              const isFav = isFavorite(server.id);

              return (
                <div
                  key={server.id}
                  onClick={() => setDetailServer(server)}
                  className="group rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 hover:border-indigo-500/60 dark:hover:border-indigo-500/50 hover:shadow-md transition-all p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 cursor-pointer"
                >
                  {/* Left: Info, Badges */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <ItemIcon
                        name={server.name}
                        category={server.category}
                        tags={server.tags}
                        owner={server.owner}
                        repoUrl={server.repoUrl}
                        size="xs"
                      />
                      <h3 className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {server.name}
                      </h3>
                      {server.isVerified && (
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                      {isMounted && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/50 shrink-0">
                          <Check className="h-2.5 w-2.5" /> MOUNTED
                        </span>
                      )}
                      {(() => {
                        const score = qualityScores.get(server.id);
                        if (!score) return null;
                        return <QualityBadge grade={score.overall} score={score.overallScore} />;
                      })()}
                      <span className="text-[9px] font-mono text-slate-500">
                        by <span className="font-semibold text-slate-700 dark:text-slate-300">{server.owner || "community"}</span>
                      </span>
                      <span
                        className={clsx(
                          "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border uppercase tracking-wider",
                          isSse
                            ? "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300"
                            : "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                        )}
                      >
                        {server.transport}
                      </span>
                      <span className={clsx(
                        "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border",
                        server.source === "smithery"
                          ? "border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
                          : "bg-slate-100 dark:bg-indigo-950/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-indigo-900/50"
                      )}>
                        {server.source === "smithery" ? "SMITHERY" : server.source}
                      </span>
                      {server.language && server.language !== "unknown" && (
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", LANGUAGE_COLORS[server.language] || "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-400")}>
                          {server.language}
                        </span>
                      )}
                      {server.license && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300">
                          {server.license}
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 line-clamp-1 leading-relaxed">
                      {server.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 text-[8px] font-mono text-slate-400">
                      {server.tags && server.tags.slice(0, 3).map((t, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-black/50 text-slate-500 border border-slate-200 dark:border-indigo-950">
                          #{t}
                        </span>
                      ))}
                      <span>•</span>
                      <span className="truncate max-w-[200px]">{targetCmd}</span>
                    </div>
                  </div>

                  {/* Right: Stats & Action */}
                  <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-indigo-950/60">
                    <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500">
                      {server.stars !== undefined && server.stars > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                          <Star className="h-3 w-3 fill-amber-400" /> {server.stars}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(server.id);
                        }}
                        title={isFav ? "Remove from favorites" : "Add to favorites"}
                        className="cursor-pointer p-0.5 transition-all"
                      >
                        <Heart className={clsx("h-3.5 w-3.5 transition-colors", isFav ? "text-rose-500 fill-rose-500" : "text-slate-300 hover:text-rose-400")} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMount(server);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-mono font-semibold uppercase tracking-wider shadow-sm shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer shrink-0 min-w-[90px]"
                    >
                      <Plus className="h-3 w-3" /> MOUNT
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {/* Server Detail Modal */}
      {detailServer && createPortal(
        <ServerDetailModal
          server={detailServer}
          qualityScore={qualityScores.get(detailServer.id) || null}
          onClose={() => setDetailServer(null)}
          onMount={() => {
            onMount(detailServer);
            setDetailServer(null);
          }}
          isFavorite={isFavorite(detailServer.id)}
          onToggleFavorite={() => toggleFavorite(detailServer.id)}
          isMounted={mountedSet.has(detailServer.id)}
        />,
        document.body
      )}
    </div>
  );
}

/* ────────────── Server Detail Modal ────────────── */

function ServerDetailModal({
  server,
  qualityScore,
  onClose,
  onMount,
  isFavorite,
  onToggleFavorite,
  isMounted,
}: {
  server: PublicMcpServer;
  qualityScore: ServerQualityScore | null;
  onClose: () => void;
  onMount: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isMounted: boolean;
}) {
  const isSse = server.transport === "SSE";
  const targetCmd = isSse ? server.endpointUrl ?? "" : server.command ?? "";
  const requiresAuth = Boolean(server.requiresAuthToken);
  const hasEnvVars = Boolean(server.envVarsRequired && server.envVarsRequired.length > 0);

  // GitHub info state
  const [githubInfo, setGithubInfo] = useState<GitHubRepoInfo | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubTab, setGithubTab] = useState<"readme" | "changelog">("readme");
  const [readmeExpanded, setReadmeExpanded] = useState(false);

  // Health ping state
  const [health, setHealth] = useState<ServerHealthPing | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Fetch GitHub info on mount
  useEffect(() => {
    if (!server.repoUrl) return;
    setGithubLoading(true);
    fetch(`/api/mcp/directory/github?repo=${encodeURIComponent(server.repoUrl)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setGithubInfo(json.data);
      })
      .catch(() => {})
      .finally(() => setGithubLoading(false));
  }, [server.repoUrl]);

  // Ping health for SSE servers
  useEffect(() => {
    if (!isSse || !server.endpointUrl) return;
    setHealthLoading(true);
    fetch("/api/mcp/directory/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpointUrl: server.endpointUrl }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setHealth(json.data);
      })
      .catch(() => {})
      .finally(() => setHealthLoading(false));
  }, [isSse, server.endpointUrl]);

  // Format markdown readme to plain text (simplified)
  const formatReadme = (md: string): string => {
    return md
      .replace(/```[\s\S]*?```/g, "[code block]")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "[image]")
      .replace(/^[-*]\s+/gm, "• ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-indigo-800/60 bg-white dark:bg-[#0a0a0a] shadow-2xl shadow-indigo-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-indigo-950 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm rounded-t-xl">
          <div className="flex items-center gap-3 min-w-0">
            <ItemIcon
              name={server.name}
              category={server.category}
              tags={server.tags}
              owner={server.owner}
              repoUrl={server.repoUrl}
              size="lg"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                  {server.name}
                </h3>
                {isMounted && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/50">
                    <Check className="h-2.5 w-2.5" /> ALREADY MOUNTED
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-slate-500">
                by <span className="font-semibold text-slate-700 dark:text-slate-300">{server.owner || "community"}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleFavorite}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-indigo-950/60 transition-all cursor-pointer"
            >
              <Heart className={clsx("h-4 w-4", isFavorite ? "text-rose-500 fill-rose-500" : "text-slate-400 hover:text-rose-400")} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-indigo-950/60 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* Description */}
          <div className="space-y-1.5">
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold">DESCRIPTION</div>
            <p className="text-[12px] font-mono text-slate-700 dark:text-slate-300 leading-relaxed">
              {server.description}
            </p>
          </div>

          {/* Tags */}
          {server.tags && server.tags.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
                <Tag className="h-3 w-3" /> TAGS
              </div>
              <div className="flex flex-wrap gap-1.5">
                {server.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded text-[9px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 font-semibold"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-3">
            {server.stars !== undefined && server.stars > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-semibold">
                <Star className="h-3 w-3 fill-amber-400" /> {server.stars} STARS
              </span>
            )}
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-wider",
                isSse
                  ? "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300"
                  : "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
              )}
            >
              {isSse ? <Globe className="h-3 w-3" /> : <Terminal className="h-3 w-3" />} {server.transport}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/60 text-slate-600 dark:text-slate-400 text-[10px] font-mono font-semibold">
              {server.source === "glama" ? "Glama Directory" : server.source === "mcp.so" ? "mcp.so" : "Curated"}
            </span>
            {server.isVerified && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-semibold">
                <ShieldCheck className="h-3 w-3" /> VERIFIED
              </span>
            )}
            {(() => {
              const score = qualityScore;
              if (!score) return null;
              return (
                <span className="inline-flex items-center gap-1.5">
                  <QualityBadge grade={score.overall} score={score.overallScore} />
                  <span className="text-[9px] font-mono text-slate-500">{score.overallScore}/100</span>
                </span>
              );
            })()}
            {server.language && server.language !== "unknown" && (
              <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-wider", LANGUAGE_COLORS[server.language] || "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-400")}>
                <Code className="h-3 w-3" /> {server.language}
              </span>
            )}
            {server.license && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[10px] font-mono font-semibold">
                LICENSE: {server.license}
              </span>
            )}
          </div>

          {/* Health Ping (SSE only) */}
          {isSse && (
            <div className="space-y-1.5">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
                <Activity className="h-3 w-3" /> ENDPOINT HEALTH
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50/60 dark:bg-black/40 p-3">
                {healthLoading ? (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Pinging endpoint...
                  </div>
                ) : health ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "h-2 w-2 rounded-full",
                          health.status === "healthy" ? "bg-emerald-500 animate-pulse" : health.status === "degraded" ? "bg-amber-500" : "bg-red-500"
                        )}
                      />
                      <span className="text-[10px] font-mono font-semibold uppercase">
                        {health.status === "healthy" ? "LIVE & RESPONSIVE" : health.status === "degraded" ? "SLOW RESPONSE" : "UNREACHABLE"}
                      </span>
                    </div>
                    {health.latencyMs > 0 && (
                      <span className="text-[9px] font-mono text-slate-500">{health.latencyMs}ms</span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">Health check unavailable</span>
                )}
              </div>
            </div>
          )}

          {/* Quality Score Breakdown */}
          {(() => {
            const score = qualityScore;
            if (!score) return null;
            return (
              <div className="space-y-2">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
                  <Star className="h-3 w-3" /> QUALITY SCORE
                  <QualityBadge grade={score.overall} score={score.overallScore} />
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50/60 dark:bg-black/40 p-3.5 space-y-2">
                  {Object.entries(score.dimensions as Record<string, { score: number; grade: QualityGrade }>).map(([key, dim]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-slate-600 dark:text-slate-400 capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={clsx(
                              "h-full rounded-full",
                              dim.score >= 80 ? "bg-emerald-500" : dim.score >= 60 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${dim.score}%` }}
                          />
                        </div>
                        <QualityBadge grade={dim.grade} score={dim.score} />
                      </div>
                    </div>
                  ))}
                  {score.badges.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-indigo-950 flex flex-wrap gap-1.5">
                      {score.badges.map((badge) => (
                        <span key={badge.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                          {badge.icon} {badge.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Auth & Permissions Section */}
          <div className="space-y-2">
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" /> AUTH & PERMISSIONS
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50/60 dark:bg-black/40 p-3.5 space-y-2.5">
              {/* Auth Required */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400">Requires Auth Token</span>
                <span className={clsx(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase",
                  requiresAuth
                    ? "border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                    : "border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                )}>
                  {requiresAuth ? <><AlertTriangle className="h-2.5 w-2.5" /> YES</> : <><CheckCircle2 className="h-2.5 w-2.5" /> NO</>}
                </span>
              </div>

              {/* Env Vars Required */}
              {hasEnvVars && (
                <div className="space-y-1.5">
                  <div className="text-[9px] font-mono text-slate-500 font-semibold uppercase">Required Environment Variables</div>
                  <div className="flex flex-wrap gap-1.5">
                    {server.envVarsRequired!.map((env, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
                      >
                        {env}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Compatibility Status */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-indigo-950">
                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400">Compatibility</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-2.5 w-2.5" /> COMPATIBLE — {isSse ? "Remote SSE Endpoint" : "Local stdio Process"}
                </span>
              </div>

              {/* Allowed from Provider */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400">Allowed from Provider</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-2.5 w-2.5" /> YES
                </span>
              </div>
            </div>
          </div>

          {/* Command / Endpoint */}
          <div className="space-y-1.5">
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold">
              {isSse ? "ENDPOINT URL" : "INSTALL COMMAND"}
            </div>
            <div className="rounded border border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-black/80 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300 break-all">
                {targetCmd}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(targetCmd);
                }}
                title="Copy"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Repo Link */}
          {server.repoUrl && (
            <a
              href={server.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              <ExternalLink className="h-3 w-3" /> View Source Repository
            </a>
          )}

          {/* GitHub Info Section (Release + README) */}
          {server.repoUrl && (
            <div className="space-y-2">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> REPOSITORY INFO
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 border-b border-slate-200 dark:border-indigo-950 pb-0">
                <button
                  type="button"
                  onClick={() => setGithubTab("readme")}
                  className={clsx(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t text-[9px] font-mono font-semibold uppercase tracking-wider border border-b-0 transition-all cursor-pointer",
                    githubTab === "readme"
                      ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                      : "border-transparent text-slate-500 hover:text-indigo-600"
                  )}
                >
                  <FileText className="h-3 w-3" /> README
                </button>
                <button
                  type="button"
                  onClick={() => setGithubTab("changelog")}
                  className={clsx(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t text-[9px] font-mono font-semibold uppercase tracking-wider border border-b-0 transition-all cursor-pointer",
                    githubTab === "changelog"
                      ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                      : "border-transparent text-slate-500 hover:text-indigo-600"
                  )}
                >
                  <Clock className="h-3 w-3" /> CHANGELOG
                </button>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50/60 dark:bg-black/40 p-3.5 min-h-[80px]">
                {githubLoading ? (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Fetching from GitHub...
                  </div>
                ) : githubTab === "readme" ? (
                  githubInfo?.readme ? (
                    <div className="space-y-2">
                      <pre className={clsx(
                        "text-[10px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed overflow-hidden",
                        !readmeExpanded && "max-h-32"
                      )}>
                        {formatReadme(githubInfo.readme)}
                      </pre>
                      {githubInfo.readme.length > 500 && (
                        <button
                          type="button"
                          onClick={() => setReadmeExpanded((prev) => !prev)}
                          className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          {readmeExpanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read full README</>}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] font-mono text-slate-400">No README available</p>
                  )
                ) : (
                  githubInfo?.release ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold text-slate-900 dark:text-slate-100">
                          {githubInfo.release.name || githubInfo.release.version}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500">
                          {new Date(githubInfo.release.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                        {githubInfo.release.version}
                      </span>
                      {githubInfo.release.body && (
                        <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                          {formatReadme(githubInfo.release.body)}
                        </pre>
                      )}
                      <a
                        href={githubInfo.release.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[9px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        View on GitHub <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-[10px] font-mono text-slate-400">No releases found</p>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-indigo-950 bg-slate-50/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-slate-300 dark:border-indigo-900/50 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:border-slate-400 transition-all cursor-pointer"
          >
            CLOSE
          </button>
          <button
            type="button"
            onClick={onMount}
            disabled={isMounted}
            className={clsx(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded border text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer",
              isMounted
                ? "border-slate-300 dark:border-indigo-900/50 bg-slate-100 dark:bg-indigo-950/30 text-slate-400 cursor-not-allowed"
                : "border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/25 active:scale-95"
            )}
          >
            {isMounted ? <><Check className="h-3 w-3" /> ALREADY MOUNTED</> : <><Plus className="h-3 w-3" /> 1-CLICK MOUNT</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────── Quality Badge ────────────── */

const GRADE_COLORS: Record<QualityGrade, string> = {
  "A+": "border-emerald-400 dark:border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 shadow-emerald-500/20",
  "A": "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  "B+": "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  "B": "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  "C+": "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  "C": "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  "D": "border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300",
  "F": "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

function QualityBadge({ grade, score }: { grade: QualityGrade; score: number }) {
  const colorClass = GRADE_COLORS[grade] || GRADE_COLORS.B;
  return (
    <span
      title={`Quality: ${grade} (${score}/100)`}
      className={clsx(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border shadow-sm shrink-0",
        colorClass
      )}
    >
      {grade}
    </span>
  );
}

/* ────────────── Pagination ────────────── */

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  // Build page numbers to show (with ellipsis)
  const pages = useMemo(() => {
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const result: (number | "...")[] = [];
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);

    result.push(1);
    if (left > 2) result.push("...");
    for (let i = left; i <= right; i++) result.push(i);
    if (right < totalPages - 1) result.push("...");
    result.push(totalPages);

    return result;
  }, [currentPage, totalPages]);

  return (
    <div className="flex items-center justify-center gap-1 pt-6 pb-2">
      {/* Previous */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="inline-flex items-center justify-center h-8 w-8 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {/* Page Numbers */}
      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-[10px] font-mono text-slate-400 dark:text-slate-600 select-none">
            ...
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={clsx(
              "inline-flex items-center justify-center h-8 min-w-[32px] px-2 rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer",
              currentPage === page
                ? "border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                : "border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
            )}
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="inline-flex items-center justify-center h-8 w-8 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {/* Page Info */}
      <span className="ml-3 text-[10px] font-mono text-slate-500">
        {currentPage} / {totalPages}
      </span>
    </div>
  );
}
