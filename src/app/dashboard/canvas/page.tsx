"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Workflow, ArrowRight, ArrowUpRight, GitBranch, Play, Zap, Network } from "lucide-react";
import { skillsApi } from "@/lib/api/skills";
import { CANVAS_TEMPLATES } from "@/components/canvas/AgentGraphTemplates";
import { SkeletonGrid } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";

export default function CanvasGalleryPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["skills"],
    queryFn: () => skillsApi.list({}),
  });

  const allSkills = data?.items ?? [];
  const graphSkills = allSkills.filter((s) => {
    const version = s.publishedVersion ?? s.currentDraft;
    return Boolean(version?.graphDefinition && version.graphDefinition.nodes.length > 0);
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-lg sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">AGENT CANVAS</h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
            Design multi-agent architectures visually — supervisors, routers, HITL gates, loops & parallel map-reduce.
          </p>
        </div>
        <Link
          href="/dashboard/canvas/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all text-xs font-mono cursor-pointer w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          NEW AGENT GRAPH
        </Link>
      </div>

      {/* Templates */}
      <div className="space-y-3 font-mono">
        <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest font-semibold">
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            MULTI-AGENT BLUEPRINTS
          </span>
          <span className="text-[10px] text-slate-500">1-CLICK STARTERS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CANVAS_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] px-2 py-0.5 rounded border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-bold">
                    {tmpl.badge}
                  </span>
                  <span className="text-[9px] text-slate-500 uppercase">{tmpl.category}</span>
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">{tmpl.name}</h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed line-clamp-3">
                  {tmpl.description}
                </p>
                <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono pt-1">
                  <span className="inline-flex items-center gap-1">
                    <GitBranch className="h-3 w-3 text-indigo-500" /> {tmpl.graph.nodes.length} nodes
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Network className="h-3 w-3 text-indigo-500" /> {tmpl.graph.edges.length} edges
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60">
                <Link
                  href={`/dashboard/canvas/new?template=${tmpl.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                >
                  OPEN BLUEPRINT <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* My graphs */}
      <div className="space-y-3 font-mono">
        <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest font-semibold">
          <span className="flex items-center gap-1.5">
            <Workflow className="h-3.5 w-3.5 text-indigo-500" />
            MY AGENT GRAPHS ({graphSkills.length})
          </span>
        </div>

        {isLoading ? (
          <SkeletonGrid cards={3} />
        ) : isError ? (
          <EmptyState title="Failed to load graphs" description="There was an error fetching your agent graphs." />
        ) : graphSkills.length === 0 ? (
          <EmptyState
            icon={<Network className="h-6 w-6" />}
            title="No agent graphs yet"
            description="Start from a blueprint above or design your own multi-agent architecture on a blank canvas."
            action={
              <Link
                href="/dashboard/canvas/new"
                className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all cursor-pointer"
              >
                [ CREATE GRAPH ]
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
            {graphSkills.map((skill) => {
              const version = skill.publishedVersion ?? skill.currentDraft;
              const graph = version?.graphDefinition;
              const nodeTypes = new Set(graph?.nodes.map((n) => n.type) ?? []);
              return (
                <div
                  key={skill.id}
                  className="rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-[#0a0a0a]/90 p-5 space-y-4 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col justify-between shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{skill.name}</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-serif line-clamp-2 leading-relaxed">
                          {skill.purpose}
                        </p>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold border border-violet-200 dark:border-violet-500/40 shrink-0">
                        GRAPH
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Array.from(nodeTypes).map((t) => (
                        <span
                          key={t}
                          className="text-[8px] px-1.5 py-0.5 rounded border border-slate-300 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-400 font-mono uppercase"
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <GitBranch className="h-3 w-3 text-indigo-600 dark:text-indigo-400/70" />
                        {graph?.nodes.length ?? 0} nodes
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Network className="h-3 w-3 text-indigo-600 dark:text-indigo-400/70" />
                        {graph?.edges.length ?? 0} edges
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        v{version?.versionNumber ?? 1}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-indigo-950/60">
                    <Link
                      href={`/dashboard/canvas/${skill.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-indigo-400/80 bg-indigo-600 text-white text-xs hover:bg-indigo-500 font-bold shadow-sm transition-all"
                    >
                      <Play className="h-3 w-3" /> [ OPEN + RUN ]
                    </Link>
                    <Link
                      href={`/dashboard/skills/${skill.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-indigo-900/60 bg-slate-50 dark:bg-indigo-950/30 text-xs text-slate-700 dark:text-slate-300 hover:border-indigo-400 transition-all"
                      title="Open in classic skill editor"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
