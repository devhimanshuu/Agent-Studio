"use client";

import React from "react";
import { Clock, Layers } from "lucide-react";
import { ModelBenchmarkComparisonItem } from "@/types/benchmark";

interface ModelComparisonMatrixProps {
  models: ModelBenchmarkComparisonItem[];
}

export function ModelComparisonMatrix({ models }: ModelComparisonMatrixProps) {
  return (
    <div className="p-5 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 font-mono space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950/80 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
            CONFIGURED MODEL COMPARISON MATRIX
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 font-sans">
          Live-measured by actually running the suite against each model
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-indigo-950/60 pb-2">
              <th className="py-2 pr-4 font-semibold">MODEL / PROVIDER</th>
              <th className="py-2 pr-4 font-semibold text-center">GRADE</th>
              <th className="py-2 pr-4 font-semibold text-right">QUALITY SCORE</th>
              <th className="py-2 pr-4 font-semibold text-right">PASS RATE</th>
              <th className="py-2 pr-4 font-semibold text-right">AVG LATENCY</th>
              <th className="py-2 pr-4 font-semibold text-right">EST. COST / 1K</th>
              <th className="py-2 font-semibold">CORE STRENGTHS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-indigo-950/40">
            {models.map((m) => (
              <tr key={m.modelName} className="hover:bg-slate-50 dark:hover:bg-indigo-950/20 transition-colors">
                <td className="py-3 pr-4">
                  <div className="font-bold text-slate-900 dark:text-slate-100">{m.modelName}</div>
                  <span className="text-[9px] text-slate-400">{m.provider}</span>
                </td>
                <td className="py-3 pr-4 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-pixel border ${m.grade === "A+" || m.grade === "A"
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/50"
                        : "bg-cyan-950/80 text-cyan-300 border-cyan-700/50"
                      }`}
                  >
                    {m.grade}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right font-bold text-slate-900 dark:text-slate-100 font-pixel">
                  {m.overallScore}%
                </td>
                <td className="py-3 pr-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                  {m.passRate}%
                </td>
                <td className="py-3 pr-4 text-right text-yellow-600 dark:text-yellow-400">
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="h-3 w-3 inline" /> {m.avgLatencyMs}ms
                  </span>
                </td>
                <td className="py-3 pr-4 text-right text-cyan-600 dark:text-cyan-400 font-mono">
                  ${m.costPer1kRuns.toFixed(2)}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {m.strengths.slice(0, 2).map((s, i) => (
                      <span
                        key={i}
                        className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
