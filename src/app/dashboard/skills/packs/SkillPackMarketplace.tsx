"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Layers,
  Container,
  Database,
  TrendingUp,
  Brain,
  Shield,
  Zap,
  Loader2,
  Check,
  ChevronDown,
  ChevronRight,
  Server,
  FileCode2,
  Clock,
  Star,
  ArrowRight,
  Package,
  AlertTriangle,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/stores/toastStore";
import { SkillPack, PackCategory, PackInstallationState } from "@/types/skillPacks";
import { SKILL_PACKS, PACK_CATEGORIES } from "@/data/skillPacks";

/** Persistent map of installed pack IDs */
const INSTALLED_PACKS_KEY = "skill-installed-packs";

function loadInstalledPacks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(INSTALLED_PACKS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveInstalledPacks(set: Set<string>) {
  try {
    localStorage.setItem(INSTALLED_PACKS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

// ────────────── Icon Map ──────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Layers,
  Container,
  Database,
  TrendingUp,
  Brain,
  Shield,
  Zap,
  Package,
};

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; accent: string; gradient: string }> = {
  indigo: {
    border: "border-indigo-300 dark:border-indigo-500/40",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    accent: "bg-indigo-600",
    gradient: "from-indigo-600 to-indigo-800",
  },
  emerald: {
    border: "border-emerald-300 dark:border-emerald-500/40",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    accent: "bg-emerald-600",
    gradient: "from-emerald-600 to-emerald-800",
  },
  pink: {
    border: "border-pink-300 dark:border-pink-500/40",
    bg: "bg-pink-50 dark:bg-pink-950/40",
    text: "text-pink-700 dark:text-pink-300",
    accent: "bg-pink-600",
    gradient: "from-pink-600 to-pink-800",
  },
  violet: {
    border: "border-violet-300 dark:border-violet-500/40",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-300",
    accent: "bg-violet-600",
    gradient: "from-violet-600 to-violet-800",
  },
  red: {
    border: "border-red-300 dark:border-red-500/40",
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    accent: "bg-red-600",
    gradient: "from-red-600 to-red-800",
  },
  amber: {
    border: "border-amber-300 dark:border-amber-500/40",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    accent: "bg-amber-600",
    gradient: "from-amber-600 to-amber-800",
  },
  slate: {
    border: "border-slate-300 dark:border-slate-500/40",
    bg: "bg-slate-50 dark:bg-slate-950/40",
    text: "text-slate-700 dark:text-slate-300",
    accent: "bg-slate-600",
    gradient: "from-slate-600 to-slate-800",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  SCM: "border-blue-300 bg-blue-50 text-blue-700",
  CLOUD: "border-cyan-300 bg-cyan-50 text-cyan-700",
  DATABASE: "border-emerald-300 bg-emerald-50 text-emerald-700",
  MESSAGING: "border-pink-300 bg-pink-50 text-pink-700",
  MONITORING: "border-amber-300 bg-amber-50 text-amber-700",
  ANALYTICS: "border-indigo-300 bg-indigo-50 text-indigo-700",
  CRM: "border-violet-300 bg-violet-50 text-violet-700",
  MARKETING: "border-rose-300 bg-rose-50 text-rose-700",
  AI: "border-purple-300 bg-purple-50 text-purple-700",
  INFRASTRUCTURE: "border-slate-300 bg-slate-50 text-slate-700",
  COLLABORATION: "border-teal-300 bg-teal-50 text-teal-700",
};

export function SkillPackMarketplace() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<PackCategory | "all">("all");
  const [detailPack, setDetailPack] = useState<SkillPack | null>(null);
  const [installedPacks, setInstalledPacks] = useState<Set<string>>(loadInstalledPacks);
  const [installingPack, setInstallingPack] = useState<string | null>(null);
  const [installState, setInstallState] = useState<PackInstallationState | null>(null);

  const filteredPacks = useMemo(() => {
    if (selectedCategory === "all") return SKILL_PACKS;
    return SKILL_PACKS.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  const handleInstall = useCallback(
    async (pack: SkillPack) => {
      if (installedPacks.has(pack.id)) return;

      try {
        setInstallingPack(pack.id);
        setInstallState(null);

        const res = await fetch("/api/skills/packs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packId: pack.id }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }

        const json = await res.json();
        if (!json.success || !json.data) {
          throw new Error("Pack installation failed");
        }

        const state: PackInstallationState = json.data;
        setInstallState(state);

        // Persist installed pack
        setInstalledPacks((prev) => {
          const next = new Set(prev);
          next.add(pack.id);
          saveInstalledPacks(next);
          return next;
        });

        // Invalidate queries so Studio tab updates
        queryClient.invalidateQueries({ queryKey: ["skills"] });

        if (state.status === "completed") {
          toast.success(
            "Pack installed!",
            `${pack.name}: ${state.serversInstalled} servers + ${state.skillsInstalled} skills`
          );
        } else if (state.status === "partial") {
          toast.success(
            "Pack partially installed",
            `${pack.name}: ${state.serversInstalled}/${state.serversTotal} servers, ${state.skillsInstalled}/${state.skillsTotal} skills. ${state.errors.length} errors.`
          );
        } else {
          toast.error("Pack installation failed", state.errors.join("; "));
        }
      } catch (err) {
        console.error("[PackInstall] Failed:", err);
        toast.error("Install failed", err instanceof Error ? err.message : "Unknown error");
      } finally {
        setInstallingPack(null);
      }
    },
    [installedPacks, queryClient]
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-500" />
            SKILL PACKS
          </h2>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
            1-click solution stacks — pre-configured MCP servers + workflow skills
          </p>
        </div>
        <span className="text-[9px] font-mono text-slate-500 px-2 py-1 rounded border border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/40">
          {SKILL_PACKS.length} PACKS · {SKILL_PACKS.reduce((a, p) => a + p.serverCount, 0)} SERVERS · {SKILL_PACKS.reduce((a, p) => a + p.skillCount, 0)} SKILLS
        </span>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PACK_CATEGORIES.map((cat) => {
          const Icon = ICON_MAP[cat.icon] || Layers;
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
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

      {/* Pack Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPacks.map((pack) => {
          const colors = COLOR_MAP[pack.color] || COLOR_MAP.slate;
          const isInstalled = installedPacks.has(pack.id);
          const isInstalling = installingPack === pack.id;

          return (
            <div
              key={pack.id}
              className={clsx(
                "group rounded-lg border bg-white/80 dark:bg-[#0a0a0a]/70 hover:shadow-lg transition-all flex flex-col cursor-pointer overflow-hidden",
                isInstalled
                  ? "border-emerald-300 dark:border-emerald-500/30"
                  : "border-slate-200 dark:border-indigo-900/40 hover:border-indigo-500/60 dark:hover:border-indigo-500/50"
              )}
              onClick={() => setDetailPack(pack)}
            >
              {/* Pack Header Gradient */}
              <div className={clsx("px-4 py-3 bg-gradient-to-r", colors.gradient)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const PackIcon = ICON_MAP[pack.icon] || Layers;
                      return <PackIcon className="h-5 w-5 text-white" />;
                    })()}
                    <div>
                      <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                        {pack.name}
                      </h3>
                      <p className="text-[9px] font-mono text-white/70">{pack.tagline}</p>
                    </div>
                  </div>
                  {isInstalled && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[8px] font-mono font-bold bg-white/20 text-white border border-white/30">
                      <Check className="h-2.5 w-2.5" /> INSTALLED
                    </span>
                  )}
                </div>
              </div>

              {/* Pack Body */}
              <div className="px-4 py-3 space-y-3 flex-1">
                <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {pack.description}
                </p>

                {/* Server Badges */}
                <div className="space-y-1.5">
                  <div className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                    MCP Servers ({pack.serverCount})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pack.servers.map((s, i) => (
                      <span
                        key={i}
                        className={clsx(
                          "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border",
                          CATEGORY_COLORS[s.category] || "border-slate-200 bg-slate-50 text-slate-600"
                        )}
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Skill Badges */}
                <div className="space-y-1.5">
                  <div className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                    Workflow Skills ({pack.skillCount})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pack.skills.map((s, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50"
                      >
                        <FileCode2 className="inline h-2 w-2 mr-0.5" />
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-[9px] font-mono text-slate-400 pt-2 border-t border-slate-100 dark:border-indigo-950/60">
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" /> {pack.estimatedSetupTime}
                  </span>
                  <span className={clsx(
                    "px-1.5 py-0.5 rounded text-[8px] font-bold border",
                    pack.difficulty === "BEGINNER"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : pack.difficulty === "INTERMEDIATE"
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-red-300 bg-red-50 text-red-700"
                  )}>
                    {pack.difficulty}
                  </span>
                  {pack.isNew && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-300">
                      NEW
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> {pack.popularity}
                  </span>
                </div>
              </div>

              {/* Install Button */}
              <div className="px-4 pb-3">
                {isInstalled ? (
                  <div className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                    <Check className="h-3 w-3" /> INSTALLED
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstall(pack);
                    }}
                    disabled={isInstalling}
                    className={clsx(
                      "w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer",
                      isInstalling ? "opacity-60 cursor-wait" : "",
                      "border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/25 active:scale-95"
                    )}
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> INSTALLING...
                      </>
                    ) : (
                      <>
                        <Package className="h-3 w-3" /> INSTALL PACK
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredPacks.length === 0 && (
        <div className="text-center py-12">
          <Layers className="h-8 w-8 text-indigo-400 mx-auto" />
          <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 mt-3">
            NO PACKS IN THIS CATEGORY
          </p>
        </div>
      )}

      {/* Pack Detail Modal */}
      {detailPack && (
        <PackDetailModal
          pack={detailPack}
          isInstalled={installedPacks.has(detailPack.id)}
          isInstalling={installingPack === detailPack.id}
          installState={installState}
          onInstall={() => handleInstall(detailPack)}
          onClose={() => {
            setDetailPack(null);
            setInstallState(null);
          }}
        />
      )}
    </div>
  );
}

/* ────────────── Pack Detail Modal ────────────── */

function PackDetailModal({
  pack,
  isInstalled,
  isInstalling,
  installState,
  onInstall,
  onClose,
}: {
  pack: SkillPack;
  isInstalled: boolean;
  isInstalling: boolean;
  installState: PackInstallationState | null;
  onInstall: () => void;
  onClose: () => void;
}) {
  const [expandedServer, setExpandedServer] = useState<number | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<number | null>(null);
  const colors = COLOR_MAP[pack.color] || COLOR_MAP.slate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-indigo-800/60 bg-white dark:bg-[#0a0a0a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={clsx("px-6 py-5 bg-gradient-to-r rounded-t-xl", colors.gradient)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(() => {
                const PackIcon = ICON_MAP[pack.icon] || Layers;
                return <PackIcon className="h-6 w-6 text-white" />;
              })()}
              <div>
                <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                  {pack.name}
                </h2>
                <p className="text-[10px] font-mono text-white/70">{pack.tagline}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Description */}
          <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 leading-relaxed">
            {pack.description}
          </p>

          {/* Meta Row */}
          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {pack.estimatedSetupTime} setup
            </span>
            <span className={clsx(
              "px-2 py-0.5 rounded border font-bold",
              pack.difficulty === "BEGINNER"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : pack.difficulty === "INTERMEDIATE"
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-red-300 bg-red-50 text-red-700"
            )}>
              {pack.difficulty}
            </span>
            <span>{pack.serverCount} servers</span>
            <span>{pack.skillCount} skills</span>
          </div>

          {/* Installation Progress */}
          {installState && (
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                {installState.status === "completed" ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : installState.status === "partial" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : installState.status === "failed" ? (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                )}
                <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 uppercase">
                  {installState.status === "completed"
                    ? "All Done!"
                    : installState.status === "partial"
                    ? "Partially Installed"
                    : installState.status === "failed"
                    ? "Installation Failed"
                    : "Installing..."}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                <div>
                  <span className="text-slate-500">Servers: </span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {installState.serversInstalled}/{installState.serversTotal}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Skills: </span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {installState.skillsInstalled}/{installState.skillsTotal}
                  </span>
                </div>
              </div>
              {installState.errors.length > 0 && (
                <div className="space-y-1">
                  {installState.errors.map((err, i) => (
                    <p key={i} className="text-[9px] font-mono text-red-600 dark:text-red-400">
                      ⚠ {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Servers Section */}
          <div className="space-y-2">
            <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Server className="h-3 w-3" />
              MCP Servers ({pack.servers.length})
            </div>
            <div className="space-y-2">
              {pack.servers.map((server, idx) => {
                const isExpanded = expandedServer === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 dark:border-indigo-900/30 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedServer(isExpanded ? null : idx)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-black/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        )}
                        <span className="text-[11px] font-mono font-bold text-slate-900 dark:text-slate-100">
                          {server.name}
                        </span>
                        <span
                          className={clsx(
                            "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border",
                            CATEGORY_COLORS[server.category] || "border-slate-200 bg-slate-50 text-slate-600"
                          )}
                        >
                          {server.category}
                        </span>
                        <span className="text-[8px] font-mono text-slate-400 uppercase">
                          via {server.directorySource || "composio"}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t border-slate-100 dark:border-indigo-950/30">
                        <p className="text-[10px] font-mono text-slate-500 mt-2">
                          {server.description}
                        </p>
                        <p className="text-[9px] font-mono text-slate-400 mt-1">
                          Search: &quot;{server.searchQuery}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Skills Section */}
          <div className="space-y-2">
            <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <FileCode2 className="h-3 w-3" />
              Workflow Skills ({pack.skills.length})
            </div>
            <div className="space-y-2">
              {pack.skills.map((skill, idx) => {
                const isExpanded = expandedSkill === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 dark:border-indigo-900/30 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedSkill(isExpanded ? null : idx)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-black/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        )}
                        <FileCode2 className="h-3 w-3 text-indigo-500" />
                        <span className="text-[11px] font-mono font-bold text-slate-900 dark:text-slate-100">
                          {skill.name}
                        </span>
                        <span className="text-[8px] font-mono text-slate-400">
                          {skill.steps.length} steps
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t border-slate-100 dark:border-indigo-950/30 space-y-2 mt-2">
                        <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400">
                          {skill.purpose}
                        </p>
                        <div className="space-y-1">
                          {skill.steps.map((step, si) => (
                            <div key={si} className="flex items-center gap-2 text-[9px] font-mono text-slate-500">
                              <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[8px] font-bold shrink-0">
                                {step.order}
                              </span>
                              <span className="text-slate-700 dark:text-slate-300 font-semibold">{step.action}</span>
                              <span className="text-slate-400">— {step.description}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {skill.allowedToolPatterns.map((pattern, pi) => (
                            <span
                              key={pi}
                              className="px-1.5 py-0.5 rounded text-[7px] font-mono bg-slate-100 dark:bg-black/50 text-slate-500 border border-slate-200 dark:border-indigo-950"
                            >
                              {pattern}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-indigo-900/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:border-slate-400 transition-colors cursor-pointer"
          >
            CLOSE
          </button>
          {isInstalled ? (
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
              <Check className="h-3 w-3" /> INSTALLED
            </div>
          ) : (
            <button
              type="button"
              onClick={onInstall}
              disabled={isInstalling}
              className={clsx(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer",
                isInstalling ? "opacity-50 cursor-wait" : "",
                "border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/25 active:scale-95"
              )}
            >
              {isInstalling ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> INSTALLING...
                </>
              ) : (
                <>
                  <Package className="h-3 w-3" /> INSTALL PACK
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
