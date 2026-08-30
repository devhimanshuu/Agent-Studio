"use client";

import React from "react";
import Link from "next/link";
import { Play, ScrollText, ArrowUpRight, Gauge } from "lucide-react";
import { ExecutionDTO } from "@/types/execution";
import { AuditLogItemDTO } from "@/types/dashboard";
import { ExecutionStatusBadge } from "@/components/executions/ExecutionStatusBadge";

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function RecentExecutionsCard({ executions }: { executions: ExecutionDTO[] }) {
  return (
    <div className="p-6 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-4 h-full shadow-sm font-mono flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wider">
            <Play className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            RECENT EXECUTIONS
          </h3>
          <Link
            href="/dashboard/executions"
            className="text-[11px] text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-1 font-semibold"
          >
            [ VIEW ALL ] <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {executions.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs italic">
            No executions recorded in this time range.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-indigo-950/60 text-xs">
            {executions.slice(0, 5).map((e) => (
              <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {e.skillName ?? "Agent Workflow"}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-medium">
                    <span>{e.provider ?? "Standard"}</span>
                    <span>·</span>
                    <span>{e.durationMs ? `${(e.durationMs / 1000).toFixed(1)}s` : "—"}</span>
                    <span>·</span>
                    <span>{formatTime(e.startedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ExecutionStatusBadge status={e.status} />
                  <Link
                    href={`/dashboard/executions/${e.id}`}
                    className="text-[10px] text-indigo-700 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    [ TRACE ]
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60">
        <Link
          href="/dashboard/history"
          className="text-xs text-indigo-700 dark:text-indigo-400 hover:underline flex items-center justify-center gap-1 font-semibold"
        >
          EXPLORE FULL TELEMETRY & OBSERVABILITY →
        </Link>
      </div>
    </div>
  );
}

export function SystemAuditActivityCard({ activity }: { activity: AuditLogItemDTO[] }) {
  return (
    <div className="p-6 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-4 h-full shadow-sm font-mono flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wider">
            <ScrollText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            SYSTEM AUDIT & ACTIVITY
          </h3>
          <Link
            href="/dashboard/audit"
            className="text-[11px] text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-1 font-semibold"
          >
            [ AUDIT LOG ] <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {activity.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs italic">
            No audit logs recorded yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-indigo-950/60 text-xs">
            {activity.slice(0, 5).map((a) => (
              <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate">
                    {a.action}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {formatDate(a.timestamp)} · {formatTime(a.timestamp)}
                  </div>
                </div>
                <Gauge className="h-3.5 w-3.5 text-indigo-400/70 shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60">
        <Link
          href="/dashboard/audit"
          className="text-xs text-indigo-700 dark:text-indigo-400 hover:underline flex items-center justify-center gap-1 font-semibold"
        >
          VIEW COMPLIANCE & SECURITY AUDIT TRAIL →
        </Link>
      </div>
    </div>
  );
}
