"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  DollarSign,
  Scale,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { EvalRunReport } from "@/types/evals";

interface EvalRunDetailsDrawerProps {
  report: EvalRunReport;
  onClose?: () => void;
}

export function EvalRunDetailsDrawer({ report, onClose }: EvalRunDetailsDrawerProps) {
  const [filter, setFilter] = useState<"ALL" | "PASSED" | "FAILED">("ALL");
  const [expandedVerdictId, setExpandedVerdictId] = useState<string | null>(
    report.verdicts[0]?.id || null
  );

  const filteredVerdicts = report.verdicts.filter((v) => {
    if (filter === "PASSED") return v.passed;
    if (filter === "FAILED") return !v.passed;
    return true;
  });

  return (
    <div className="p-6 rounded-xl border border-indigo-500/40 bg-white dark:bg-[#070709] font-mono space-y-6 shadow-2xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-indigo-950/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Scale className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {report.name}
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-sans">
            Dataset: <span className="font-bold text-indigo-400">{report.datasetName}</span> · Judge: <span className="font-mono text-slate-300">{report.judgeConfig.judgeModel.split("/").pop()}</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase">Overall Quality</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-pixel">
              {report.summary.overallScore}<span className="text-xs text-slate-500">/100</span>
            </span>
          </div>

          <div
            className={`px-4 py-2 rounded-lg border text-lg font-bold font-pixel tracking-wider shadow-md ${
              report.summary.overallScore >= 85
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                : report.summary.overallScore >= 70
                ? "bg-amber-500/20 text-amber-300 border-amber-400/50"
                : "bg-red-500/20 text-red-300 border-red-400/50"
            }`}
          >
            {report.summary.passRate}% PASS
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white p-1 rounded"
              title="Close report"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Regression & Quality Alerts */}
      {report.regressionAlerts.length > 0 && (
        <div className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold uppercase text-[11px]">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> MLOps Quality & SLA Alerts:
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] font-sans">
            {report.regressionAlerts.map((alert, i) => (
              <li key={i}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/50 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Pass Rate
          </span>
          <span className="text-base font-bold text-emerald-400">{report.summary.passRate}%</span>
          <span className="text-[8px] text-slate-400 block">
            {report.summary.passedItems}/{report.summary.totalItems} samples passed
          </span>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/50 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
            <Clock className="h-3 w-3 text-cyan-400" /> Avg Latency
          </span>
          <span className="text-base font-bold text-cyan-400">{report.summary.avgLatencyMs}ms</span>
          <span className="text-[8px] text-slate-400 block">P90: {report.summary.p90LatencyMs}ms</span>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/50 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
            <Zap className="h-3 w-3 text-yellow-400" /> Total Tokens
          </span>
          <span className="text-base font-bold text-yellow-400">
            {report.summary.totalTokens.toLocaleString()}
          </span>
          <span className="text-[8px] text-slate-400 block">Prompt & completion</span>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/50 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-violet-400" /> Estimated Cost
          </span>
          <span className="text-base font-bold text-violet-400">
            ${report.summary.estimatedCostUsd.toFixed(4)}
          </span>
          <span className="text-[8px] text-slate-400 block">Evaluation run cost</span>
        </div>
      </div>

      {/* Metric Breakdown Progress Bars */}
      <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/70 dark:bg-[#0a0a0c]/80 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
          LLM-as-a-Judge Metric Rubrics Performance
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {Object.entries(report.summary.metricSummaries).map(([metricKey, summary]) => {
            const pct = Math.round(summary.averageScore * 100);
            return (
              <div key={metricKey} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold">{metricKey}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {pct}% ({summary.passRate}% pass)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct >= 85
                        ? "bg-emerald-500"
                        : pct >= 70
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verdicts List with Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
            Sample Verdicts & Judge Chain-of-Thought ({filteredVerdicts.length})
          </h3>

          <div className="flex items-center gap-1 text-[10px]">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`px-2 py-0.5 rounded border ${
                filter === "ALL" ? "bg-indigo-600 text-white border-indigo-500" : "border-slate-300 dark:border-slate-800"
              }`}
            >
              ALL ({report.verdicts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("PASSED")}
              className={`px-2 py-0.5 rounded border ${
                filter === "PASSED" ? "bg-emerald-600 text-white border-emerald-500" : "border-slate-300 dark:border-slate-800"
              }`}
            >
              PASSED ({report.summary.passedItems})
            </button>
            <button
              type="button"
              onClick={() => setFilter("FAILED")}
              className={`px-2 py-0.5 rounded border ${
                filter === "FAILED" ? "bg-red-600 text-white border-red-500" : "border-slate-300 dark:border-slate-800"
              }`}
            >
              FAILED ({report.summary.failedItems})
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {filteredVerdicts.map((v, idx) => {
            const isExpanded = expandedVerdictId === v.id;
            return (
              <div
                key={v.id}
                className="rounded-lg border border-slate-200 dark:border-indigo-950/80 bg-white/60 dark:bg-black/60 overflow-hidden shadow-sm"
              >
                {/* Row Header */}
                <div
                  onClick={() => setExpandedVerdictId(isExpanded ? null : v.id)}
                  className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-indigo-950/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {v.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      #{idx + 1} {v.datasetItemId}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate max-w-md font-sans">
                      {typeof v.input === "string" ? v.input : JSON.stringify(v.input)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-bold text-indigo-400">
                      Score: {Math.round(v.overallScore * 100)}%
                    </span>
                    <span className="text-[9px] text-slate-400">{v.durationMs}ms</span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </div>
                </div>

                {/* Expanded Verdict Details with Judge CoT */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-200 dark:border-indigo-950/80 bg-slate-50/50 dark:bg-black/40 space-y-3 font-sans text-xs">
                    {/* Context & Ground Truth */}
                    {v.context && (
                      <div>
                        <span className="font-mono text-[9px] font-bold uppercase text-violet-400 block mb-0.5">
                          Retrieved Context:
                        </span>
                        <div className="p-2 rounded bg-violet-950/20 border border-violet-900/30 text-[11px] text-slate-300">
                          {Array.isArray(v.context) ? v.context.join("\n") : v.context}
                        </div>
                      </div>
                    )}

                    {/* Agent Output */}
                    <div>
                      <span className="font-mono text-[9px] font-bold uppercase text-cyan-400 block mb-0.5">
                        Agent Generated Output:
                      </span>
                      <div className="p-2.5 rounded bg-cyan-950/20 border border-cyan-900/30 text-[11px] text-slate-200 whitespace-pre-wrap">
                        {v.output}
                      </div>
                    </div>

                    {/* Reference Ground Truth */}
                    {v.groundTruth && (
                      <div>
                        <span className="font-mono text-[9px] font-bold uppercase text-emerald-400 block mb-0.5">
                          Golden Ground Truth Reference:
                        </span>
                        <div className="p-2 rounded bg-emerald-950/20 border border-emerald-900/30 text-[11px] text-emerald-300">
                          {v.groundTruth}
                        </div>
                      </div>
                    )}

                    {/* LLM-as-a-Judge CoT Reasoning for each metric */}
                    <div className="pt-2 space-y-2 border-t border-indigo-950/60 font-mono">
                      <span className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5">
                        <BrainCircuit className="h-3.5 w-3.5" /> LLM-as-a-Judge Reasoning & Rubrics:
                      </span>

                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(v.metrics).map(([mKey, res]) => (
                          <div
                            key={mKey}
                            className="p-2.5 rounded border border-indigo-950/80 bg-slate-900/40 space-y-1"
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-slate-200">{mKey}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  res.passed
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                    : "bg-red-950 text-red-300 border border-red-800"
                                }`}
                              >
                                {Math.round(res.score * 100)}% ({res.passed ? "PASS" : "FAIL"})
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-sans italic leading-relaxed">
                              {res.reasoning}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
