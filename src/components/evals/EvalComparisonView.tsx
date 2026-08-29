"use client";

import React, { useState, useEffect } from "react";
import { GitCompare, ArrowRight } from "lucide-react";
import { EvalRunReport, EvalRunComparisonReport } from "@/types/evals";

interface EvalComparisonViewProps {
  runs: EvalRunReport[];
}

export function EvalComparisonView({ runs }: EvalComparisonViewProps) {
  const [runAId, setRunAId] = useState<string>(runs[1]?.id || runs[0]?.id || "");
  const [runBId, setRunBId] = useState<string>(runs[0]?.id || "");
  const [comparison, setComparison] = useState<EvalRunComparisonReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!runAId || !runBId || runAId === runBId) {
      setComparison(null);
      return;
    }

    setLoading(true);
    fetch(`/api/evals/compare?runA=${runAId}&runB=${runBId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setComparison(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [runAId, runBId]);

  if (runs.length < 2) {
    return (
      <div className="p-8 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/60 dark:bg-black/40 text-center font-mono space-y-2">
        <GitCompare className="h-6 w-6 text-indigo-500 mx-auto" />
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
          At least 2 evaluation runs required for comparison
        </h4>
        <p className="text-[11px] text-slate-500 font-sans">
          Execute evaluations across different models or prompts to detect quality regressions and drift.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0c]/80 font-mono space-y-6 shadow-sm">
      {/* Selector Row */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-4">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 font-pixel">
            EVALUATION RUN COMPARISON & REGRESSION DETECTOR
          </h3>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto text-xs">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase font-bold block">Baseline Run (A):</span>
            <select
              value={runAId}
              onChange={(e) => setRunAId(e.target.value)}
              className="p-2 rounded border border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-black text-slate-800 dark:text-slate-200 font-mono text-[11px]"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.summary.overallScore}%)
                </option>
              ))}
            </select>
          </div>

          <ArrowRight className="h-4 w-4 text-slate-400 shrink-0 mt-4" />

          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase font-bold block">Candidate Run (B):</span>
            <select
              value={runBId}
              onChange={(e) => setRunBId(e.target.value)}
              className="p-2 rounded border border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-black text-slate-800 dark:text-slate-200 font-mono text-[11px]"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.summary.overallScore}%)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="text-xs text-slate-400 italic py-4">Computing regression deltas...</div>}

      {comparison && (
        <div className="space-y-5">
          {/* Key Deltas Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-950/80 bg-slate-50 dark:bg-black/50 space-y-1">
              <span className="text-[9px] text-slate-500 uppercase">Overall Quality Delta</span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold font-pixel ${
                    comparison.overallDelta >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {comparison.overallDelta >= 0 ? `+${comparison.overallDelta}%` : `${comparison.overallDelta}%`}
                </span>
                <span className="text-xs text-slate-400">
                  ({comparison.runA.summary.overallScore}% ➔ {comparison.runB.summary.overallScore}%)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-950/80 bg-slate-50 dark:bg-black/50 space-y-1">
              <span className="text-[9px] text-slate-500 uppercase">Pass Rate Delta</span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold font-pixel ${
                    comparison.passRateDelta >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {comparison.passRateDelta >= 0 ? `+${comparison.passRateDelta}%` : `${comparison.passRateDelta}%`}
                </span>
                <span className="text-xs text-slate-400">
                  ({comparison.runA.summary.passRate}% ➔ {comparison.runB.summary.passRate}%)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-950/80 bg-slate-50 dark:bg-black/50 space-y-1">
              <span className="text-[9px] text-slate-500 uppercase">Latency Delta</span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold font-pixel ${
                    comparison.latencyDeltaMs <= 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {comparison.latencyDeltaMs <= 0 ? `${comparison.latencyDeltaMs}ms` : `+${comparison.latencyDeltaMs}ms`}
                </span>
                <span className="text-xs text-slate-400">
                  ({comparison.runA.summary.avgLatencyMs}ms ➔ {comparison.runB.summary.avgLatencyMs}ms)
                </span>
              </div>
            </div>
          </div>

          {/* Metric-by-Metric Deltas */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-950/80 bg-white/60 dark:bg-black/40 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Metric-by-Metric Score Deltas
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {Object.entries(comparison.metricDeltas).map(([metricKey, delta]) => (
                <div
                  key={metricKey}
                  className="p-2.5 rounded border border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between"
                >
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{metricKey}</span>
                  <span
                    className={`font-bold font-pixel ${
                      delta >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {delta >= 0 ? `+${Math.round(delta * 100)}%` : `${Math.round(delta * 100)}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Key MLOps Findings */}
          {comparison.keyFindings.length > 0 && (
            <div className="p-4 rounded-lg border border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-2">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase">
                Automated Regression Insights:
              </span>
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700 dark:text-slate-300 font-sans">
                {comparison.keyFindings.map((finding, i) => (
                  <li key={i}>{finding}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
