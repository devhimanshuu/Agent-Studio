"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Gauge,
  Timer,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Wrench,
  Shield,
  ArrowUpRight,
  Play,
  Search,
} from "lucide-react";
import { executionsApi } from "@/lib/api/executions";
import { ExecutionStatusBadge } from "@/components/executions/ExecutionStatusBadge";
import { SkeletonTable } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ExecutionDTO } from "@/types/execution";

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 10)}…` : id;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function HistoryPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["metrics"],
    queryFn: () => executionsApi.metrics(),
  });

  const { data: executions, isLoading: execLoading } = useQuery({
    queryKey: ["executions", "history", debounced],
    queryFn: () => executionsApi.list({ search: debounced || undefined, limit: 50 }),
  });

  const widgets: { label: string; value: string; sub: string; icon: React.ReactNode; tone: string }[] = [
    {
      label: "TOTAL EXECUTIONS",
      value: metrics ? String(metrics.totalExecutions) : "—",
      sub: "All agent runs",
      icon: <Activity className="h-4 w-4" />,
      tone: "text-indigo-700 dark:text-indigo-400",
    },
    {
      label: "SUCCESS RATE",
      value: metrics ? `${metrics.successRate}%` : "—",
      sub: `${metrics?.failureRate ?? 0}% failure rate`,
      icon: metrics && metrics.successRate >= 70 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
      tone: "text-emerald-700 dark:text-emerald-400",
    },
    {
      label: "AVG EXECUTION TIME",
      value: metrics ? `${(metrics.avgExecutionTimeMs / 1000).toFixed(2)}s` : "—",
      sub: "Wall-clock duration",
      icon: <Timer className="h-4 w-4" />,
      tone: "text-cyan-700 dark:text-cyan-400",
    },
    {
      label: "APPROVAL COUNT",
      value: metrics ? String(metrics.approvalCount) : "—",
      sub: `${metrics?.pendingApprovalCount ?? 0} pending review`,
      icon: <Shield className="h-4 w-4" />,
      tone: "text-amber-700 dark:text-amber-400",
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide flex items-center gap-3">
            <Gauge className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            OBSERVABILITY
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
            Execution metrics, history, and performance trends for your agent runs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/executions"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-xs font-mono text-indigo-700 dark:text-indigo-200 hover:border-indigo-400 font-semibold transition-all shadow-sm cursor-pointer"
          >
            FULL TRACES <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Metrics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {widgets.map((w, i) => (
          <div
            key={w.label}
            className="p-5 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:-translate-y-0.5 shadow-sm hover:shadow-xl transition-all duration-300"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`flex items-center justify-between text-xs tracking-wider uppercase font-semibold ${w.tone}`}>
              <span>{w.label}</span>
              {w.icon}
            </div>
            <div className="text-3xl font-pixel text-slate-900 dark:text-slate-100">{w.value}</div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">{w.sub}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
          {Object.entries(metrics.executionsByStatus).map(([status, count]) => (
            <div key={status} className="rounded border border-slate-200 dark:border-indigo-950/60 bg-white/80 dark:bg-black/40 px-3 py-2.5 flex items-center justify-between shadow-sm">
              <span className="text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-medium">{status}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-200 font-mono">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Most used skills + tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 font-mono">
        <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-5 space-y-3 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1.5 border-b border-slate-200 dark:border-indigo-950/60 pb-2 font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> MOST USED SKILLS
          </div>
          {!metrics?.mostUsedSkills || metrics.mostUsedSkills.length === 0 ? (
            <p className="text-[11px] text-slate-500">No executions yet.</p>
          ) : (
            <ul className="space-y-2">
              {metrics.mostUsedSkills.map((s) => (
                <li key={s.skillName} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-900 dark:text-slate-300 truncate font-medium">{s.skillName}</span>
                  <span className="px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/40 text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold">
                    {s.count} runs
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-5 space-y-3 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest text-cyan-700 dark:text-cyan-400/80 flex items-center gap-1.5 border-b border-slate-200 dark:border-indigo-950/60 pb-2 font-semibold">
            <Wrench className="h-3.5 w-3.5" /> MOST USED TOOLS
          </div>
          {!metrics?.mostUsedTools || metrics.mostUsedTools.length === 0 ? (
            <p className="text-[11px] text-slate-500">No tool calls yet.</p>
          ) : (
            <ul className="space-y-2">
              {metrics.mostUsedTools.map((t) => (
                <li key={t.toolName} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-900 dark:text-slate-300 truncate font-medium">{t.toolName}</span>
                  <span className="px-2 py-0.5 rounded border border-cyan-300 dark:border-cyan-900/50 bg-cyan-50 dark:bg-cyan-950/40 text-[10px] text-cyan-700 dark:text-cyan-300 font-semibold">
                    {t.count} calls
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent executions table */}
      <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-indigo-950/60 pb-3">
          <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1.5 font-semibold">
            <Play className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> RECENT EXECUTIONS
          </div>
          <label className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-indigo-600 dark:text-indigo-400/70" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search executions…"
              className="rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-black/50 pl-8 pr-3 py-1.5 text-[11px] text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
            />
          </label>
        </div>

        {execLoading ? (
          <SkeletonTable cols={6} rows={7} />
        ) : !executions || executions.length === 0 ? (
          <EmptyState
            icon={<Play className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
            title="No executions found"
            description="Run a skill to start collecting execution history and metrics."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono">
              <thead>
                <tr className="text-[9px] uppercase tracking-widest text-slate-600 dark:text-slate-500 border-b border-slate-200 dark:border-indigo-950/60">
                  <th className="py-2 pr-3 font-semibold">ID</th>
                  <th className="py-2 pr-3 font-semibold">SKILL</th>
                  <th className="py-2 pr-3 font-semibold">STATUS</th>
                  <th className="py-2 pr-3 font-semibold">PROVIDER</th>
                  <th className="py-2 pr-3 font-semibold">DURATION</th>
                  <th className="py-2 font-semibold">STARTED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-indigo-950/50">
                {executions.map((execution: ExecutionDTO) => (
                  <tr key={execution.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/dashboard/executions/${execution.id}`}
                        className="text-[11px] text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 font-semibold"
                      >
                        {shortId(execution.id)}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-[11px] text-slate-900 dark:text-slate-300 font-medium">
                      {execution.skillName ?? shortId(execution.skillVersionId)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <ExecutionStatusBadge status={execution.status} />
                    </td>
                    <td className="py-2.5 pr-3 text-[10px] text-slate-600 dark:text-slate-500 font-medium">{execution.provider ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-[11px] text-slate-700 dark:text-slate-400 font-medium">
                      {execution.durationMs != null ? `${(execution.durationMs / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="py-2.5 text-[10px] text-slate-600 dark:text-slate-500 font-medium">{formatDate(execution.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
