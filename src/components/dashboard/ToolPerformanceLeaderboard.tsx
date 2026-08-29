"use client";

import React from "react";
import Link from "next/link";
import { Wrench, ArrowUpRight, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { ToolLeaderboardItemDTO } from "@/types/dashboard";

interface ToolPerformanceLeaderboardProps {
  tools: ToolLeaderboardItemDTO[];
}

export function ToolPerformanceLeaderboard({ tools }: ToolPerformanceLeaderboardProps) {
  return (
    <div className="p-5 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-4 h-full shadow-sm font-mono flex flex-col justify-between">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              TOOL REGISTRY & LATENCY
            </h3>
          </div>
          <Link
            href="/dashboard/tools"
            className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            [ REGISTRY ] <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Tools Table / List */}
        {tools.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic py-4">No tools registered in catalog yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-indigo-950/60 pb-1.5">
                  <th className="py-1.5 pr-2 font-semibold">TOOL</th>
                  <th className="py-1.5 pr-2 font-semibold">TYPE</th>
                  <th className="py-1.5 pr-2 font-semibold text-right">CALLS</th>
                  <th className="py-1.5 pr-2 font-semibold text-right">LATENCY</th>
                  <th className="py-1.5 font-semibold text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-indigo-950/40">
                {tools.map((t) => (
                  <tr key={t.toolName} className="hover:bg-slate-50 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="py-2 pr-2">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/tools/${t.toolName}`}
                          className="font-bold text-slate-900 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate block max-w-[140px]"
                          title={t.toolName}
                        >
                          {t.toolName}
                        </Link>
                        <span className="text-[9px] text-slate-400 uppercase">{t.category}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          t.type === "WRITE"
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-900/50"
                            : "bg-slate-100 dark:bg-black/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-indigo-950"
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right font-semibold text-slate-800 dark:text-slate-200">
                      {t.callCount}
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-600 dark:text-slate-400">
                      {t.avgDurationMs > 0 ? `${t.avgDurationMs}ms` : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {t.errorRate === 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> 100%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                          <AlertTriangle className="h-3 w-3" /> {t.errorRate}% err
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-indigo-950/60">
        <Link
          href="/dashboard/tools"
          className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded border border-emerald-400/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:border-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all"
        >
          <Clock className="h-3.5 w-3.5" /> VIEW ALL TOOL INVOCATIONS
        </Link>
      </div>
    </div>
  );
}
