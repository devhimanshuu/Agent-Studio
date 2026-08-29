"use client";

import React, { useState } from "react";
import { X, Play, Loader2, Award, CheckCircle2 } from "lucide-react";
import { BenchmarkSuite, BenchmarkScorecard } from "@/types/benchmark";

interface RunBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  suites: BenchmarkSuite[];
  initialSuite?: BenchmarkSuite;
  onScorecardGenerated: (scorecard: BenchmarkScorecard) => void;
}

const AVAILABLE_MODELS = [
  { id: "meta-llama/llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq Fast LPU)" },
  { id: "gpt-4o", label: "GPT-4o (OpenAI)" },
  { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B (OpenRouter Free)" },
  { id: "groq/compound", label: "Groq Compound Autonomous Planner" },
  { id: "groq/llama-guard-3-8b", label: "Llama Guard 3 8B (Safety Specialization)" },
];

export function RunBenchmarkModal({
  isOpen,
  onClose,
  suites,
  initialSuite,
  onScorecardGenerated,
}: RunBenchmarkModalProps) {
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>(
    initialSuite?.id || suites[0]?.id || ""
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    initialSuite?.recommendedModel || AVAILABLE_MODELS[0].id
  );
  const [skillName, setSkillName] = useState("Agent Mission Control Graph");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSuite = suites.find((s) => s.id === selectedSuiteId) || suites[0];

  const handleRun = async () => {
    setRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/benchmarks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suiteId: selectedSuiteId,
          model: selectedModel,
          skillName,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Benchmark evaluation failed");
      }

      onScorecardGenerated(json.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run benchmark");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl rounded-xl border border-indigo-500/40 bg-white dark:bg-[#0a0a0c] font-mono shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-indigo-950/80 pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 font-pixel">
              LAUNCH AGENT BENCHMARK EVALUATION
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Configuration Form */}
        <div className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase font-bold">
              Select Benchmark Suite:
            </label>
            <select
              value={selectedSuiteId}
              onChange={(e) => setSelectedSuiteId(e.target.value)}
              disabled={running}
              className="w-full p-2.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-black/60 text-slate-900 dark:text-slate-100 font-mono"
            >
              {suites.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.badge}] {s.name} ({s.testCases.length} Tests)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase font-bold">
              Target Evaluation Model:
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={running}
              className="w-full p-2.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-black/60 text-slate-900 dark:text-slate-100 font-mono"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase font-bold">
              Agent / Architecture Label:
            </label>
            <input
              type="text"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              disabled={running}
              className="w-full p-2 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-black/60 text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>

          {/* Test Case Overview Card */}
          {currentSuite && (
            <div className="p-3.5 rounded-lg border border-indigo-950/80 bg-slate-900/40 space-y-2">
              <div className="text-[10px] text-indigo-300 font-bold uppercase">
                Included Test Assertions ({currentSuite.testCases.length}):
              </div>
              <ul className="space-y-1 text-[10px] text-slate-400">
                {currentSuite.testCases.map((tc) => (
                  <li key={tc.id} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-indigo-400" />
                    <span>{tc.name}</span>
                    <span className="text-[8px] text-slate-500">({tc.difficulty})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> EXECUTING SUITE...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> RUN BENCHMARK EVALUATION
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
