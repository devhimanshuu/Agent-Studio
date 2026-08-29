"use client";

import React from "react";
import { CheckCircle2, XCircle, Award, Gauge, Sparkles, Clock, Zap, Cpu, X, Check } from "lucide-react";
import { BenchmarkScorecard } from "@/types/benchmark";

interface BenchmarkScorecardViewProps {
  scorecard: BenchmarkScorecard;
  onClose?: () => void;
}

function getGradeBadgeColor(grade: string) {
  switch (grade) {
    case "A+":
    case "A":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-400/50";
    case "B":
      return "bg-cyan-500/20 text-cyan-300 border-cyan-400/50";
    case "C":
      return "bg-amber-500/20 text-amber-300 border-amber-400/50";
    default:
      return "bg-red-500/20 text-red-300 border-red-400/50";
  }
}

export function BenchmarkScorecardView({ scorecard, onClose }: BenchmarkScorecardViewProps) {
  const radarItems = [
    { label: "Accuracy & Intent Grounding", value: scorecard.radar.accuracyScore, color: "bg-emerald-500" },
    { label: "Tool Calling Precision", value: scorecard.radar.toolPrecisionScore, color: "bg-cyan-500" },
    { label: "Latency & Throughput SLA", value: scorecard.radar.latencyScore, color: "bg-yellow-500" },
    { label: "Token & Cost Efficiency", value: scorecard.radar.costEfficiencyScore, color: "bg-indigo-500" },
    { label: "Safety & HITL Compliance", value: scorecard.radar.safetyComplianceScore, color: "bg-violet-500" },
    { label: "Multi-Agent Swarm Cohesion", value: scorecard.radar.multiAgentCohesionScore, color: "bg-pink-500" },
  ];

  return (
    <div className="p-6 rounded-xl border border-indigo-500/40 bg-white dark:bg-[#070709] font-mono space-y-6 shadow-2xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-indigo-950/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Award className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {scorecard.suiteName}
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-sans">
            Target Evaluated: <span className="font-bold text-indigo-400">{scorecard.skillName}</span> · Model: <span className="font-mono text-slate-300">{scorecard.modelEvaluated}</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase">Overall Quality</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-pixel">
              {scorecard.overallScore}<span className="text-xs text-slate-500">/100</span>
            </span>
          </div>

          <div
            className={`px-4 py-2 rounded-lg border text-xl font-bold font-pixel tracking-wider shadow-md ${getGradeBadgeColor(
              scorecard.grade
            )}`}
          >
            {scorecard.grade}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white p-1 rounded"
              title="Close scorecard"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/50 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Pass Rate
          </span>
          <span className="text-base font-bold text-emerald-400">{scorecard.passRate}%</span>
          <span className="text-[8px] text-slate-400 block">
            {scorecard.passedTests}/{scorecard.totalTests} tests passed
          </span>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/50 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
            <Clock className="h-3 w-3 text-cyan-400" /> Total Duration
          </span>
          <span className="text-base font-bold text-cyan-400">
            {(scorecard.durationMs / 1000).toFixed(2)}s
          </span>
          <span className="text-[8px] text-slate-400 block">End-to-end benchmark run</span>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/50 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
            <Zap className="h-3 w-3 text-yellow-400" /> Avg Latency
          </span>
          <span className="text-base font-bold text-yellow-400">
            {Math.round(scorecard.durationMs / Math.max(1, scorecard.totalTests))}ms
          </span>
          <span className="text-[8px] text-slate-400 block">Per assertion cycle</span>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/50 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
            <Cpu className="h-3 w-3 text-violet-400" /> Model Target
          </span>
          <span className="text-xs font-bold text-violet-300 truncate block">
            {scorecard.modelEvaluated.split("/").pop()}
          </span>
          <span className="text-[8px] text-slate-400 block">Evaluated endpoint</span>
        </div>
      </div>

      {/* Radar Dimension Breakdown */}
      <div className="space-y-3 p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/70 dark:bg-[#0a0a0c]/80">
        <div className="flex items-center gap-2 border-b border-indigo-950/60 pb-2">
          <Gauge className="h-4 w-4 text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
            Multi-Dimensional Radar Metrics
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {radarItems.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{item.value}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full transition-all duration-500`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Case Execution Breakdown */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Test Case Assertions & Telemetry ({scorecard.testResults.length})
        </h3>

        <div className="space-y-2">
          {scorecard.testResults.map((t, idx) => (
            <div
              key={t.testCaseId}
              className="p-3 rounded-lg border border-slate-200 dark:border-indigo-950/80 bg-white/60 dark:bg-black/60 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {t.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    #{idx + 1} {t.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span>{t.durationMs}ms</span>
                  <span>·</span>
                  <span>{t.tokensUsed} tokens</span>
                  <span>·</span>
                  <span className="text-cyan-400 font-bold">{t.tokensPerSec} tok/s</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      t.passed
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                        : "bg-red-950/80 text-red-300 border border-red-800/60"
                    }`}
                  >
                    {t.passed ? "PASSED" : "FAILED"}
                  </span>
                </div>
              </div>

              {/* Assertions List */}
              <div className="pl-6 space-y-1 text-[10px]">
                {t.assertions.map((a, aIdx) => (
                  <div key={aIdx} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    {a.passed ? (
                      <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : (
                      <X className="h-3 w-3 text-red-400 shrink-0" />
                    )}
                    <span>{a.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actionable Recommendations */}
      {scorecard.recommendations.length > 0 && (
        <div className="p-4 rounded-lg border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-2">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase">
            <Sparkles className="h-4 w-4" /> AI Architectural Recommendations
          </div>
          <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-700 dark:text-slate-300 font-sans">
            {scorecard.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
