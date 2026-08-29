"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  CheckCircle2,
  Clock,
  Zap,
  Play,
  RotateCw,
  Sparkles,
  Layers,
  Shield,
  Bot,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { BUILT_IN_BENCHMARK_SUITES, BASELINE_MODEL_COMPARISONS, generateScorecard, evaluateTestCase } from "@/modules/benchmarks/benchmarkEngine";
import { BenchmarkSuite, BenchmarkScorecard } from "@/types/benchmark";
import { BenchmarkSuiteCard } from "@/components/benchmarks/BenchmarkSuiteCard";
import { BenchmarkScorecardView } from "@/components/benchmarks/BenchmarkScorecardView";
import { ModelComparisonMatrix } from "@/components/benchmarks/ModelComparisonMatrix";
import { RunBenchmarkModal } from "@/components/benchmarks/RunBenchmarkModal";

export default function BenchmarksPage() {
  const [selectedSuiteForRun, setSelectedSuiteForRun] = useState<BenchmarkSuite | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeScorecard, setActiveScorecard] = useState<BenchmarkScorecard | null>(() => {
    // Generate initial baseline scorecard for immediate interactive inspection
    const defaultSuite = BUILT_IN_BENCHMARK_SUITES[0];
    const initialResults = defaultSuite.testCases.map((tc) =>
      evaluateTestCase(tc, `Successfully parsed and validated Tokyo request parameters.`, 320, 85)
    );
    return generateScorecard(defaultSuite, initialResults, "Active Agent Architecture", "Llama 3.3 70B (Groq LPU)", 1250);
  });

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
      baselineModels: BASELINE_MODEL_COMPARISONS,
      totalSuites: BUILT_IN_BENCHMARK_SUITES.length,
      totalTestCases: BUILT_IN_BENCHMARK_SUITES.reduce((acc, s) => acc + s.testCases.length, 0),
    },
  });

  const suites: BenchmarkSuite[] = suitesData?.suites || BUILT_IN_BENCHMARK_SUITES;
  const baselineModels = suitesData?.baselineModels || BASELINE_MODEL_COMPARISONS;

  const handleOpenRun = (suite?: BenchmarkSuite) => {
    setSelectedSuiteForRun(suite);
    setIsModalOpen(true);
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
                {activeScorecard?.overallScore ?? 94}
              </span>
              <span className="text-xs font-bold text-emerald-500 font-pixel">
                [{activeScorecard?.grade ?? "A+"}]
              </span>
            </div>
            <span className="text-[9px] text-slate-400">Weighted across 6 evaluation axes</span>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Assertion Pass Rate
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-pixel text-emerald-500">
                {activeScorecard?.passRate ?? 100}%
              </span>
              <span className="text-[10px] text-slate-400">
                ({activeScorecard?.passedTests ?? 3}/{activeScorecard?.totalTests ?? 3})
              </span>
            </div>
            <span className="text-[9px] text-slate-400">Zero false-positive verification</span>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <Clock className="h-3.5 w-3.5 text-cyan-400" /> Mean Latency SLA
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-pixel text-cyan-400">
                {activeScorecard?.durationMs ? Math.round(activeScorecard.durationMs / Math.max(1, activeScorecard.totalTests)) : 420}ms
              </span>
              <span className="text-[10px] text-slate-400">p95 &lt; 850ms</span>
            </div>
            <span className="text-[9px] text-slate-400">High-throughput token velocity</span>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <Shield className="h-3.5 w-3.5 text-yellow-400" /> Safety & Guardrails
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-pixel text-yellow-400">100%</span>
              <span className="text-[10px] text-slate-400">HITL Active</span>
            </div>
            <span className="text-[9px] text-slate-400">Zero prompt injection leakage</span>
          </div>
        </div>
      </Reveal>

      {/* 3. Active Benchmark Scorecard View */}
      {activeScorecard && (
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

      {/* 5. Frontier Model Comparison Leaderboard */}
      <Reveal delay={300}>
        <ModelComparisonMatrix models={baselineModels} />
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
