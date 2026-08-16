"use client";

import React from "react";
import { X, Plus, Minus, Pencil, GitBranch, CheckCircle2 } from "lucide-react";
import { GraphDiff } from "./graphDiff";

interface GraphDiffModalProps {
  diff: GraphDiff;
  baseLabel: string;
  onClose: () => void;
}

function Section({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className={`text-[9px] font-bold uppercase tracking-widest ${tone}`}>{title} ({items.length})</div>
      <div className="space-y-0.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[9px] font-mono text-slate-700 dark:text-slate-300">
            <span className="shrink-0">{icon}</span>
            <span className="truncate">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GraphDiffModal({ diff, baseLabel, onClose }: GraphDiffModalProps) {
  const total = diff.addedNodes.length + diff.removedNodes.length + diff.changedNodes.length + diff.addedEdges.length + diff.removedEdges.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] p-5 font-mono shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400/80 font-bold flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" /> VERSION DIFF vs {baseLabel.toUpperCase()}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {total === 0 ? (
          <div className="flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="h-4 w-4" /> No differences — the working graph matches {baseLabel}.
          </div>
        ) : (
          <div className="space-y-3">
            <Section icon={<Plus className="h-3 w-3 text-emerald-500" />} title="Added nodes" items={diff.addedNodes.map((n) => `[${n.type}] ${n.label} (${n.id})`)} tone="text-emerald-600 dark:text-emerald-400" />
            <Section icon={<Minus className="h-3 w-3 text-red-500" />} title="Removed nodes" items={diff.removedNodes.map((n) => `[${n.type}] ${n.label} (${n.id})`)} tone="text-red-600 dark:text-red-400" />
            <Section icon={<Pencil className="h-3 w-3 text-amber-500" />} title="Changed nodes" items={diff.changedNodes.map((n) => `${n.label} — ${n.fields.join(", ")}`)} tone="text-amber-600 dark:text-amber-400" />
            <Section icon={<Plus className="h-3 w-3 text-cyan-500" />} title="Added edges" items={diff.addedEdges.map((e) => `${e.source} → ${e.target}${e.label ? ` [${e.label}]` : ""}`)} tone="text-cyan-600 dark:text-cyan-400" />
            <Section icon={<Minus className="h-3 w-3 text-orange-500" />} title="Removed edges" items={diff.removedEdges.map((e) => `${e.source} → ${e.target}${e.label ? ` [${e.label}]` : ""}`)} tone="text-orange-600 dark:text-orange-400" />
          </div>
        )}
      </div>
    </div>
  );
}
