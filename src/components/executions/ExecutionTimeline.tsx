"use client";

import React from "react";
import { TimelineEvent } from "@/types/observability";
import { clsx } from "clsx";
import { CircleDot, GitBranch, Wrench, Shield, ScrollText, Play } from "lucide-react";

const typeStyles: Record<TimelineEvent["type"], { dot: string; color: string; icon: React.ReactNode; label: string }> = {
  execution: {
    dot: "border-emerald-300 dark:border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
    color: "text-emerald-600 dark:text-emerald-400",
    icon: <Play className="h-3 w-3" />,
    label: "text-emerald-700 dark:text-emerald-300",
  },
  node: {
    dot: "border-indigo-300 dark:border-indigo-500/60 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300",
    color: "text-indigo-600 dark:text-indigo-400",
    icon: <GitBranch className="h-3 w-3" />,
    label: "text-indigo-700 dark:text-indigo-200",
  },
  tool: {
    dot: "border-cyan-300 dark:border-cyan-500/60 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300",
    color: "text-cyan-600 dark:text-cyan-400",
    icon: <Wrench className="h-3 w-3" />,
    label: "text-cyan-700 dark:text-cyan-200",
  },
  approval: {
    dot: "border-amber-300 dark:border-amber-500/60 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300",
    color: "text-amber-600 dark:text-amber-400",
    icon: <Shield className="h-3 w-3" />,
    label: "text-amber-800 dark:text-amber-200",
  },
  log: {
    dot: "border-slate-300 dark:border-slate-500/60 bg-slate-100 dark:bg-slate-950/60 text-slate-700 dark:text-slate-400",
    color: "text-slate-600 dark:text-slate-400",
    icon: <ScrollText className="h-3 w-3" />,
    label: "text-slate-700 dark:text-slate-300",
  },
};

function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Vertical, time-ordered trace timeline with type-colored nodes. */
export function ExecutionTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events || events.length === 0) {
    return <p className="text-[11px] text-slate-500 font-mono">No timeline events recorded.</p>;
  }

  return (
    <ol className="relative space-y-0">
      {events.map((event, idx) => {
        const style = typeStyles[event.type] ?? typeStyles.log;
        const isLast = idx === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-5">
            {/* Connecting line */}
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[11px] top-6 bottom-0 w-px bg-gradient-to-b from-indigo-900/70 to-indigo-950/30"
              />
            )}
            {/* Node dot */}
            <span
              className={clsx(
                "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                style.dot
              )}
            >
              {style.icon}
            </span>
            {/* Content */}
            <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className={clsx("text-[11px] font-mono font-semibold", style.label)}>{event.label}</span>
                <span className="text-[10px] font-mono text-slate-600">{formatTime(event.at)}</span>
              </div>
              {event.status && (
                <span className="inline-block px-1.5 py-0.5 rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-100 dark:bg-black/40 text-[9px] font-mono uppercase tracking-wider text-slate-700 dark:text-slate-400 font-medium">
                  {event.status}
                </span>
              )}
              {event.detail && (
                <p className="text-[10px] font-mono text-slate-500 truncate" title={event.detail}>
                  {event.detail}
                </p>
              )}
              {event.durationMs != null && (
                <p className="text-[9px] font-mono text-indigo-400/70">{(event.durationMs / 1000).toFixed(3)}s</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function TimelineLegend() {
  const items: { key: TimelineEvent["type"]; name: string }[] = [
    { key: "execution", name: "Execution" },
    { key: "node", name: "Node" },
    { key: "tool", name: "Tool" },
    { key: "approval", name: "Approval" },
    { key: "log", name: "Log" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-slate-500">
          <CircleDot className={clsx("h-2.5 w-2.5", typeStyles[item.key].color)} />
          {item.name}
        </span>
      ))}
    </div>
  );
}
