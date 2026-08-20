"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  X,
  Loader2,
  Star,
  Download,
  Clock,
  Zap,
  Code,
  Database,
  Brain,
  BookOpen,
  Globe,
  Wrench,
  MessageSquare,
  BarChart3,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Shield,
  Sparkles,
  LayoutGrid,
  List,
} from "lucide-react";
import { clsx } from "clsx";
import { AgentSkill, SkillCategory } from "@/types/agent-studio-registry";

const CATEGORIES: { id: SkillCategory | "ALL"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "ALL", label: "ALL", icon: Sparkles },
  { id: "RESEARCH", label: "RESEARCH", icon: BookOpen },
  { id: "CODING", label: "CODING", icon: Code },
  { id: "DATA", label: "DATA", icon: Database },
  { id: "ANALYSIS", label: "ANALYSIS", icon: BarChart3 },
  { id: "COMMUNICATION", label: "COMMUNICATION", icon: MessageSquare },
  { id: "AUTOMATION", label: "AUTOMATION", icon: Zap },
  { id: "KNOWLEDGE", label: "KNOWLEDGE", icon: Brain },
  { id: "PRODUCTIVITY", label: "PRODUCTIVITY", icon: Wrench },
  { id: "CREATIVE", label: "CREATIVE", icon: Globe },
];

