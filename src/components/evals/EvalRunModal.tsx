"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Play, Loader2, Check, Database, Scale, Workflow, Network, Bot } from "lucide-react";
import { EvalDataset, EvalMetricType, EvalRunReport, EvalTargetType } from "@/types/evals";
import { SkillDTO } from "@/types/skill";
import { skillsApi } from "@/lib/api/skills";
import { ModelDropdown } from "@/components/common/ModelDropdown";

interface EvalRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasets: EvalDataset[];
  initialDataset?: EvalDataset;
  onRunCompleted: (report: EvalRunReport) => void;
}

const AVAILABLE_METRICS: { id: EvalMetricType; label: string; description: string }[] = [
  {
    id: "FAITHFULNESS",
    label: "Faithfulness & Zero-Hallucination",
    description: "Evaluates whether factual claims are strictly grounded in retrieved context.",
  },
  {
    id: "ANSWER_RELEVANCE",
    label: "Answer Relevance & Conciseness",
    description: "Checks if the agent directly addresses the user query without omitting key facts.",
  },
  {
    id: "SEMANTIC_CORRECTNESS",
    label: "Semantic Ground Truth Match",
    description: "Compares agent response against golden reference answers for factual alignment.",
  },
  {
    id: "SAFETY_POLICY",
    label: "Adversarial Safety & Policy Compliance",
    description: "Evaluates resistance to prompt injection and avoidance of dangerous commands.",
  },
  {
    id: "CONTEXT_PRECISION",
    label: "RAG Context Precision",
    description: "Measures signal-to-noise ratio of retrieved knowledge base chunks.",
  },
];

