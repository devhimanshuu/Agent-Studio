"use client";

import React, { useMemo, useEffect, useState } from "react";
import {
  Check,
  X,
  Loader2,
  Shield,
  Zap,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { clsx } from "clsx";

interface ExecutionProgressOverlayProps {
  /** Current execution status string. */
  executionStatus: string | null;
  /** Map of nodeId → status. */
  nodeStatuses: Record<string, "RUNNING" | "SUCCESS" | "FAILED" | "AWAITING_APPROVAL" | "SKIPPED">;
  /** Map of nodeId → human-readable detail. */
  nodeDetails: Record<string, string>;
  /** Total number of nodes in the graph. */
  totalNodes: number;
  /** Whether SSE is connected. */
  connected: boolean;
  /** Start timestamp (ms since epoch) — for elapsed timer. */
  startedAt?: number;
  /** Cumulative token counts from LLM calls. */
  tokenSummary?: { inputTokens: number; outputTokens: number; totalCost: number };
  /** Whether this is a preview (ghost) run. */
  isPreview?: boolean;
}

export function ExecutionProgressOverlay({
  executionStatus,
  nodeStatuses,
  nodeDetails,
  totalNodes,
  connected,
  startedAt,
  tokenSummary,
  isPreview = false,
}: ExecutionProgressOverlayProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Live elapsed timer
  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(interval);
  }, [startedAt]);

  const stats = useMemo(() => {
    const statuses = Object.values(nodeStatuses);
    const running = statuses.filter((s) => s === "RUNNING").length;
    const succeeded = statuses.filter((s) => s === "SUCCESS").length;
    const failed = statuses.filter((s) => s === "FAILED").length;
    const awaiting = statuses.filter((s) => s === "AWAITING_APPROVAL").length;
    const completed = succeeded + failed;
    const percent = totalNodes > 0 ? Math.round((completed / totalNodes) * 100) : 0;

    return { running, succeeded, failed, awaiting, completed, percent };
  }, [nodeStatuses, totalNodes]);

  const isTerminal = executionStatus
    ? ["COMPLETED", "FAILED", "CANCELLED", "STEP_LIMIT_EXCEEDED"].includes(executionStatus)
    : false;

  const formatMs = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60_000);
    const secs = Math.round((ms % 60_000) / 1000);
    return `${mins}m ${secs}s`;
  };

  if (isTerminal && stats.percent >= 100) {
    // Compact terminal summary
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/80 backdrop-blur-md text-[9px] font-mono shadow-lg">
        <Check className="h-3 w-3 text-emerald-400 shrink-0" />
        <span className="font-bold text-emerald-300 tracking-wider">
          {executionStatus}
        </span>
        <span className="text-emerald-400/60">·</span>
        <span className="text-emerald-400">
          {stats.succeeded} succeeded · {stats.failed} failed
        </span>
        {elapsed > 0 && (
          <>
            <span className="text-emerald-400/60">·</span>
            <span className="text-emerald-400">{formatMs(elapsed)}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="font-mono rounded-lg border border-indigo-500/40 bg-[#0a0a14]/95 backdrop-blur-md shadow-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
            {isPreview ? "GHOST PREVIEW" : "EXECUTION PROGRESS"}
          </span>
          <span className="text-[9px] text-slate-500">·</span>
          <span className={clsx(
            "text-[9px] font-bold",
            executionStatus === "RUNNING" ? "text-indigo-400" :
            executionStatus === "COMPLETED" ? "text-emerald-400" :
            executionStatus === "FAILED" ? "text-red-400" :
            "text-slate-400"
          )}>
            {executionStatus ?? "INITIALIZING"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx(
            "inline-block h-1.5 w-1.5 rounded-full",
            connected ? "bg-emerald-500" : "bg-red-500"
          )} />
          {collapsed ? <ChevronDown className="h-3 w-3 text-slate-500" /> : <ChevronUp className="h-3 w-3 text-slate-500" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Progress</span>
              <span className="text-[9px] text-indigo-400 font-bold">{stats.percent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={clsx(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  stats.percent >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                )}
                style={{ width: `${stats.percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[8px] text-slate-500">
              <span>{stats.completed} / {totalNodes} nodes completed</span>
              {elapsed > 0 && <span>{formatMs(elapsed)} elapsed</span>}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "RUNNING", count: stats.running, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/30", icon: <Loader2 className="h-2.5 w-2.5 animate-spin" /> },
              { label: "SUCCESS", count: stats.succeeded, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: <Check className="h-2.5 w-2.5" /> },
              { label: "FAILED", count: stats.failed, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: <X className="h-2.5 w-2.5" /> },
              { label: "WAITING", count: stats.awaiting, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", icon: <Shield className="h-2.5 w-2.5" /> },
            ].map((s) => (
              <div key={s.label} className={clsx("flex items-center gap-1.5 px-2 py-1.5 rounded border", s.bg)}>
                <span className={s.color}>{s.icon}</span>
                <div className="min-w-0">
                  <div className={clsx("text-[9px] font-bold", s.color)}>{s.count}</div>
                  <div className="text-[7px] text-slate-500 uppercase tracking-wider">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Active Node Details */}
          {stats.running > 0 && (
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Active</span>
              <div className="space-y-0.5 max-h-20 overflow-y-auto">
                {Object.entries(nodeStatuses)
                  .filter(([, s]) => s === "RUNNING")
                  .map(([nodeId]) => (
                    <div key={nodeId} className="flex items-center gap-1.5 text-[9px]">
                      <Loader2 className="h-2 w-2 animate-spin text-indigo-400 shrink-0" />
                      <span className="text-slate-300 truncate">{nodeId}</span>
                      {nodeDetails[nodeId] && (
                        <span className="text-slate-500 truncate text-[8px]">— {nodeDetails[nodeId]}</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Awaiting Approval Details */}
          {stats.awaiting > 0 && (
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Awaiting Approval</span>
              <div className="space-y-0.5 max-h-20 overflow-y-auto">
                {Object.entries(nodeStatuses)
                  .filter(([, s]) => s === "AWAITING_APPROVAL")
                  .map(([nodeId]) => (
                    <div key={nodeId} className="flex items-center gap-1.5 text-[9px]">
                      <Shield className="h-2 w-2 text-amber-400 shrink-0" />
                      <span className="text-slate-300 truncate">{nodeId}</span>
                      {nodeDetails[nodeId] && (
                        <span className="text-slate-500 truncate text-[8px]">— {nodeDetails[nodeId]}</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Token Summary */}
          {tokenSummary && (tokenSummary.inputTokens > 0 || tokenSummary.outputTokens > 0) && (
            <div className="flex items-center gap-3 pt-1 border-t border-slate-800">
              <div className="flex items-center gap-1 text-[8px]">
                <TrendingUp className="h-2.5 w-2.5 text-cyan-500" />
                <span className="text-slate-400">↑</span>
                <span className="text-cyan-400 font-bold">{tokenSummary.inputTokens.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 text-[8px]">
                <Zap className="h-2.5 w-2.5 text-amber-500" />
                <span className="text-slate-400">↓</span>
                <span className="text-amber-400 font-bold">{tokenSummary.outputTokens.toLocaleString()}</span>
              </div>
              {tokenSummary.totalCost > 0 && (
                <div className="flex items-center gap-1 text-[8px]">
                  <span className="text-slate-400">$</span>
                  <span className="text-emerald-400 font-bold">{tokenSummary.totalCost.toFixed(4)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
