"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Scale,
  Database,
  Play,
  RotateCw,
  Award,
  CheckCircle2,
  GitCompare,
  AlertTriangle,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { EvalDataset, EvalRunReport } from "@/types/evals";
import { BUILT_IN_GOLDEN_DATASETS } from "@/modules/evals/datasetStore";
import { EvalDatasetsTab } from "@/components/evals/EvalDatasetsTab";
import { EvalRunModal } from "@/components/evals/EvalRunModal";
import { EvalRunDetailsDrawer } from "@/components/evals/EvalRunDetailsDrawer";
import { EvalComparisonView } from "@/components/evals/EvalComparisonView";

export default function EvalsPage() {
  const [activeTab, setActiveTab] = useState<"runs" | "datasets" | "compare">("runs");
  const [selectedDatasetForRun, setSelectedDatasetForRun] = useState<EvalDataset | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<EvalRunReport | null>(null);

  const { data: datasetsData, refetch: refetchDatasets } = useQuery({
    queryKey: ["evalDatasets"],
    queryFn: async () => {
      const res = await fetch("/api/evals/datasets");
      if (!res.ok) throw new Error("Failed to load datasets");
      const json = await res.json();
      return json.data as EvalDataset[];
    },
    initialData: BUILT_IN_GOLDEN_DATASETS,
  });

  const { data: runsData, isLoading: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ["evalRuns"],
    queryFn: async () => {
      const res = await fetch("/api/evals/runs");
      if (!res.ok) throw new Error("Failed to load runs");
      const json = await res.json();
      return json.data as EvalRunReport[];
    },
    initialData: [],
  });

  const datasets = datasetsData || BUILT_IN_GOLDEN_DATASETS;
  const runs = runsData || [];

  // Computed dynamic stats across all real evaluation runs
  const totalRuns = runs.length;
  const overallQualityIndex =
    totalRuns > 0
      ? Math.round(runs.reduce((acc, r) => acc + r.summary.overallScore, 0) / totalRuns)
      : null;
  const overallPassRate =
    totalRuns > 0
      ? Math.round(runs.reduce((acc, r) => acc + r.summary.passRate, 0) / totalRuns)
      : null;

  const faithfulnessScores = runs
    .map((r) => r.summary.metricSummaries?.FAITHFULNESS?.averageScore)
    .filter((s): s is number => typeof s === "number");
  const avgFaithfulness =
    faithfulnessScores.length > 0
      ? (
          (faithfulnessScores.reduce((a, b) => a + b, 0) / faithfulnessScores.length) *
          100
        ).toFixed(1) + "%"
      : null;

  const activeRegressionAlertsCount = runs.reduce(
    (acc, r) => acc + (r.regressionAlerts?.length || 0),
    0
  );
  const totalTestSamples = datasets.reduce((acc, d) => acc + (d.items?.length || 0), 0);

  const handleOpenRun = (dataset?: EvalDataset) => {
    setSelectedDatasetForRun(dataset);
    setIsModalOpen(true);
  };

  const handleRunCompleted = (report: EvalRunReport) => {
    setSelectedReport(report);
    refetchRuns();
  };

  return (
    <div className="space-y-6 sm:space-y-8 w-full max-w-[1600px] mx-auto pb-12 font-mono">
      {/* 1. Header with Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-5">
        <Reveal delay={0}>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Scale className="h-6 w-6 text-indigo-500 animate-pulse" />
              <h1 className="text-lg sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">
                AUTOMATED EVAL PIPELINES & LLM-AS-A-JUDGE
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                MLOPS EVALS
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              Batch evaluation against golden test datasets, multi-metric scoring (Faithfulness, Relevance, Correctness) & model drift detection.
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                refetchDatasets();
                refetchRuns();
              }}
              title="Refresh evals"
              disabled={runsLoading}
              className="p-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-white/80 dark:bg-black/50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 transition-all cursor-pointer shadow-sm"
            >
              <RotateCw className={`h-4 w-4 ${runsLoading ? "animate-spin text-indigo-500" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => handleOpenRun()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-400 bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-all shadow-md cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" /> RUN EVALUATION PIPELINE
            </button>
          </div>
        </Reveal>
      </div>

      {/* 2. Executive KPI Metrics Grid */}
      <Reveal delay={100}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <Award className="h-3.5 w-3.5 text-indigo-400" /> Evaluation Quality Index
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-pixel text-slate-900 dark:text-slate-100">
                {overallQualityIndex !== null ? `${overallQualityIndex}%` : "—"}
              </span>
              <span className="text-xs font-bold text-emerald-500 font-pixel">
                {overallPassRate !== null ? `[${overallPassRate}% Pass]` : "[No Runs]"}
              </span>
            </div>
            <span className="text-[9px] text-slate-400">
              {totalRuns > 0 ? `Aggregated across ${totalRuns} run(s)` : "Awaiting first evaluation run"}
            </span>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <Database className="h-3.5 w-3.5 text-cyan-400" /> Golden Datasets
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-pixel text-cyan-400">
                {datasets.length}
              </span>
              <span className="text-[10px] text-slate-400">
                ({totalTestSamples} Samples)
              </span>
            </div>
            <span className="text-[9px] text-slate-400">Curated ground truth collections</span>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Faithfulness SLA
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-pixel text-emerald-400">
                {avgFaithfulness !== null ? avgFaithfulness : "—"}
              </span>
              <span className="text-[10px] text-slate-400">Zero-Hallucination</span>
            </div>
            <span className="text-[9px] text-slate-400">Grounded context alignment</span>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" /> Regression Alerts
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-pixel text-yellow-400">
                {activeRegressionAlertsCount} Active
              </span>
              <span className="text-[10px] text-slate-400">
                {activeRegressionAlertsCount === 0 ? "Healthy SLA" : "Action Required"}
              </span>
            </div>
            <span className="text-[9px] text-slate-400">Continuous model monitoring</span>
          </div>
        </div>
      </Reveal>

      {/* 3. Navigation Tabs */}
      <Reveal delay={150}>
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-indigo-950/80 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("runs")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === "runs"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-white"
            }`}
          >
            EVALUATION RUNS ({runs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("datasets")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === "datasets"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-white"
            }`}
          >
            GOLDEN DATASETS ({datasets.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("compare")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "compare"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-white"
            }`}
          >
            <GitCompare className="h-3.5 w-3.5" /> REGRESSION COMPARATOR
          </button>
        </div>
      </Reveal>

      {/* 4. Tab Content */}
      {activeTab === "runs" && (
        <Reveal delay={200}>
          <div className="space-y-4">
            {selectedReport && (
              <EvalRunDetailsDrawer
                report={selectedReport}
                onClose={() => setSelectedReport(null)}
              />
            )}

            {runs.length === 0 && !selectedReport ? (
              <div className="p-8 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/60 dark:bg-black/40 text-center space-y-3">
                <Scale className="h-8 w-8 text-indigo-500 mx-auto" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  No automated evaluations executed yet
                </h4>
                <p className="text-[11px] text-slate-500 font-sans max-w-md mx-auto">
                  Launch an automated evaluation against a golden test dataset to measure Faithfulness, Answer Relevance, and Semantic Correctness with LLM-as-a-Judge.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenRun()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-400 bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-all shadow-md cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5" /> LAUNCH FIRST EVALUATION
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  HISTORICAL EVALUATION RUNS:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {runs.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedReport(r)}
                      className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0c]/80 hover:border-indigo-400 dark:hover:border-indigo-500/60 cursor-pointer transition-all space-y-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                          {r.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800 font-pixel">
                          {r.summary.overallScore}% ({r.summary.passRate}% PASS)
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 font-sans">
                        Dataset: <span className="text-slate-300 font-bold">{r.datasetName}</span> · Target: <span className="text-indigo-400">{r.targetName}</span>
                      </p>

                      <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{r.summary.totalItems} Samples Tested</span>
                        <span>Avg Latency: {r.summary.avgLatencyMs}ms</span>
                        <span className="text-indigo-400 font-bold">[ VIEW REPORT → ]</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Reveal>
      )}

      {activeTab === "datasets" && (
        <Reveal delay={200}>
          <EvalDatasetsTab
            datasets={datasets}
            onRunDataset={(ds) => handleOpenRun(ds)}
            onRefresh={() => refetchDatasets()}
          />
        </Reveal>
      )}

      {activeTab === "compare" && (
        <Reveal delay={200}>
          <EvalComparisonView runs={runs} />
        </Reveal>
      )}

      {/* 5. Launch Run Modal */}
      <EvalRunModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        datasets={datasets}
        initialDataset={selectedDatasetForRun}
        onRunCompleted={handleRunCompleted}
      />
    </div>
  );
}
