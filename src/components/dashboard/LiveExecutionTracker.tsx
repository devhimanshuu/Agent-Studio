"use client";

import React from "react";
import Link from "next/link";
import { Play, PauseCircle, Activity, ArrowRight, ShieldAlert, Cpu } from "lucide-react";
import { LiveExecutionItemDTO } from "@/types/dashboard";

interface LiveExecutionTrackerProps {
  liveExecutions: LiveExecutionItemDTO[];
}

export function LiveExecutionTracker({ liveExecutions }: LiveExecutionTrackerProps) {
  if (liveExecutions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200/80 dark:border-indigo-950/60 bg-white/40 dark:bg-[#070709]/40 px-4 py-2.5 flex items-center justify-between text-xs font-mono text-slate-500 shadow-sm">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-500/70" />
          <span>AGENT RUNTIME: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">READY & IDLE</span></span>
          <span className="text-[10px] text-slate-400">· Standing by for triggers</span>
        </div>
        <Link
          href="/dashboard/skills"
          className="text-[10px] text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-semibold flex items-center gap-1"
        >
          [ RUN A SKILL ] <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2 font-mono">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-indigo-700 dark:text-indigo-400 font-semibold px-1">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          IN-FLIGHT AGENT RUNS ({liveExecutions.length})
        </span>
        <Link
          href="/dashboard/executions"
          className="text-[10px] text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-semibold"
        >
          VIEW ALL ACTIVE →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {liveExecutions.map((item) => {
          const isPaused = item.status === "PAUSED_FOR_APPROVAL";
          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-lg border backdrop-blur-md flex items-center justify-between gap-3 shadow-sm transition-all ${
                isPaused
                  ? "border-amber-400/80 dark:border-amber-500/50 bg-amber-50/70 dark:bg-amber-950/30"
                  : "border-emerald-400/80 dark:border-emerald-500/50 bg-emerald-50/70 dark:bg-emerald-950/30"
              }`}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {isPaused ? (
                    <PauseCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
                  ) : (
                    <Play className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
                  )}
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {item.skillName}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      isPaused
                        ? "bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200"
                        : "bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200"
                    }`}
                  >
                    {isPaused ? "AWAITING HITL" : "RUNNING"}
                  </span>
                </div>

                <div className="text-[10px] text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Cpu className="h-3 w-3 text-indigo-500" /> Step {item.stepCount}/{item.maxSteps}
                  </span>
                  {item.currentToolName && (
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Tool: <code className="text-indigo-700 dark:text-indigo-300">{item.currentToolName}</code>
                    </span>
                  )}
                  {item.provider && <span>· {item.provider}</span>}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {isPaused ? (
                  <Link
                    href="/dashboard/review"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-amber-400 bg-amber-600 text-white text-[10px] font-bold uppercase hover:bg-amber-500 transition-all shadow-sm"
                  >
                    <ShieldAlert className="h-3 w-3" /> REVIEW
                  </Link>
                ) : (
                  <Link
                    href={`/dashboard/executions/${item.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-emerald-400 bg-emerald-600 text-white text-[10px] font-bold uppercase hover:bg-emerald-500 transition-all shadow-sm"
                  >
                    LIVE TRACE <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
