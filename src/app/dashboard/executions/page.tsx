"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Play,
  GitBranch,
  Clock,
  Zap,
  ArrowUpRight,
  Search,
  RotateCcw,
  Download,
  RefreshCw,
} from "lucide-react";
import { executionsApi } from "@/lib/api/executions";
import { ExecutionStatusBadge } from "@/components/executions/ExecutionStatusBadge";
import { SkeletonTable } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ExecutionDTO, ExecutionStatus } from "@/types/execution";
import { toast } from "@/stores/toastStore";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 10)}…` : id;
}

const statusOptions: (ExecutionStatus | "")[] = [
  "",
  "RUNNING",
  "PAUSED_FOR_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "STEP_LIMIT_EXCEEDED",
];

export default function ExecutionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<ExecutionStatus | "">("");
  const [sortBy, setSortBy] = useState<"startedAt" | "durationMs" | "status">("startedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [downloading, setDownloading] = useState<string | null>(null);

  // Debounce the free-text search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["executions", debouncedSearch, status, sortBy, sortOrder],
    queryFn: () =>
      executionsApi.list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        sortBy,
        sortOrder,
      }),
  });

  const replayMutation = useMutation({
    mutationFn: (id: string) => executionsApi.replay(id),
    onSuccess: (execution) => {
      toast.success("Execution replayed", "A new linked run was created");
      queryClient.invalidateQueries({ queryKey: ["executions"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      router.push(`/dashboard/executions/${execution.id}`);
    },
    onError: (e) => toast.error("Replay failed", e.message),
  });

  const downloadExport = useCallback(async (id: string) => {
    setDownloading(id);
    try {
      const report = await executionsApi.exportReport(id);
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `execution-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error("Export failed", e instanceof Error ? e.message : undefined);
    } finally {
      setDownloading(null);
    }
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">
            EXECUTION HISTORY & TRACES
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
            Graph-first agent runs: planner output, node timeline, tool calls, approval events, and replay.
          </p>
        </div>
        <Link
          href="/dashboard/skills"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all text-xs font-mono cursor-pointer"
        >
          <Play className="h-4 w-4" />
          RUN A SKILL
        </Link>
      </div>

      {/* Search / Filter / Sort toolbar */}
      <div className="flex flex-wrap items-center gap-3 font-mono">
        <label className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by id, skill, provider, or error…"
            className="w-full rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-black/50 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
          />
        </label>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ExecutionStatus | "")}
          className="rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-black/50 px-3 py-2 text-xs text-slate-900 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
          aria-label="Filter by status"
        >
          {statusOptions.map((s) => (
            <option key={s || "all"} value={s}>
              {s === "" ? "ALL STATUSES" : s}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-black/50 px-3 py-2 text-xs text-slate-900 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
          aria-label="Sort by"
        >
          <option value="startedAt">SORT: STARTED</option>
          <option value="durationMs">SORT: DURATION</option>
          <option value="status">SORT: STATUS</option>
        </select>

        <button
          type="button"
          onClick={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-xs text-indigo-700 dark:text-indigo-200 hover:border-indigo-400 font-semibold transition-all cursor-pointer shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" /> {sortOrder === "desc" ? "DESC" : "ASC"}
        </button>
      </div>

      {isLoading ? (
        <SkeletonTable cols={5} rows={7} />
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
          title={debouncedSearch || status ? "No matching executions" : "No executions yet"}
          description={
            debouncedSearch || status
              ? "No runs match the current search or filters."
              : "Run a skill to see its plan, node-by-node timeline, tool calls, and final output here."
          }
          action={
            <Link
              href="/dashboard/skills"
              className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all cursor-pointer"
            >
              [ BROWSE SKILLS ]
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.map((execution: ExecutionDTO) => (
            <div
              key={execution.id}
              className="group rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 p-4 hover:border-indigo-400 dark:hover:border-indigo-500/50 shadow-sm hover:shadow-lg transition-all duration-300"
            >
              <Link href={`/dashboard/executions/${execution.id}`} className="block">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">{shortId(execution.id)}</span>
                    <ExecutionStatusBadge status={execution.status} />
                    {execution.replayedFromExecutionId && (
                      <span
                        className="px-1.5 py-0.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-[9px] font-mono uppercase tracking-wider text-indigo-700 dark:text-indigo-300 font-semibold"
                        title={`Replayed from ${execution.replayedFromExecutionId}`}
                      >
                        REPLAY
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="h-3 w-3 text-indigo-600 dark:text-indigo-400/70" />
                      {formatDate(execution.startedAt)}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Zap className="h-3 w-3 text-indigo-600 dark:text-indigo-400/70" />
                      {execution.durationMs != null ? `${(execution.durationMs / 1000).toFixed(1)}s` : "—"}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <GitBranch className="h-3 w-3 text-indigo-600 dark:text-indigo-400/70" />
                      {execution.skillName ?? `v${shortId(execution.skillVersionId)}`}
                    </span>
                    {execution.provider && <span className="text-indigo-700 dark:text-indigo-300/80 font-medium">{execution.provider}</span>}
                    <ArrowUpRight className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
                {execution.errorMessage && (
                  <p className="mt-2 text-[11px] font-mono text-red-600 dark:text-red-400/90 truncate font-semibold">
                    [ ERROR ] {execution.errorMessage}
                  </p>
                )}
              </Link>
              {/* Row actions */}
              <div className="mt-2.5 flex items-center gap-2 border-t border-slate-200 dark:border-indigo-950/60 pt-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  type="button"
                  onClick={() => replayMutation.mutate(execution.id)}
                  disabled={replayMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-[10px] font-mono text-indigo-700 dark:text-indigo-200 hover:border-indigo-400 transition-all cursor-pointer font-semibold disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" /> [ REPLAY ]
                </button>
                <button
                  type="button"
                  onClick={() => downloadExport(execution.id)}
                  disabled={downloading === execution.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-mono text-emerald-700 dark:text-emerald-200 hover:border-emerald-400 transition-all cursor-pointer font-semibold disabled:opacity-50"
                >
                  <Download className="h-3 w-3" /> [ EXPORT JSON ]
                </button>
                <Link
                  href={`/dashboard/executions/${execution.id}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-100 dark:bg-black/40 text-[10px] font-mono text-slate-700 dark:text-slate-400 hover:border-indigo-400 font-semibold transition-all"
                >
                  <ArrowUpRight className="h-3 w-3" /> OPEN TRACE
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
