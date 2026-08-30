"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  CheckCircle2,
  Clock,
  Play,
  RotateCw,
  Layers,
  Shield,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { BUILT_IN_BENCHMARK_SUITES } from "@/modules/benchmarks/benchmarkEngine";
import { BenchmarkSuite, BenchmarkScorecard, ModelBenchmarkComparisonItem } from "@/types/benchmark";
import { BenchmarkSuiteCard } from "@/components/benchmarks/BenchmarkSuiteCard";
import { BenchmarkScorecardView } from "@/components/benchmarks/BenchmarkScorecardView";
import { ModelComparisonMatrix } from "@/components/benchmarks/ModelComparisonMatrix";
import { RunBenchmarkModal } from "@/components/benchmarks/RunBenchmarkModal";

// Real, currently-configured free-tier models (see src/providers/llm/modelLists.ts)
// this app can actually call. The comparison below runs a real suite against each.
const COMPARISON_MODEL_IDS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "groq/compound-mini",
  "llama-3.1-8b-instant",
];

export default function BenchmarksPage() {
  const [selectedSuiteForRun, setSelectedSuiteForRun] = useState<BenchmarkSuite | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeScorecard, setActiveScorecard] = useState<BenchmarkScorecard | null>(null);
  const [comparisonModels, setComparisonModels] = useState<ModelBenchmarkComparisonItem[] | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const { data: suitesData, isLoading, refetch } = useQuery({
    queryKey: ["benchmarkSuites"],
    queryFn: async () => {
      const res = await fetch("/api/benchmarks/suites");
      if (!res.ok) throw new Error("Failed to load suites");
      const json = await res.json();
      return json.data;
    },
    initialData: {
      suites: BUILT_IN_BENCHMARK_SUITES,
      totalSuites: BUILT_IN_BENCHMARK_SUITES.length,
      totalTestCases: BUILT_IN_BENCHMARK_SUITES.reduce((acc, s) => acc + s.testCases.length, 0),
    },
  });

  const suites: BenchmarkSuite[] = suitesData?.suites || BUILT_IN_BENCHMARK_SUITES;

  const handleOpenRun = (suite?: BenchmarkSuite) => {
    setSelectedSuiteForRun(suite);
    setIsModalOpen(true);
  };

  const handleRunComparison = async () => {
    setIsComparing(true);
    setComparisonError(null);
    try {
      const res = await fetch("/api/benchmarks/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suiteId: suites[0]?.id, models: COMPARISON_MODEL_IDS }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Comparison failed");
      setComparisonModels(json.data);
    } catch (err) {
      setComparisonError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 w-full max-w-[1600px] mx-auto pb-12 font-mono">
      {/* 1. Header with Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-5">
        <Reveal delay={0}>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Award className="h-6 w-6 text-indigo-500 animate-pulse" />
              <h1 className="text-lg sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">
                AGENT EVALUATION & BENCHMARKING
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                ENTERPRISE EVAL
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              Rigorous multi-dimensional benchmarking for LLM reasoning, tool precision, RAG triad grounding & multi-agent swarms.
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refetch()}
              title="Refresh benchmarks"
              disabled={isLoading}
              className="p-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-white/80 dark:bg-black/50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 transition-all cursor-pointer shadow-sm"
            >
              <RotateCw className={`h-4 w-4 ${isLoading ? "animate-spin text-indigo-500" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => handleOpenRun()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-400 bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-all shadow-md cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" /> RUN BENCHMARK SUITE
            </button>
          </div>
        </Reveal>
      </div>

      {/* 2. Executive KPI Metrics Grid */}
      <Reveal delay={100}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <Award className="h-3.5 w-3.5 text-indigo-400" /> Overall Quality Index
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-pixel text-slate-900 dark:text-slate-100">
                {activeScorecard?.overallScore ?? "—"}
              </span>
              {activeScorecard && (
                <span className="text-xs font-bold text-emerald-500 font-pixel">[{activeScorecard.grade}]</span>
              )}
            </div>
            <span className="text-[9px] text-slate-400">
              {activeScorecard ? "Weighted across 6 evaluation axes" : "Run a benchmark suite to measure this"}
            </span>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Assertion Pass Rate
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-pixel text-emerald-500">
                {activeScorecard ? `${activeScorecard.passRate}%` : "—"}
              </span>
              {activeScorecard && (
                <span className="text-[10px] text-slate-400">
                  ({activeScorecard.passedTests}/{activeScorecard.totalTests})
                </span>
              )}
            </div>
            <span className="text-[9px] text-slate-400">Measured from actual assertion results</span>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <Clock className="h-3.5 w-3.5 text-cyan-400" /> Mean Latency
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-pixel text-cyan-400">
                {activeScorecard ? `${Math.round(activeScorecard.durationMs / Math.max(1, activeScorecard.totalTests))}ms` : "—"}
              </span>
            </div>
            <span className="text-[9px] text-slate-400">Wall-clock time from the real LLM calls</span>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <Shield className="h-3.5 w-3.5 text-yellow-400" /> Safety Compliance
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-pixel text-yellow-400">
                {activeScorecard ? `${activeScorecard.radar.safetyComplianceScore}%` : "—"}
              </span>
            </div>
            <span className="text-[9px] text-slate-400">
              {activeScorecard?.category === "SAFETY_GUARDRAILS"
                ? "Directly measured by this suite"
                : "Extrapolated from overall accuracy — run the Safety suite to measure directly"}
            </span>
          </div>
        </div>
      </Reveal>

      {/* 3. Active Benchmark Scorecard View */}
      {activeScorecard ? (
        <Reveal delay={200}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-indigo-400 font-bold tracking-wider">
                LATEST BENCHMARK SCORECARD:
              </span>
              <span className="text-[9px] text-slate-500 font-sans">
                Executed: {new Date(activeScorecard.executedAt).toLocaleTimeString()}
              </span>
            </div>
            <BenchmarkScorecardView scorecard={activeScorecard} />
          </div>
        </Reveal>
      ) : (
        <Reveal delay={200}>
          <div className="p-6 rounded-lg border border-dashed border-slate-300 dark:border-indigo-900/50 text-center text-xs text-slate-500 dark:text-slate-400">
            No benchmark has been run yet. Click "RUN BENCHMARK SUITE" above to execute real test cases against a live model.
          </div>
        </Reveal>
      )}

      {/* 4. Benchmark Suites Catalog Grid */}
      <Reveal delay={250}>
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                STANDARDIZED BENCHMARK SUITES ({suites.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">
              Select any suite to test live agent capabilities
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suites.map((suite) => (
              <BenchmarkSuiteCard
                key={suite.id}
                suite={suite}
                onRun={(s) => handleOpenRun(s)}
              />
            ))}
          </div>
        </div>
      </Reveal>

      {/* 5. Live-Measured Model Comparison */}
      <Reveal delay={300}>
        {comparisonModels ? (
          <div className="space-y-2">
            <ModelComparisonMatrix models={comparisonModels} />
            <button
              type="button"
              onClick={() => void handleRunComparison()}
              disabled={isComparing}
              className="text-[10px] font-mono text-indigo-500 hover:text-indigo-400 disabled:opacity-50 cursor-pointer"
            >
              {isComparing ? "Re-running…" : "Re-run comparison"}
            </button>
          </div>
        ) : (
          <div className="p-6 rounded-lg border border-dashed border-slate-300 dark:border-indigo-900/50 text-center space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Compare your configured models by actually running a benchmark suite against each of them —
              no static data, every score below will be freshly measured.
            </p>
            <button
              type="button"
              onClick={() => void handleRunComparison()}
              disabled={isComparing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-400 bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" /> {isComparing ? "RUNNING COMPARISON…" : "RUN MODEL COMPARISON"}
            </button>
            {comparisonError && <p className="text-[10px] text-red-500">{comparisonError}</p>}
          </div>
        )}
      </Reveal>

      {/* 6. Interactive Run Modal */}
      <RunBenchmarkModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        suites={suites}
        initialSuite={selectedSuiteForRun}
        onScorecardGenerated={(sc) => setActiveScorecard(sc)}
      />
    </div>
  );
}
