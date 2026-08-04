"use client";

import React, { useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  GitBranch,
  Zap,
  Clock,
  Terminal,
  ListChecks,
  Wrench,
  RefreshCw,
  Ban,
  Download,
  RotateCcw,
  ScrollText,
  Shield,
} from "lucide-react";
import { executionsApi } from "@/lib/api/executions";
import { ExecutionStatusBadge } from "@/components/executions/ExecutionStatusBadge";
import { ExecutionTimeline, TimelineLegend } from "@/components/executions/ExecutionTimeline";
import { buildExecutionTimeline } from "@/modules/timeline";
import { SkeletonExecutionDetail } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "@/stores/toastStore";
import { clsx } from "clsx";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const stepStatusStyles: Record<string, string> = {
  SUCCESS: "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-semibold",
  FAILED: "border-red-400 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 font-semibold",
  RUNNING: "border-indigo-400 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 font-semibold",
  AWAITING_APPROVAL: "border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-semibold",
  SKIPPED: "border-slate-300 dark:border-slate-500/40 bg-slate-100 dark:bg-slate-950/30 text-slate-700 dark:text-slate-400 font-medium",
};

const logLevelStyles: Record<string, string> = {
  INFO: "border-indigo-300 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-300 font-semibold",
  WARN: "border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 font-semibold",
  ERROR: "border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-300 font-semibold",
};

function JsonPreview({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 mb-1.5 font-semibold">{label}</div>
      <pre className="rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/60 p-3 text-[10px] text-slate-800 dark:text-slate-400 font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre shadow-sm">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </div>
  );
}

