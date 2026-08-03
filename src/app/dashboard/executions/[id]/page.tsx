"use client";

import React, { useCallback, useState } from "react";
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
import { SkeletonExecutionDetail } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "@/stores/toastStore";
import { clsx } from "clsx";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const stepStatusStyles: Record<string, string> = {
  SUCCESS: "border-emerald-500/40 bg-emerald-950/30 text-emerald-300",
  FAILED: "border-red-500/40 bg-red-950/30 text-red-300",
  RUNNING: "border-indigo-500/40 bg-indigo-950/30 text-indigo-300",
  AWAITING_APPROVAL: "border-amber-500/40 bg-amber-950/30 text-amber-300",
  SKIPPED: "border-slate-500/40 bg-slate-950/30 text-slate-400",
};

const logLevelStyles: Record<string, string> = {
  INFO: "border-indigo-500/30 text-indigo-300",
  WARN: "border-amber-500/30 text-amber-300",
  ERROR: "border-red-500/30 text-red-300",
};

function JsonPreview({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/80 mb-1.5">{label}</div>
      <pre className="rounded border border-indigo-900/40 bg-black/60 p-3 text-[10px] text-slate-400 font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre">
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
  const [isCancelling, setIsCancelling] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["execution", id],
    queryFn: () => executionsApi.detail(id),
  });

  const execution = data?.execution;

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
        description="This execution does not exist or you do not have access to it."
        action={
          <Link
            href="/dashboard/executions"
            className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all"
          >
            [ BACK TO EXECUTIONS ]
          </Link>
        }
      />
    );
  }

  // The backend also allows cancelling a run parked for human approval.
  const canCancel =
    execution.status === "RUNNING" || execution.status === "PENDING" || execution.status === "PAUSED_FOR_APPROVAL";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-indigo-950/80 pb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/executions"
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ChevronLeft className="h-3 w-3" /> BACK TO EXECUTIONS
          </Link>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-indigo-500/40 bg-indigo-950/40 text-indigo-200 hover:border-indigo-400 hover:text-white transition-all cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" /> [ REFRESH ]
            </button>
            <button
              type="button"
              onClick={() => replayMutation.mutate()}
              disabled={replayMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-cyan-500/40 bg-cyan-950/40 text-cyan-200 hover:border-cyan-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> [ REPLAY ]
            </button>
            <button
              type="button"
              onClick={downloadExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-emerald-500/40 bg-emerald-950/40 text-emerald-200 hover:border-emerald-400 hover:text-white transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> [ EXPORT JSON ]
            </button>
            {canCancel && (
              <button
                type="button"
                onClick={() => {
                  setIsCancelling(true);
                  cancelMutation.mutate(undefined, { onSettled: () => setIsCancelling(false) });
                }}
                disabled={isCancelling}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-red-500/40 bg-red-950/40 text-red-300 hover:border-red-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              >
                <Ban className="h-3.5 w-3.5" /> [ CANCEL ]
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-tight flex items-center gap-3">
            <Terminal className="h-6 w-6 text-indigo-400" />
            EXECUTION TRACE
          </h1>
          <ExecutionStatusBadge status={execution.status} />
          {execution.replayedFromExecutionId && (
            <span className="px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-950/40 text-[10px] font-mono uppercase tracking-wider text-cyan-300">
              REPLAYED RUN
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-indigo-400" />
            {execution.skillName ?? `version ${execution.skillVersionId}`}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-indigo-400" /> started {formatDate(execution.startedAt)}
          </span>
          {execution.completedAt && (
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-emerald-400" /> finished {formatDate(execution.completedAt)}
            </span>
          )}
          {execution.durationMs != null && (
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-indigo-400" /> {(execution.durationMs / 1000).toFixed(2)}s
            </span>
          )}
          {execution.provider && (
            <span className="px-2 py-0.5 rounded border border-indigo-900/50 bg-indigo-950/30 text-indigo-300">
              provider: {execution.provider}
            </span>
          )}
        </div>

        {execution.errorMessage && (
          <p className="text-[11px] font-mono text-red-400 bg-red-950/20 border border-red-500/30 rounded px-3 py-2">
            [ ERROR ] {execution.errorMessage}
          </p>
        )}
      </div>

      {/* Input + Planner Output + Final Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <JsonPreview label="Input Data" value={execution.inputData} />
        <JsonPreview label="Planner Output (Plan)" value={execution.plannerOutput} />
      </div>
      {execution.finalOutput && (
        <JsonPreview label="Final Output" value={execution.finalOutput} />
      )}

      {/* Unified Timeline */}
      <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-950/60 pb-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/80 flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5" /> Unified Execution Timeline
          </div>
          <TimelineLegend />
        </div>
        <ExecutionTimeline events={data?.timeline ?? []} />
      </div>

      {/* Node Steps */}
      <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 p-5 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/80 flex items-center gap-1.5 border-b border-indigo-950/60 pb-2">
          <ListChecks className="h-3.5 w-3.5" /> Node Timeline
        </div>
        {!execution.steps || execution.steps.length === 0 ? (
          <p className="text-[11px] text-slate-500">No node executions recorded.</p>
        ) : (
          <ol className="space-y-2">
            {execution.steps.map((step) => (
              <li key={step.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded border border-indigo-950/60 bg-black/40 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-mono text-slate-600 w-6 shrink-0">#{step.stepNumber}</span>
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider",
                      stepStatusStyles[step.status] ?? stepStatusStyles.SKIPPED
                    )}
                  >
                    {step.status}
                  </span>
                  <span className="text-xs font-mono text-slate-200 truncate">{step.nodeName}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 shrink-0">
                  <span>{formatDate(step.startedAt)}</span>
                  {step.stateSnapshot && (
                    <span className="text-indigo-400/80 hidden md:inline">
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
      <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 p-5 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/80 flex items-center gap-1.5 border-b border-indigo-950/60 pb-2">
          <Wrench className="h-3.5 w-3.5" /> Tool Calls
        </div>
        {!execution.toolCalls || execution.toolCalls.length === 0 ? (
          <p className="text-[11px] text-slate-500">No tool calls recorded.</p>
        ) : (
          <ul className="space-y-2">
            {execution.toolCalls.map((call) => (
              <li key={call.id} className="rounded border border-indigo-950/60 bg-black/40 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[11px] font-mono font-semibold text-indigo-200">{call.toolName}</span>
                  <span className="text-[10px] font-mono text-slate-400">· {call.action}</span>
                  <span
                    className={clsx(
                      "px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase",
                      call.status === "SUCCESS"
                        ? "border-emerald-500/40 text-emerald-300"
                        : call.status === "BLOCKED"
                          ? "border-amber-500/40 text-amber-300"
                          : call.status === "ERROR" || call.status === "REJECTED"
                            ? "border-red-500/40 text-red-300"
                            : "border-slate-500/40 text-slate-400"
                    )}
                  >
                    {call.status}
                  </span>
                  {call.errorMessage && <span className="text-[10px] font-mono text-red-400">[ {call.errorMessage} ]</span>}
                </div>
                <pre className="text-[10px] text-slate-500 font-mono overflow-x-auto">
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
      <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 p-5 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400/80 flex items-center gap-1.5 border-b border-indigo-950/60 pb-2">
          <Shield className="h-3.5 w-3.5" /> Approval Events
        </div>
        {!data?.approvals || data.approvals.length === 0 ? (
          <p className="text-[11px] text-slate-500">No approval checkpoints in this execution.</p>
        ) : (
          <ul className="space-y-2">
            {data.approvals.map((approval) => (
              <li key={approval.id} className="rounded border border-amber-900/40 bg-amber-950/10 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[11px] font-mono font-semibold text-amber-200">
                    {approval.toolName} · {approval.action}
                  </span>
                  <span
                    className={clsx(
                      "px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase",
                      approval.status === "APPROVED"
                        ? "border-emerald-500/40 text-emerald-300"
                        : approval.status === "REJECTED"
                          ? "border-red-500/40 text-red-300"
                          : "border-amber-500/40 text-amber-300"
                    )}
                  >
                    {approval.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{formatDate(approval.requestedAt)}</span>
                </div>
                {approval.skillName && (
                  <p className="text-[10px] font-mono text-slate-400">skill: {approval.skillName}</p>
                )}
                {approval.plannerReason && (
                  <p className="text-[10px] font-mono text-slate-500 italic">“{approval.plannerReason}”</p>
                )}
                {approval.rejectionReason && (
                  <p className="text-[10px] font-mono text-red-400">[ REASON ] {approval.rejectionReason}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Structured Logs */}
      <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 p-5 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/80 flex items-center gap-1.5 border-b border-indigo-950/60 pb-2">
          <ScrollText className="h-3.5 w-3.5" /> Structured Execution Logs
        </div>
        {!data?.logs || data.logs.length === 0 ? (
          <p className="text-[11px] text-slate-500">No structured logs recorded for this execution.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1 font-mono">
            {data.logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 rounded border border-indigo-950/50 bg-black/40 px-2.5 py-1.5 text-[10px]">
                <span className="text-slate-600 shrink-0">{formatDate(log.timestamp)}</span>
                <span className={clsx("shrink-0 px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-wider", logLevelStyles[log.level])}>
                  {log.level}
                </span>
                <span className="text-indigo-300/90 shrink-0">{log.event}</span>
                {log.status && <span className="text-slate-500 shrink-0">[{log.status}]</span>}
                {log.durationMs != null && <span className="text-indigo-400/70 shrink-0">{(log.durationMs / 1000).toFixed(3)}s</span>}
                {Object.keys(log.metadata ?? {}).length > 0 && (
                  <span className="text-slate-600 truncate">{JSON.stringify(log.metadata)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
