"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Play, GitBranch, Clock, Zap, ArrowUpRight } from "lucide-react";
import { executionsApi } from "@/lib/api/executions";
import { ExecutionStatusBadge } from "@/components/executions/ExecutionStatusBadge";
import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ExecutionDTO } from "@/types/execution";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 10)}…` : id;
}

export default function ExecutionsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["executions"],
    queryFn: () => executionsApi.list(),
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-950/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">
            EXECUTION HISTORY & TRACES
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Graph-first agent runs: planner output, node timeline, tool calls, and outcomes.
          </p>
        </div>
        <Link
          href="/dashboard/skills"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all text-xs font-mono"
        >
          <Play className="h-4 w-4" />
          RUN A SKILL
        </Link>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <EmptyState
          title="Failed to load executions"
          description="There was an error fetching your executions. Please try again."
          action={
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 cursor-pointer"
            >
              [ RETRY ]
            </button>
          }
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Play className="h-6 w-6" />}
          title="No executions yet"
          description="Run a skill to see its plan, node-by-node timeline, tool calls, and final output here."
          action={
            <Link
              href="/dashboard/skills"
              className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all"
            >
              [ BROWSE SKILLS ]
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.map((execution: ExecutionDTO) => (
            <Link
              key={execution.id}
              href={`/dashboard/executions/${execution.id}`}
              className="block rounded border border-indigo-900/50 bg-[#0a0a0a]/80 p-4 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-mono font-semibold text-slate-100">{shortId(execution.id)}</span>
                  <ExecutionStatusBadge status={execution.status} />
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-indigo-400/70" />
                    {formatDate(execution.startedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-indigo-400/70" />
                    {execution.durationMs != null ? `${(execution.durationMs / 1000).toFixed(1)}s` : "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3 text-indigo-400/70" />
                    v{shortId(execution.skillVersionId)}
                  </span>
                  <span className="flex items-center gap-1">
                    {execution.provider ? execution.provider : "no provider"}
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-indigo-400" />
                </div>
              </div>
              {execution.errorMessage && (
                <p className="mt-2 text-[11px] font-mono text-red-400/90 truncate">
                  [ ERROR ] {execution.errorMessage}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