export default function ExecutionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["execution", id],
    queryFn: () => executionsApi.detail(id),
  });

  const execution = data?.execution;

  const timelineEvents = useMemo(() => (execution ? buildExecutionTimeline(execution) : []), [execution]);

  const cancelMutation = useMutation({
    mutationFn: () => executionsApi.cancel(id),
    onSuccess: () => {
      toast.success("Execution cancelled");
      queryClient.invalidateQueries({ queryKey: ["execution", id] });
      queryClient.invalidateQueries({ queryKey: ["executions"] });
    },
    onError: (e) => toast.error("Cancel failed", e.message),
  });

  const replayMutation = useMutation({
    mutationFn: () => executionsApi.replay(id),
    onSuccess: (execution) => {
      toast.success("Execution replayed", "A new linked run was created");
      queryClient.invalidateQueries({ queryKey: ["executions"] });
      router.push(`/dashboard/executions/${execution.id}`);
    },
    onError: (e) => toast.error("Replay failed", e.message),
  });

  const downloadExport = useCallback(async () => {
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
    }
  }, [id]);

  if (isLoading) return <SkeletonExecutionDetail />;
  if (isError || !execution) {
    return (
      <EmptyState
        title="Execution not found"
        description="This run does not exist or was removed."
        action={
          <Link
            href="/dashboard/executions"
            className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all cursor-pointer"
          >
            [ BACK TO HISTORY ]
          </Link>
        }
      />
    );
  }

  const isRunning = execution.status === "RUNNING" || execution.status === "PAUSED_FOR_APPROVAL";

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-indigo-950/80 pb-5 space-y-3">
        <Link
          href="/dashboard/executions"
          className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 transition-colors font-semibold"
        >
          <ChevronLeft className="h-3 w-3" /> BACK TO EXECUTIONS
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-tight">
                RUN {execution.id.slice(0, 12)}…
              </h1>
              <ExecutionStatusBadge status={execution.status} />
              {execution.replayedFromExecutionId && (
                <span className="px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-[10px] font-mono uppercase tracking-wider text-indigo-700 dark:text-indigo-300 font-semibold">
                  REPLAYED FROM {execution.replayedFromExecutionId.slice(0, 8)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <GitBranch className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                {execution.skillName ?? `v${execution.skillVersionId.slice(0, 8)}`}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                {formatDate(execution.startedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                {execution.durationMs != null ? `${(execution.durationMs / 1000).toFixed(2)}s` : "running"}
              </span>
              {execution.provider && (
                <span className="px-2 py-0.5 rounded border border-slate-300 dark:border-indigo-900/40 bg-slate-100 dark:bg-indigo-950/30 text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold">
                  {execution.provider}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isRunning && (
              <button
                type="button"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-red-400 bg-red-600 text-white font-semibold hover:bg-red-500 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <Ban className="h-3.5 w-3.5" /> [ CANCEL RUN ]
              </button>
            )}
            <button
              type="button"
              onClick={() => replayMutation.mutate()}
              disabled={replayMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 hover:border-indigo-400 font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" /> [ REPLAY ]
            </button>
            <button
              type="button"
              onClick={downloadExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-emerald-400 bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-all cursor-pointer shadow-sm"
            >
              <Download className="h-3.5 w-3.5" /> [ EXPORT JSON ]
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-100 dark:bg-black/40 text-slate-700 dark:text-slate-400 hover:border-indigo-400 font-semibold transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" /> [ REFRESH ]
            </button>
          </div>
        </div>

        {execution.errorMessage && (
          <div className="rounded border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-800 dark:text-red-300 font-semibold">
            [ ERROR ] {execution.errorMessage}
          </div>
        )}
      </div>

      {/* Planner Output / Final Response */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <JsonPreview label="Input Payload" value={execution.inputData} />
        <JsonPreview label="Output Result" value={execution.finalOutput} />
      </div>

      {/* Execution Timeline (Nodes breakdown) */}
      <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-indigo-950/60 pb-3">
          <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1.5 font-semibold">
            <Terminal className="h-3.5 w-3.5" /> Planner & Node Graph Trace
          </div>
          <TimelineLegend />
        </div>
        <ExecutionTimeline events={timelineEvents} />
      </div>

      {/* Node List */}
      <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-5 space-y-3 shadow-sm">
        <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1.5 border-b border-slate-200 dark:border-indigo-950/60 pb-2 font-semibold">
          <ListChecks className="h-3.5 w-3.5" /> Node Timeline
        </div>
        {!execution.steps || execution.steps.length === 0 ? (
          <p className="text-[11px] text-slate-500">No node executions recorded.</p>
        ) : (
          <ol className="space-y-2">
            {execution.steps.map((step) => (
              <li key={step.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50 dark:bg-black/40 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-mono text-slate-500 w-6 shrink-0 font-medium">#{step.stepNumber}</span>
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider",
                      stepStatusStyles[step.status] ?? stepStatusStyles.SKIPPED
                    )}
                  >
                    {step.status}
                  </span>
                  <span className="text-xs font-mono text-slate-900 dark:text-slate-200 truncate font-semibold">{step.nodeName}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 shrink-0 font-medium">
                  <span>{formatDate(step.startedAt)}</span>
                  {step.stateSnapshot && (
                    <span className="text-indigo-700 dark:text-indigo-400/80 hidden md:inline font-mono">
                      {JSON.stringify(step.stateSnapshot).slice(0, 60)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Tool Calls */}
      <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-5 space-y-3 shadow-sm">
        <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1.5 border-b border-slate-200 dark:border-indigo-950/60 pb-2 font-semibold">
          <Wrench className="h-3.5 w-3.5" /> Tool Calls
        </div>
        {!execution.toolCalls || execution.toolCalls.length === 0 ? (
          <p className="text-[11px] text-slate-500">No tool calls recorded.</p>
        ) : (
          <ul className="space-y-2">
            {execution.toolCalls.map((call) => (
              <li key={call.id} className="rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50 dark:bg-black/40 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[11px] font-mono font-semibold text-indigo-900 dark:text-indigo-200">{call.toolName}</span>
                  <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 font-medium">· {call.action}</span>
                  <span
                    className={clsx(
                      "px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase font-semibold",
                      call.status === "SUCCESS"
                        ? "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                        : call.status === "BLOCKED"
                          ? "border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                          : call.status === "ERROR" || call.status === "REJECTED"
                            ? "border-red-400 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"
                            : "border-slate-300 dark:border-slate-500/40 bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-400"
                    )}
                  >
                    {call.status}
                  </span>
                  {call.errorMessage && <span className="text-[10px] font-mono text-red-600 dark:text-red-400 font-semibold">[ {call.errorMessage} ]</span>}
                </div>
                <pre className="text-[10px] text-slate-600 dark:text-slate-500 font-mono overflow-x-auto">
                  {JSON.stringify(call.inputArgs)}
                  {call.outputResult !== null && call.outputResult !== undefined
                    ? ` → ${JSON.stringify(call.outputResult).slice(0, 200)}`
                    : ""}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Approval Events */}
      <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-5 space-y-3 shadow-sm">
        <div className="text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-400/80 flex items-center gap-1.5 border-b border-slate-200 dark:border-indigo-950/60 pb-2 font-semibold">
          <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> Approval Events
        </div>
        {!data?.approvals || data.approvals.length === 0 ? (
          <p className="text-[11px] text-slate-500">No approval checkpoints in this execution.</p>
        ) : (
          <ul className="space-y-2">
            {data.approvals.map((approval) => (
              <li key={approval.id} className="rounded border border-amber-300 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/10 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[11px] font-mono font-semibold text-amber-900 dark:text-amber-200">
                    {approval.toolName} · {approval.action}
                  </span>
                  <span
                    className={clsx(
                      "px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase font-semibold",
                      approval.status === "APPROVED"
                        ? "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                        : approval.status === "REJECTED"
                          ? "border-red-400 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"
                          : "border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                    )}
                  >
                    {approval.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{formatDate(approval.requestedAt)}</span>
                </div>
                {approval.skillName && (
                  <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 font-medium">skill: {approval.skillName}</p>
                )}
                {approval.plannerReason && (
                  <p className="text-[10px] font-mono text-slate-600 dark:text-slate-500 italic">“{approval.plannerReason}”</p>
                )}
                {approval.rejectionReason && (
                  <p className="text-[10px] font-mono text-red-600 dark:text-red-400 font-semibold">[ REASON ] {approval.rejectionReason}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Structured Logs */}
      <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-5 space-y-3 shadow-sm">
        <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1.5 border-b border-slate-200 dark:border-indigo-950/60 pb-2 font-semibold">
          <ScrollText className="h-3.5 w-3.5" /> Structured Execution Logs
        </div>
        {!data?.logs || data.logs.length === 0 ? (
          <p className="text-[11px] text-slate-500">No structured logs recorded for this execution.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1 font-mono">
            {data.logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 rounded border border-slate-200 dark:border-indigo-950/50 bg-slate-50 dark:bg-black/40 px-2.5 py-1.5 text-[10px]">
                <span className="text-slate-500 shrink-0 font-medium">{formatDate(log.timestamp)}</span>
                <span className={clsx("shrink-0 px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-wider", logLevelStyles[log.level])}>
                  {log.level}
                </span>
                <span className="text-indigo-900 dark:text-indigo-300/90 shrink-0 font-semibold">{log.event}</span>
                {log.status && <span className="text-slate-500 shrink-0">[{log.status}]</span>}
                {log.durationMs != null && <span className="text-indigo-700 dark:text-indigo-400/70 shrink-0 font-semibold">{(log.durationMs / 1000).toFixed(3)}s</span>}
                {Object.keys(log.metadata ?? {}).length > 0 && (
                  <span className="text-slate-600 dark:text-slate-500 truncate">{JSON.stringify(log.metadata)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