const DIFFICULTIES = [
  { id: "ALL", label: "ALL LEVELS" },
  { id: "BEGINNER", label: "BEGINNER" },
  { id: "INTERMEDIATE", label: "INTERMEDIATE" },
  { id: "ADVANCED", label: "ADVANCED" },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  BEGINNER: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  INTERMEDIATE: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  ADVANCED: "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

const CATEGORY_COLORS: Record<string, string> = {
  RESEARCH: "border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  CODING: "border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
  DATA: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  ANALYSIS: "border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300",
  COMMUNICATION: "border-pink-300 dark:border-pink-500/40 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300",
  AUTOMATION: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  KNOWLEDGE: "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
  PRODUCTIVITY: "border-slate-300 dark:border-slate-500/40 bg-slate-50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300",
  CREATIVE: "border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
};

const SOURCES = [
  { id: "ALL", label: "ALL SOURCES" },
  { id: "glama", label: "GLAMA.AI" },
  { id: "mcp.so", label: "MCP.SO" },
  { id: "smithery", label: "SMITHERY.AI" },
  { id: "composio", label: "COMPOSIO" },
];

const SOURCE_COLORS: Record<string, string> = {
  glama: "border-cyan-400 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300",
  "mcp.so": "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  smithery: "border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  composio: "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  "awesome-mcp": "border-purple-400 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300",
  community: "border-slate-400 dark:border-slate-500/40 bg-slate-50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300",
};

export function SkillsMarketplace() {
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<string>("ALL");
  const [category, setCategory] = useState<SkillCategory | "ALL">("ALL");
  const [difficulty, setDifficulty] = useState("ALL");
  const [detailSkill, setDetailSkill] = useState<AgentSkill | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    try {
      return (localStorage.getItem("skill-view-mode") as "grid" | "list") || "grid";
    } catch {
      return "grid";
    }
  });

  const handleToggleViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    try {
      localStorage.setItem("skill-view-mode", mode);
    } catch {}
  };

  const [installedIds, setInstalledIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem("skill-installed") || "[]"));
    } catch {
      return new Set();
    }
  });

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Scroll to top of grid on page change
  useEffect(() => {
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentPage]);

  const fetchPage = async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("pageSize", String(PAGE_SIZE));
      if (source !== "ALL") params.set("source", source);
      if (search.trim()) params.set("q", search.trim());
      if (category !== "ALL") params.set("category", category);
      if (difficulty !== "ALL") params.set("difficulty", difficulty);

      const res = await fetch(`/api/mcp/skills-feed?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setSkills(json.data);
        setTotalCount(json.pagination?.totalCount || json.total || json.data.length);
        setCurrentPage(targetPage);
      } else {
        throw new Error("Failed to load skills");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading skills");
    } finally {
      setLoading(false);
    }
  };

  // Fetch page 1 on filter changes
  useEffect(() => {
    const timer = setTimeout(() => fetchPage(1), 300);
    return () => clearTimeout(timer);
  }, [search, source, category, difficulty]);

  const [installing, setInstalling] = useState<string | null>(null);

  const handleInstall = async (skill: AgentSkill) => {
    const skillId = skill.id;
    const isAlreadyInstalled = installedIds.has(skillId);

    // Toggle off if already installed
    if (isAlreadyInstalled) {
      setInstalledIds((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        try { localStorage.setItem("skill-installed", JSON.stringify(Array.from(next))); } catch {}
        return next;
      });
      return;
    }

    // ── Deep install: auto-mount MCP server + create Skill with allowedTools ──
    try {
      setInstalling(skillId);

      // 1. If the skill requires MCP servers, auto-mount them
      if (skill.requiredServers && skill.requiredServers.length > 0) {
        for (const serverName of skill.requiredServers) {
          // Try to find an existing connected server by name
          const existingRes = await fetch("/api/mcp/servers").then((r) => r.json());
          const existingServers = existingRes.data || [];
          const alreadyConnected = existingServers.find((s: any) =>
            s.name.toLowerCase().includes(serverName.toLowerCase().replace(/ \(composio\)/gi, "")) &&
            s.status === "CONNECTED"
          );

          if (!alreadyConnected && skill.source === "composio") {
            // Auto-mount Composio toolkit
            const slug = serverName.toLowerCase().replace(/ \(composio\)/gi, "").replace(/ /g, "-");
            try {
              const sessionRes = await fetch("/api/mcp/composio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toolkits: [slug] }),
              }).then((r) => r.json());

              if (sessionRes.success && sessionRes.data?.mcpUrl) {
                await fetch("/api/mcp/servers", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: `${serverName} [Composio]`,
                    transport: "SSE",
                    endpointUrl: sessionRes.data.mcpUrl,
                    headers: sessionRes.data.mcpHeaders || {},
                    connectOnCreate: true,
                  }),
                });
              }
            } catch (err) {
              console.warn("[Marketplace] Failed to auto-mount Composio server:", err);
            }
          } else if (!alreadyConnected && skill.source !== "composio") {
            // For non-Composio skills, try the directory mount flow
            const dirRes = await fetch(`/api/mcp/directory?q=${encodeURIComponent(serverName)}&source=ALL`).then((r) => r.json());
            const match = (dirRes.data || []).find((s: any) =>
              s.name.toLowerCase().includes(serverName.toLowerCase())
            );
            if (match && match.endpointUrl) {
              await fetch("/api/mcp/servers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: match.name,
                  transport: match.transport || "SSE",
                  endpointUrl: match.endpointUrl,
                  command: match.command,
                  connectOnCreate: true,
                }),
              });
            }
          }
        }
      }

      // 2. Mark as installed in localStorage
      setInstalledIds((prev) => {
        const next = new Set(prev);
        next.add(skillId);
        try { localStorage.setItem("skill-installed", JSON.stringify(Array.from(next))); } catch {}
        return next;
      });

      setInstalling(null);
    } catch (err) {
      console.error("[Marketplace] Install failed:", err);
      setInstalling(null);
      // Still mark as installed so user can retry
      setInstalledIds((prev) => {
        const next = new Set(prev);
        next.add(skillId);
        try { localStorage.setItem("skill-installed", JSON.stringify(Array.from(next))); } catch {}
        return next;
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            SKILLS MARKETPLACE
          </h2>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
            Discover and install pre-configured agent skills from Glama, MCP.SO &amp; Smithery
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-slate-500 px-2 py-1 rounded border border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/40">
            {skills.length} OF {totalCount > 0 ? totalCount.toLocaleString() : skills.length} SKILLS LOADED
          </span>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-slate-100 dark:bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => handleToggleViewMode("grid")}
              className={clsx(
                "p-1.5 rounded text-xs font-mono transition-all cursor-pointer",
                viewMode === "grid"
                  ? "bg-white dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
              title="Card Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleToggleViewMode("list")}
              className={clsx(
                "p-1.5 rounded text-xs font-mono transition-all cursor-pointer",
                viewMode === "list"
                  ? "bg-white dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
              title="Row List View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills (e.g. research, database, github, slack)..."
            className="w-full pl-9 pr-8 py-2 text-xs font-mono rounded border border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-black/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Source Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[9px] font-mono text-slate-500 font-semibold">SOURCE:</span>
          {SOURCES.map((src) => {
            const active = source === src.id;
            return (
              <button
                key={src.id}
                type="button"
                onClick={() => setSource(src.id)}
                className={clsx(
                  "px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
                  active
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/40 text-slate-500 dark:text-slate-400 hover:border-indigo-400"
                )}
              >
                {src.label}
              </button>
            );
          })}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={clsx(
                  "inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
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

        {/* Difficulty Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-slate-500 font-semibold">LEVEL:</span>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDifficulty(d.id)}
              className={clsx(
                "px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
                difficulty === d.id
                  ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/40 text-slate-500 dark:text-slate-400 hover:border-indigo-400"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="ml-2 text-xs font-mono text-slate-500">Loading skills...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-xs font-mono text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Skills Grid / Row List */}
      {!loading && !error && (
        <>
          {viewMode === "grid" ? (
            /* ────────────── Grid / Card View ────────────── */
            <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map((skill) => {
                const isInstalled = installedIds.has(skill.id);
                const catColor = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.PRODUCTIVITY;
                const diffColor = DIFFICULTY_COLORS[skill.difficulty] || DIFFICULTY_COLORS.BEGINNER;
                const srcColor = SOURCE_COLORS[skill.source] || SOURCE_COLORS.glama;

                return (
                  <div
                    key={skill.id}
                    onClick={() => setDetailSkill(skill)}
                    className="group rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 hover:border-indigo-500/60 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all p-4 flex flex-col justify-between space-y-3 cursor-pointer"
                  >
                    {/* Top */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {skill.name}
                          </h3>
                          <p className="text-[9px] font-mono text-slate-500">
                            by <span className="font-semibold text-slate-700 dark:text-slate-300">{skill.author}</span>
                          </p>
                        </div>
                        {isInstalled && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50 shrink-0">
                            <Check className="h-2.5 w-2.5" /> INSTALLED
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {skill.description}
                      </p>

                      {/* Tags & Source */}
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", srcColor)}>
                          {skill.source === "smithery" ? "SMITHERY" : skill.source === "glama" ? "GLAMA" : skill.source === "mcp.so" ? "MCP.SO" : skill.source}
                        </span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", catColor)}>
                          {skill.category}
                        </span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", diffColor)}>
                          {skill.difficulty}
                        </span>
                        {skill.tags.slice(0, 2).map((t, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-slate-100 dark:bg-black/50 text-slate-500 border border-slate-200 dark:border-indigo-950">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-2 border-t border-slate-100 dark:border-indigo-950/60">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                          <Star className="h-3 w-3 fill-amber-400" /> {skill.rating}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Download className="h-3 w-3" /> {skill.installs.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" /> {skill.estimatedTime}
                        </span>
                      </div>
                      <span className="text-[8px] text-slate-400">{skill.steps.length} steps</span>
                    </div>

                    {/* Install Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInstall(skill);
                      }}
                      disabled={installing === skill.id}
                      className={clsx(
                        "w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer",
                        installing === skill.id ? "opacity-60 cursor-wait" : "",
                        isInstalled
                          ? "border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : "border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/25 active:scale-95"
                      )}
                    >
                      {isInstalled ? <><Check className="h-3 w-3" /> INSTALLED</> : <><Plus className="h-3 w-3" /> INSTALL SKILL</>}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ────────────── Row / List View ────────────── */
            <div ref={gridRef} className="space-y-2.5">
              {skills.map((skill) => {
                const isInstalled = installedIds.has(skill.id);
                const catColor = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.PRODUCTIVITY;
                const diffColor = DIFFICULTY_COLORS[skill.difficulty] || DIFFICULTY_COLORS.BEGINNER;
                const srcColor = SOURCE_COLORS[skill.source] || SOURCE_COLORS.glama;

                return (
                  <div
                    key={skill.id}
                    onClick={() => setDetailSkill(skill)}
                    className="group rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 hover:border-indigo-500/60 dark:hover:border-indigo-500/50 hover:shadow-md transition-all p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 cursor-pointer"
                  >
                    {/* Left: Info, Badges, Description */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {skill.name}
                        </h3>
                        <span className="text-[9px] font-mono text-slate-500">
                          by <span className="font-semibold text-slate-700 dark:text-slate-300">{skill.author}</span>
                        </span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", srcColor)}>
                          {skill.source === "smithery" ? "SMITHERY" : skill.source === "glama" ? "GLAMA" : skill.source === "mcp.so" ? "MCP.SO" : skill.source}
                        </span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", catColor)}>
                          {skill.category}
                        </span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", diffColor)}>
                          {skill.difficulty}
                        </span>
                        {isInstalled && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50 shrink-0">
                            <Check className="h-2.5 w-2.5" /> INSTALLED
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 line-clamp-1 leading-relaxed">
                        {skill.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 text-[8px] font-mono text-slate-400">
                        {skill.tags.slice(0, 3).map((t, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-black/50 text-slate-500 border border-slate-200 dark:border-indigo-950">
                            #{t}
                          </span>
                        ))}
                        <span>•</span>
                        <span>{skill.steps.length} workflow steps</span>
                      </div>
                    </div>

                    {/* Right: Stats & Action */}
                    <div className="flex items-center justify-between md:justify-end gap-3.5 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-indigo-950/60">
                      <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500">
                        <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                          <Star className="h-3 w-3 fill-amber-400" /> {skill.rating}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Download className="h-3 w-3" /> {skill.installs.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" /> {skill.estimatedTime}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstall(skill);
                        }}
                        disabled={installing === skill.id}
                        className={clsx(
                          "inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer shrink-0 min-w-[90px]",
                          installing === skill.id ? "opacity-60 cursor-wait" : "",
                          isInstalled
                            ? "border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                            : "border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/25 active:scale-95"
                        )}
                      >
                        {isInstalled ? <><Check className="h-3 w-3" /> INSTALLED</> : <><Plus className="h-3 w-3" /> INSTALL</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-6 pb-2">
              {/* Previous */}
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(currentPage - 1);
                  fetchPage(currentPage - 1);
                }}
                disabled={currentPage === 1 || loading}
                className="inline-flex items-center justify-center h-8 w-8 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {/* Page Numbers */}
              {(() => {
                const maxVisible = 7;
                let pages: (number | "...")[];
                if (totalPages <= maxVisible) {
                  pages = Array.from({ length: totalPages }, (_, i) => i + 1);
                } else {
                  pages = [];
                  const left = Math.max(2, currentPage - 1);
                  const right = Math.min(totalPages - 1, currentPage + 1);
                  pages.push(1);
                  if (left > 2) pages.push("...");
                  for (let i = left; i <= right; i++) pages.push(i);
                  if (right < totalPages - 1) pages.push("...");
                  pages.push(totalPages);
                }
                return pages.map((p, i) =>
                  p === "..." ? (
                    <span key={`e${i}`} className="px-1.5 text-[10px] font-mono text-slate-400 dark:text-slate-600 select-none">
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setCurrentPage(p);
                        fetchPage(p);
                      }}
                      disabled={loading}
                      className={clsx(
                        "inline-flex items-center justify-center h-8 min-w-[32px] px-2 rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-50",
                        currentPage === p
                          ? "border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                          : "border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                      )}
                    >
                      {p}
                    </button>
                  )
                );
              })()}

              {/* Next */}
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(currentPage + 1);
                  fetchPage(currentPage + 1);
                }}
                disabled={currentPage === totalPages || loading}
                className="inline-flex items-center justify-center h-8 w-8 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>

              {/* Page Info */}
              <span className="ml-3 text-[10px] font-mono text-slate-500">
                {currentPage} / {totalPages}
              </span>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && !error && skills.length === 0 && (
        <div className="text-center py-12">
          <Sparkles className="h-8 w-8 text-indigo-400 mx-auto" />
          <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 mt-3">NO SKILLS FOUND</p>
          <p className="text-[10px] font-mono text-slate-500 mt-1">
            No skills matching &quot;{search}&quot; in this category.
          </p>
        </div>
      )}

      {/* Skill Detail Modal */}
      {detailSkill && (
        <SkillDetailModal
          skill={detailSkill}
          isInstalled={installedIds.has(detailSkill.id)}
          onInstall={() => handleInstall(detailSkill)}
          onClose={() => setDetailSkill(null)}
        />
      )}
    </div>
  );
}

/* ────────────── Skill Detail Modal ────────────── */

function SkillDetailModal({
  skill,
  isInstalled,
  onInstall,
  onClose,
}: {
  skill: AgentSkill;
  isInstalled: boolean;
  onInstall: () => void;
  onClose: () => void;
}) {
  const catColor = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.PRODUCTIVITY;
  const diffColor = DIFFICULTY_COLORS[skill.difficulty] || DIFFICULTY_COLORS.BEGINNER;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-indigo-800/60 bg-white dark:bg-[#0a0a0a] shadow-2xl shadow-indigo-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-indigo-950 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm rounded-t-xl">
          <div className="min-w-0">
            <h3 className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
              {skill.name}
            </h3>
            <p className="text-[10px] font-mono text-slate-500">
              by <span className="font-semibold text-slate-700 dark:text-slate-300">{skill.author}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-indigo-950/60 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* Description */}
          <div className="space-y-1.5">
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold">DESCRIPTION</div>
            <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 leading-relaxed">
              {skill.description}
            </p>
          </div>

          {/* Tags & Stats */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx("px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border", SOURCE_COLORS[skill.source] || SOURCE_COLORS.glama)}>
              {skill.source === "smithery" ? "SMITHERY.AI" : skill.source === "glama" ? "GLAMA.AI" : skill.source === "mcp.so" ? "MCP.SO" : skill.source}
            </span>
            <span className={clsx("px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border", catColor)}>
              {skill.category}
            </span>
            <span className={clsx("px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border", diffColor)}>
              {skill.difficulty}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-semibold border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
              <Star className="h-3 w-3 fill-amber-400" /> {skill.rating}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-semibold border border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-400">
              <Download className="h-3 w-3" /> {skill.installs.toLocaleString()} installs
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-semibold border border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-400">
              <Clock className="h-3 w-3" /> {skill.estimatedTime}
            </span>
          </div>

          {/* Required Servers */}
          {skill.requiredServers.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
                <Shield className="h-3 w-3" /> REQUIRED MCP SERVERS
              </div>
              <div className="flex flex-wrap gap-1.5">
                {skill.requiredServers.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-2">
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> SKILL STEPS ({skill.steps.length})
            </div>
            <div className="space-y-2">
              {skill.steps.map((step) => (
                <div
                  key={step.order}
                  className="flex items-start gap-3 p-2.5 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/60 dark:bg-black/40"
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[9px] font-mono font-bold shrink-0">
                    {step.order}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {step.description}
                    </p>
                    {step.requiredTool && (
                      <p className="text-[8px] font-mono text-slate-500 mt-0.5">
                        Tool: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{step.requiredTool}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Source */}
          <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500">
            <span className="uppercase">Source:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{skill.source}</span>
            {skill.sourceUrl && (
              <a href={skill.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">
                View <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
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
            onClick={onInstall}
            className={clsx(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded border text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer",
              isInstalled
                ? "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : "border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/25 active:scale-95"
            )}
          >
            {isInstalled ? <><Check className="h-3 w-3" /> INSTALLED</> : <><Plus className="h-3 w-3" /> INSTALL SKILL</>}
          </button>
        </div>
      </div>
    </div>
  );
}