export function EvalRunModal({
  isOpen,
  onClose,
  datasets,
  initialDataset,
  onRunCompleted,
}: EvalRunModalProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    initialDataset?.id || datasets[0]?.id || ""
  );
  const [targetType, setTargetType] = useState<EvalTargetType>("MODEL");
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [targetModel, setTargetModel] = useState("meta-llama/llama-3.3-70b-versatile");
  const [judgeModel, setJudgeModel] = useState("meta-llama/llama-3.3-70b-versatile");
  const [selectedMetrics, setSelectedMetrics] = useState<EvalMetricType[]>([
    "FAITHFULNESS",
    "ANSWER_RELEVANCE",
    "SEMANTIC_CORRECTNESS",
    "SAFETY_POLICY",
  ]);
  const [threshold] = useState(0.75);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch real skills from database
  const { data: skillsData } = useQuery({
    queryKey: ["userSkillsForEval"],
    queryFn: () => skillsApi.list({}),
    enabled: isOpen,
  });

  const skills: SkillDTO[] = skillsData?.items || [];
  const activeSkills = skills.filter((s: SkillDTO) => s.status !== "ARCHIVED");
  const graphs = activeSkills.filter((s: SkillDTO) => {
    const version = s.publishedVersion ?? s.currentDraft;
    return Boolean(version?.graphDefinition && (version.graphDefinition.nodes?.length ?? 0) > 0);
  });

  if (!isOpen) return null;

  const toggleMetric = (metric: EvalMetricType) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
    );
  };

  const handleRun = async () => {
    if (selectedMetrics.length === 0) {
      setError("Please select at least one evaluation metric.");
      return;
    }

    setRunning(true);
    setError(null);

    let targetId = "default_target";
    let targetName = targetModel;

    if (targetType === "SKILL" || targetType === "GRAPH") {
      const candidates = targetType === "GRAPH" ? graphs : activeSkills;
      const found = candidates.find((s) => s.id === selectedSkillId) || candidates[0];
      if (found) {
        targetId = found.id;
        targetName = found.name;
      }
    }

    try {
      const res = await fetch("/api/evals/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: selectedDatasetId,
          targetType,
          targetId,
          targetName,
          targetModel,
          judgeConfig: {
            judgeModel,
            metrics: selectedMetrics,
            passThreshold: threshold,
          },
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Evaluation failed.");
      }

      onRunCompleted(json.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run evaluation pipeline");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn font-mono">
      <div className="relative w-full max-w-2xl rounded-xl border border-indigo-500/40 bg-white dark:bg-[#0a0a0c] shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-indigo-950/80 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 font-pixel">
              LAUNCH MLOPS AUTOMATED EVALUATION PIPELINE
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4 text-xs">
          {/* Target Dataset */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
              <Database className="h-3 w-3 text-indigo-400" /> Golden Test Dataset:
            </label>
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              disabled={running}
              className="w-full p-2.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-black/60 text-slate-900 dark:text-slate-100 font-mono"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  [{d.category}] {d.name} ({d.items.length} Samples)
                </option>
              ))}
            </select>
          </div>

          {/* Target Evaluated Entity Type */}
          <div className="space-y-2">
            <label className="text-[10px] text-slate-400 uppercase font-bold">
              Target Entity for Evaluation:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetType("MODEL")}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  targetType === "MODEL"
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-300 dark:border-indigo-950/80 bg-white/60 dark:bg-black/40 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Bot className="h-3.5 w-3.5" /> LLM Model
              </button>

              <button
                type="button"
                onClick={() => setTargetType("SKILL")}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  targetType === "SKILL"
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-300 dark:border-indigo-950/80 bg-white/60 dark:bg-black/40 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Workflow className="h-3.5 w-3.5" /> Skill Agent ({activeSkills.length})
              </button>

              <button
                type="button"
                onClick={() => setTargetType("GRAPH")}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  targetType === "GRAPH"
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-300 dark:border-indigo-950/80 bg-white/60 dark:bg-black/40 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Network className="h-3.5 w-3.5" /> Canvas Graph ({graphs.length})
              </button>
            </div>
          </div>

          {/* Entity Selection Details */}
          {targetType === "SKILL" && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold">
                Select Database Skill to Evaluate:
              </label>
              {activeSkills.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic">
                  No active skills found. Create a skill in Studio to evaluate it.
                </div>
              ) : (
                <select
                  value={selectedSkillId || activeSkills[0]?.id}
                  onChange={(e) => setSelectedSkillId(e.target.value)}
                  disabled={running}
                  className="w-full p-2.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-black/60 text-slate-900 dark:text-slate-100 font-mono"
                >
                  {activeSkills.map((s: SkillDTO) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {targetType === "GRAPH" && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold">
                Select Multi-Agent Canvas Graph:
              </label>
              {graphs.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic">
                  No canvas graphs found. Create a graph in Agent Canvas to evaluate it.
                </div>
              ) : (
                <select
                  value={selectedSkillId || graphs[0]?.id}
                  onChange={(e) => setSelectedSkillId(e.target.value)}
                  disabled={running}
                  className="w-full p-2.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-black/60 text-slate-900 dark:text-slate-100 font-mono"
                >
                  {graphs.map((g: SkillDTO) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Model & Judge Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold">
                Execution Model:
              </label>
              <ModelDropdown
                value={targetModel}
                onChange={(m) => setTargetModel(m)}
                disabled={running}
                showAutoRouter={false}
                showCustomOption={false}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold">
                LLM-as-a-Judge Model:
              </label>
              <ModelDropdown
                value={judgeModel}
                onChange={(m) => setJudgeModel(m)}
                disabled={running}
                showAutoRouter={false}
                showCustomOption={false}
              />
            </div>
          </div>

          {/* Metric Rubrics Selection */}
          <div className="space-y-2 pt-1">
            <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
              <span>Judge Evaluation Rubrics & Metrics:</span>
              <span className="text-indigo-400 font-normal">Pass Threshold: {Math.round(threshold * 100)}%</span>
            </label>

            <div className="space-y-2">
              {AVAILABLE_METRICS.map((m) => {
                const isSelected = selectedMetrics.includes(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => !running && toggleMetric(m.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? "border-indigo-500/80 bg-indigo-50/40 dark:bg-indigo-950/30"
                        : "border-slate-200 dark:border-indigo-950/60 bg-white/60 dark:bg-black/40 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "border-slate-400 dark:border-slate-700"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {m.label}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                        {m.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded border border-red-500/40 bg-red-950/30 text-red-300 text-[11px]">
              {error}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-indigo-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="px-4 py-2 rounded text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            CANCEL
          </button>

          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-indigo-400 bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> RUNNING LLM-AS-A-JUDGE EVALUATION...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> EXECUTE EVALUATION PIPELINE
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
