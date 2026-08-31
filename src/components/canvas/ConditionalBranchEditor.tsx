"use client";

import React, { useState, useCallback } from "react";
import {
  GitBranch,
  Plus,
  X,
  ArrowRight,
  Bot,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import { ConditionExpressionEditor } from "./ConditionExpressionEditor";

interface Branch {
  id: string;
  label: string;
  condition?: string;
  isDefault?: boolean;
}

interface ConditionalBranchEditorProps {
  /** Current router mode. */
  routerMode: "deterministic" | "ai";
  /** Current condition expression (deterministic mode). */
  condition: string;
  /** Current router prompt (AI mode). */
  routerPrompt: string;
  /** Outgoing branches (edges with labels) from this node. */
  branches: Branch[];
  /** Called when the user modifies any branch config. */
  onUpdate: (patch: {
    routerMode?: "deterministic" | "ai";
    condition?: string;
    routerPrompt?: string;
    branches?: Branch[];
  }) => void;
  /** Available outgoing edge labels for autocomplete. */
  edgeLabels?: string[];
  /** Node IDs in the graph for autocomplete and validation. */
  allNodeIds?: string[];
  /** Whether this is read-only (trace mode). */
  readOnly?: boolean;
}

export function ConditionalBranchEditor({
  routerMode,
  condition,
  routerPrompt,
  branches,
  onUpdate,
  edgeLabels: _edgeLabels = [],
  allNodeIds = [],
  readOnly = false,
}: ConditionalBranchEditorProps) {
  const [expanded, setExpanded] = useState(true);
  const [newBranchLabel, setNewBranchLabel] = useState("");

  const addBranch = useCallback(() => {
    if (!newBranchLabel.trim()) return;
    const branch: Branch = {
      id: `branch_${Date.now()}`,
      label: newBranchLabel.trim(),
      condition: routerMode === "deterministic" ? `results.classifier.decision == "${newBranchLabel.trim()}"` : undefined,
    };
    onUpdate({ branches: [...branches, branch] });
    setNewBranchLabel("");
  }, [newBranchLabel, branches, routerMode, onUpdate]);

  const removeBranch = useCallback(
    (branchId: string) => {
      onUpdate({ branches: branches.filter((b) => b.id !== branchId) });
    },
    [branches, onUpdate]
  );

  const updateBranch = useCallback(
    (branchId: string, patch: Partial<Branch>) => {
      onUpdate({
        branches: branches.map((b) => (b.id === branchId ? { ...b, ...patch } : b)),
      });
    },
    [branches, onUpdate]
  );

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700/60 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3 w-3 text-amber-500" />
          <span className="text-[9px] uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold">
            BRANCHING CONFIG
          </span>
          <span className="text-[8px] text-slate-400 font-mono">
            ({branches.length} branch{branches.length !== 1 ? "es" : ""})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-slate-400" />
        ) : (
          <ChevronDown className="h-3 w-3 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* Mode Toggle */}
          <div className="space-y-1">
            <label className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">Mode</label>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => onUpdate({ routerMode: "deterministic" })}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                  routerMode === "deterministic"
                    ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-amber-300",
                  readOnly && "opacity-50 cursor-not-allowed"
                )}
              >
                <Zap className="h-2.5 w-2.5" /> CONDITION
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => onUpdate({ routerMode: "ai" })}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                  routerMode === "ai"
                    ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-violet-300",
                  readOnly && "opacity-50 cursor-not-allowed"
                )}
              >
                <Bot className="h-2.5 w-2.5" /> AI ROUTER
              </button>
            </div>
          </div>

          {/* Condition / Prompt Input */}
          {routerMode === "deterministic" ? (
            <ConditionExpressionEditor
              value={condition}
              onChange={(v) => onUpdate({ condition: v })}
              readOnly={readOnly}
              allNodeIds={allNodeIds}
            />
          ) : (
            <div className="space-y-1">
              <label className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">
                AI ROUTER PROMPT
              </label>
              <textarea
                value={routerPrompt}
                onChange={(e) => onUpdate({ routerPrompt: e.target.value })}
                readOnly={readOnly}
                rows={3}
                placeholder="Describe how the AI should choose between branches…"
                className={clsx(
                  "w-full rounded border px-2.5 py-1.5 text-[10px] font-mono resize-y focus:outline-none transition-colors",
                  readOnly
                    ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400"
                    : "border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-violet-500"
                )}
              />
              <p className="text-[7px] text-slate-400 dark:text-slate-500 leading-tight">
                The LLM will pick one of the branch labels below as its decision.
              </p>
            </div>
          )}

          {/* Branches */}
          <div className="space-y-1.5">
            <label className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">
              OUTGOING BRANCHES
            </label>
            {branches.length === 0 && (
              <div className="flex items-center gap-1.5 p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700/30">
                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="text-[8px] text-amber-700 dark:text-amber-300">
                  No branches defined. Add at least one outgoing branch.
                </span>
              </div>
            )}
            {branches.map((branch, idx) => (
              <div
                key={branch.id}
                className="flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#0a0a0a]/60 group"
              >
                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] text-slate-400 font-bold shrink-0">#{idx + 1}</span>
                    <input
                      value={branch.label}
                      onChange={(e) => updateBranch(branch.id, { label: e.target.value })}
                      readOnly={readOnly}
                      placeholder="branch-label"
                      className="flex-1 min-w-0 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1.5 py-0.5 text-[10px] font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    {routerMode === "deterministic" && (
                      <ConditionExpressionEditor
                        value={branch.condition ?? ""}
                        onChange={(v) => updateBranch(branch.id, { condition: v })}
                        readOnly={readOnly}
                        allNodeIds={allNodeIds}
                      />
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeBranch(branch.id)}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 transition-all cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Add Branch */}
            {!readOnly && (
              <div className="flex items-center gap-1.5">
                <input
                  value={newBranchLabel}
                  onChange={(e) => setNewBranchLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addBranch();
                  }}
                  placeholder="new branch label…"
                  className="flex-1 rounded border border-dashed border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-[9px] font-mono text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={addBranch}
                  disabled={!newBranchLabel.trim()}
                  className="p-1 rounded border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:text-indigo-500 hover:border-indigo-400 transition-colors cursor-pointer disabled:opacity-30"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Visual Preview */}
          {branches.length > 0 && (
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[8px] uppercase tracking-widest text-slate-400 font-bold mb-1.5 block">
                VISUAL PREVIEW
              </label>
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                <div className="shrink-0 px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900/40 text-[8px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50">
                  ROUTER
                </div>
                <div className="text-slate-300 dark:text-slate-600">→</div>
                {branches.map((branch, idx) => (
                  <React.Fragment key={branch.id}>
                    <div className="shrink-0 px-2 py-1 rounded border text-[8px] font-bold">
                      {idx === 0 ? (
                        <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50">
                          {branch.label || "—"}
                        </span>
                      ) : idx === 1 ? (
                        <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/50">
                          {branch.label || "—"}
                        </span>
                      ) : (
                        <span className="bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700/50">
                          {branch.label || "—"}
                        </span>
                      )}
                    </div>
                    {idx < branches.length - 1 && (
                      <span className="text-slate-300 dark:text-slate-600 text-[8px]">·</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
