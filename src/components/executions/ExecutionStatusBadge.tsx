import React from "react";
import { ExecutionStatus } from "@/types/execution";
import { clsx } from "clsx";

const styles: Record<ExecutionStatus, string> = {
  PENDING: "border-slate-300 dark:border-slate-500/40 bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-400",
  RUNNING: "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
  PAUSED_FOR_APPROVAL: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
  COMPLETED: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  FAILED: "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  CANCELLED: "border-slate-300 dark:border-slate-500/40 bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-400",
  STEP_LIMIT_EXCEEDED: "border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300",
};

export function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider font-semibold shadow-xs",
        styles[status]
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span
          className={clsx(
            "relative inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-80",
            status === "RUNNING" && "animate-pulse"
          )}
        />
      </span>
      {status === "PAUSED_FOR_APPROVAL" ? "AWAITING APPROVAL" : status}
    </span>
  );
}
