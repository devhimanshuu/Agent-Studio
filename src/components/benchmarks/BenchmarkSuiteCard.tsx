"use client";

import React from "react";
import { Play, CheckCircle2, Shield, Wrench, Network, Database, Zap, ArrowRight } from "lucide-react";
import { BenchmarkSuite, BenchmarkCategory } from "@/types/benchmark";

interface BenchmarkSuiteCardProps {
  suite: BenchmarkSuite;
  onRun: (suite: BenchmarkSuite) => void;
  isRunning?: boolean;
}

function getCategoryIcon(cat: BenchmarkCategory) {
  switch (cat) {
    case "TOOL_CALLING":
      return <Wrench className="h-4 w-4 text-emerald-400" />;
    case "MULTI_AGENT_MESH":
      return <Network className="h-4 w-4 text-violet-400" />;
    case "RAG_GROUNDING":
      return <Database className="h-4 w-4 text-cyan-400" />;
    case "SAFETY_GUARDRAILS":
      return <Shield className="h-4 w-4 text-amber-400" />;
    case "PERFORMANCE_COST":
      return <Zap className="h-4 w-4 text-yellow-400" />;
    default:
      return <CheckCircle2 className="h-4 w-4 text-indigo-400" />;
  }
}

export function BenchmarkSuiteCard({ suite, onRun, isRunning }: BenchmarkSuiteCardProps) {
  return (
    <div className="p-5 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 font-mono space-y-4 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all flex flex-col justify-between shadow-sm">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getCategoryIcon(suite.category)}
            <span className="text-[9px] px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider">
              {suite.badge}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-sans font-semibold">
            {suite.testCases.length} Test Cases
          </span>
        </div>

        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
          {suite.name}
        </h3>

        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed line-clamp-3">
          {suite.description}
        </p>

        {/* Test Case Badges Preview */}
        <div className="pt-1.5 flex flex-wrap gap-1">
          {suite.testCases.map((tc) => (
            <span
              key={tc.id}
              className="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 truncate max-w-[130px]"
              title={tc.name}
            >
              {tc.name}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
          Rec: {suite.recommendedModel?.split("/").pop()}
        </span>
        <button
          type="button"
          onClick={() => onRun(suite)}
          disabled={isRunning}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-400 bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-500 transition-all shadow-sm cursor-pointer disabled:opacity-50"
        >
          {isRunning ? (
            <span>RUNNING...</span>
          ) : (
            <>
              <Play className="h-3 w-3" /> RUN SUITE <ArrowRight className="h-3 w-3" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
