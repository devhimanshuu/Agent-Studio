"use client";

import React from "react";
import Link from "next/link";
import {
  Network,
  GitBranch,
  Play,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import { AgentGraphCardDTO } from "@/types/dashboard";
import { CANVAS_TEMPLATES } from "@/components/canvas/AgentGraphTemplates";

interface MultiAgentCanvasShowcaseProps {
  agentGraphs: AgentGraphCardDTO[];
}

export function MultiAgentCanvasShowcase({ agentGraphs }: MultiAgentCanvasShowcaseProps) {
  return (
    <div className="space-y-4 font-mono">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
            MULTI-AGENT CANVAS ARCHITECTURES
          </h3>
        </div>
        <Link
          href="/dashboard/canvas"
          className="text-[11px] text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-semibold flex items-center gap-1"
        >
          [ ALL GRAPHS ({agentGraphs.length}) ] <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Blueprints / Starters Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CANVAS_TEMPLATES.slice(0, 3).map((bp) => (
          <div
            key={bp.id}
            className="p-3.5 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/70 dark:bg-[#070709]/70 space-y-2 hover:border-violet-400 dark:hover:border-violet-500/50 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-bold uppercase">
                  {bp.badge}
                </span>
                <span className="text-[9px] text-slate-400 font-sans">{bp.category}</span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {bp.name}
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans line-clamp-2 leading-relaxed">
                {bp.description}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-indigo-950/50 text-[10px]">
              <span className="text-slate-400 flex items-center gap-1">
                <GitBranch className="h-3 w-3 text-indigo-400" /> {bp.graph.nodes.length} Nodes
              </span>
              <Link
                href={`/dashboard/canvas/new?template=${bp.id}`}
                className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 font-bold"
              >
                OPEN BLUEPRINT <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* User's custom agent graphs if any */}
      {agentGraphs.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            YOUR ACTIVE MULTI-AGENT GRAPHS:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agentGraphs.slice(0, 3).map((graph) => (
              <div
                key={graph.id}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2.5 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {graph.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold">
                      v{graph.versionNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans line-clamp-2">
                    {graph.purpose}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3 text-indigo-400" /> {graph.nodeCount} Nodes
                    </span>
                    <span className="flex items-center gap-1">
                      <Network className="h-3 w-3 text-indigo-400" /> {graph.edgeCount} Edges
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between">
                  <Link
                    href={`/dashboard/canvas/${graph.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-indigo-400 bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-500 transition-all shadow-sm"
                  >
                    <Play className="h-3 w-3" /> LAUNCH CANVAS
                  </Link>
                  <Link
                    href={`/dashboard/skills/${graph.id}`}
                    className="text-[10px] text-indigo-700 dark:text-indigo-400 hover:underline"
                  >
                    [ CONFIG ]
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
