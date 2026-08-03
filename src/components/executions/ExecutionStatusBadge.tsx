import React from "react";
import { ExecutionStatus } from "@/types/execution";
import { clsx } from "clsx";

const styles: Record<ExecutionStatus, string> = {
  PENDING: "border-slate-500/40 bg-slate-950/40 text-slate-400",
  RUNNING: "border-indigo-500/40 bg-indigo-950/40 text-indigo-300",
  PAUSED_FOR_APPROVAL: "border-amber-500/40 bg-amber-950/40 text-amber-300",
  COMPLETED: "border-emerald-500/40 bg-emerald-950/40 text-emerald-300",
  FAILED: "border-red-500/40 bg-red-950/40 text-red-300",
  CANCELLED: "border-slate-500/40 bg-slate-950/40 text-slate-400",
  STEP_LIMIT_EXCEEDED: "border-orange-500/40 bg-orange-950/40 text-orange-300",
};

export function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider",
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
