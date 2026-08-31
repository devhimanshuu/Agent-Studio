"use client";

import React, { useState } from "react";
import { X, Plus, Minus, Pencil, GitBranch, CheckCircle2, LayoutGrid, List, ArrowRight } from "lucide-react";
import { GraphDiff } from "./graphDiff";
import { clsx } from "clsx";
import { CANVAS_NODE_TYPE_MAP } from "./nodeTypes";
import { GraphNodeType } from "@/types/graph";

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

function DiffNodeCard({ type, label, status, details }: { type: string; label: string; status: "added" | "removed" | "changed"; details?: string }) {
  const meta = CANVAS_NODE_TYPE_MAP[type as GraphNodeType];
  const Icon = meta?.icon;

  const statusConfig = {
    added: {
      border: "border-emerald-400 dark:border-emerald-500/60",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      badge: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50",
      icon: <Plus className="h-2 w-2" />,
      label: "ADDED",
    },
    removed: {
      border: "border-red-400 dark:border-red-500/60",
      bg: "bg-red-50 dark:bg-red-950/30",
      badge: "bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/50",
      icon: <Minus className="h-2 w-2" />,
      label: "REMOVED",
    },
    changed: {
      border: "border-amber-400 dark:border-amber-500/60",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      badge: "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/50",
      icon: <Pencil className="h-2 w-2" />,
      label: "CHANGED",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={clsx("flex items-center gap-2 p-2 rounded-lg border transition-all", config.border, config.bg)}>
      <div className="shrink-0">
        {Icon ? (
          <Icon className={clsx("h-3.5 w-3.5", meta?.accent?.split(" ")[1] ?? "text-slate-400")} />
        ) : (
          <div className="h-3.5 w-3.5 rounded bg-slate-200 dark:bg-slate-700" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100 truncate">{label}</span>
          <span className="text-[7px] text-slate-400 font-mono">[{type}]</span>
        </div>
        {details && (
          <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {details}
          </div>
        )}
      </div>
      <span className={clsx("shrink-0 px-1.5 py-0.5 rounded border text-[7px] font-bold inline-flex items-center gap-0.5", config.badge)}>
        {config.icon}
        {config.label}
      </span>
    </div>
  );
}

function DiffEdgeCard({ source, target, label, status }: { source: string; target: string; label?: string; status: "added" | "removed" }) {
  const statusConfig = {
    added: {
      border: "border-cyan-300 dark:border-cyan-500/50",
      bg: "bg-cyan-50 dark:bg-cyan-950/20",
      badge: "bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300",
      label: "NEW",
    },
    removed: {
      border: "border-orange-300 dark:border-orange-500/50",
      bg: "bg-orange-50 dark:bg-orange-950/20",
      badge: "bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300",
      label: "DEL",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={clsx("flex items-center gap-1.5 p-1.5 rounded border text-[9px] font-mono", config.border, config.bg)}>
      <span className="text-slate-600 dark:text-slate-400 truncate">{source}</span>
      <ArrowRight className="h-2.5 w-2.5 text-slate-400 shrink-0" />
      <span className="text-slate-600 dark:text-slate-400 truncate">{target}</span>
      {label && (
        <span className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[7px] text-slate-500 dark:text-slate-400 shrink-0">
          [{label}]
        </span>
      )}
      <span className={clsx("ml-auto shrink-0 px-1 py-0.5 rounded text-[7px] font-bold", config.badge)}>
        {config.label}
      </span>
    </div>
  );
}

export function GraphDiffModal({ diff, baseLabel, onClose }: GraphDiffModalProps) {
  const [viewMode, setViewMode] = useState<"visual" | "list">("visual");
  const total = diff.addedNodes.length + diff.removedNodes.length + diff.changedNodes.length + diff.addedEdges.length + diff.removedEdges.length;

  const hasNodes = diff.addedNodes.length + diff.removedNodes.length + diff.changedNodes.length > 0;
  const hasEdges = diff.addedEdges.length + diff.removedEdges.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] font-mono shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="text-[10px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400/80 font-bold flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" /> VERSION DIFF
            </div>
            <span className="text-[9px] text-slate-500">vs {baseLabel.toUpperCase()}</span>
            {total > 0 && (
              <div className="flex items-center gap-1">
                {diff.addedNodes.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[8px] font-bold">
                    +{diff.addedNodes.length}
                  </span>
                )}
                {diff.removedNodes.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[8px] font-bold">
                    -{diff.removedNodes.length}
                  </span>
                )}
                {diff.changedNodes.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[8px] font-bold">
                    ~{diff.changedNodes.length}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("visual")}
                className={clsx(
                  "p-1 transition-colors cursor-pointer",
                  viewMode === "visual"
                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                )}
                title="Visual diff view"
              >
                <LayoutGrid className="h-3 w-3" />
              </button>
              <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={clsx(
                  "p-1 transition-colors cursor-pointer",
                  viewMode === "list"
                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                )}
                title="Compact list view"
              >
                <List className="h-3 w-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {total === 0 ? (
            <div className="flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold py-8 justify-center">
              <CheckCircle2 className="h-5 w-5" /> No differences — the working graph matches {baseLabel}.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Node Changes */}
              {hasNodes && (
                <div className="space-y-2">
                  <div className="text-[9px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-bold">
                    NODE CHANGES
                  </div>
                  {viewMode === "visual" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {diff.addedNodes.map((n) => (
                        <DiffNodeCard key={`added-${n.id}`} type={n.type} label={n.label} status="added" details={n.id} />
                      ))}
                      {diff.removedNodes.map((n) => (
                        <DiffNodeCard key={`removed-${n.id}`} type={n.type} label={n.label} status="removed" details={n.id} />
                      ))}
                      {diff.changedNodes.map((n) => (
                        <DiffNodeCard
                          key={`changed-${n.id}`}
                          type="agent"
                          label={n.label}
                          status="changed"
                          details={`Modified: ${n.fields.join(", ")}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Section icon={<Plus className="h-3 w-3 text-emerald-500" />} title="Added nodes" items={diff.addedNodes.map((n) => `[${n.type}] ${n.label} (${n.id})`)} tone="text-emerald-600 dark:text-emerald-400" />
                      <Section icon={<Minus className="h-3 w-3 text-red-500" />} title="Removed nodes" items={diff.removedNodes.map((n) => `[${n.type}] ${n.label} (${n.id})`)} tone="text-red-600 dark:text-red-400" />
                      <Section icon={<Pencil className="h-3 w-3 text-amber-500" />} title="Changed nodes" items={diff.changedNodes.map((n) => `${n.label} — ${n.fields.join(", ")}`)} tone="text-amber-600 dark:text-amber-400" />
                    </div>
                  )}
                </div>
              )}

              {/* Edge Changes */}
              {hasEdges && (
                <div className="space-y-2">
                  <div className="text-[9px] uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-bold">
                    EDGE CHANGES
                  </div>
                  {viewMode === "visual" ? (
                    <div className="space-y-1">
                      {diff.addedEdges.map((e, i) => (
                        <DiffEdgeCard key={`added-e-${i}`} source={e.source} target={e.target} label={e.label} status="added" />
                      ))}
                      {diff.removedEdges.map((e, i) => (
                        <DiffEdgeCard key={`removed-e-${i}`} source={e.source} target={e.target} label={e.label} status="removed" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Section icon={<Plus className="h-3 w-3 text-cyan-500" />} title="Added edges" items={diff.addedEdges.map((e) => `${e.source} → ${e.target}${e.label ? ` [${e.label}]` : ""}`)} tone="text-cyan-600 dark:text-cyan-400" />
                      <Section icon={<Minus className="h-3 w-3 text-orange-500" />} title="Removed edges" items={diff.removedEdges.map((e) => `${e.source} → ${e.target}${e.label ? ` [${e.label}]` : ""}`)} tone="text-orange-600 dark:text-orange-400" />
                    </div>
                  )}
                </div>
              )}

              {/* Summary Stats */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { label: "Added", count: diff.addedNodes.length, color: "text-emerald-500" },
                    { label: "Removed", count: diff.removedNodes.length, color: "text-red-500" },
                    { label: "Changed", count: diff.changedNodes.length, color: "text-amber-500" },
                    { label: "Edges +", count: diff.addedEdges.length, color: "text-cyan-500" },
                    { label: "Edges -", count: diff.removedEdges.length, color: "text-orange-500" },
                  ].map((s) => (
                    <div key={s.label} className="space-y-0.5">
                      <div className={clsx("text-[12px] font-bold", s.color)}>{s.count}</div>
                      <div className="text-[7px] text-slate-500 uppercase tracking-wider font-bold">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
