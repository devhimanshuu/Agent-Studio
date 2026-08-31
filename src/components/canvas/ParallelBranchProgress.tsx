"use client";

import React, { useMemo } from "react";
import { Check, X, Loader2, Clock } from "lucide-react";
import { clsx } from "clsx";

interface BranchInfo {
  nodeId: string;
  label: string;
  status?: "RUNNING" | "SUCCESS" | "FAILED" | "AWAITING_APPROVAL" | "SKIPPED";
  durationMs?: number;
}

interface ParallelBranchProgressProps {
  /** The parallel node's ID. */
  parentNodeId: string;
  /** Branches spawned by this parallel node. */
  branches: BranchInfo[];
  /** Total expected branches. */
  totalBranches?: number;
  /** Map of active branches from the execution stream. */
  activeBranches?: string[];
}

export function ParallelBranchProgress({
  parentNodeId: _parentNodeId,
  branches,
  totalBranches,
  activeBranches = [],
}: ParallelBranchProgressProps) {
  const stats = useMemo(() => {
    const running = branches.filter((b) => b.status === "RUNNING").length;
    const succeeded = branches.filter((b) => b.status === "SUCCESS").length;
    const failed = branches.filter((b) => b.status === "FAILED").length;
    const total = totalBranches ?? branches.length;
    const completed = succeeded + failed;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { running, succeeded, failed, total, completed, percent };
  }, [branches, totalBranches]);

  if (branches.length === 0 && activeBranches.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1">
      {/* Progress bar */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-300",
              stats.percent >= 100 ? "bg-emerald-500" : stats.failed > 0 ? "bg-amber-500" : "bg-teal-500"
            )}
            style={{ width: `${stats.percent}%` }}
          />
        </div>
        <span className="text-[7px] text-slate-400 font-bold shrink-0">
          {stats.completed}/{stats.total}
        </span>
      </div>

      {/* Branch chips */}
      <div className="flex flex-wrap gap-0.5">
        {branches.map((branch) => {
          const _isActive = activeBranches.includes(branch.nodeId);
          return (
            <div
              key={branch.nodeId}
              className={clsx(
                "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold border transition-all",
                branch.status === "RUNNING"
                  ? "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700/50"
                  : branch.status === "SUCCESS"
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50"
                    : branch.status === "FAILED"
                      ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/50"
                      : "bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50"
              )}
            >
              {branch.status === "RUNNING" ? (
                <Loader2 className="h-1.5 w-1.5 animate-spin" />
              ) : branch.status === "SUCCESS" ? (
                <Check className="h-1.5 w-1.5" />
              ) : branch.status === "FAILED" ? (
                <X className="h-1.5 w-1.5" />
              ) : null}
              {branch.label}
              {branch.durationMs !== undefined && (
                <span className="text-[6px] opacity-60">
                  {branch.durationMs >= 1000 ? `${(branch.durationMs / 1000).toFixed(1)}s` : `${branch.durationMs}ms`}
                </span>
              )}
            </div>
          );
        })}

        {/* Ghost placeholders for expected but not-yet-started branches */}
        {Array.from({ length: Math.max(0, (totalBranches ?? 0) - branches.length) }).map((_, i) => (
          <div
            key={`ghost-${i}`}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold border border-dashed border-slate-300 dark:border-slate-600 text-slate-300 dark:text-slate-600"
          >
            <Clock className="h-1.5 w-1.5" />
            pending
          </div>
        ))}
      </div>
    </div>
  );
}
