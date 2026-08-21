"use client";

import React from "react";
import {
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
  Rows3,
  Columns3,
  LayoutTemplate,
  X,
} from "lucide-react";
import type { CanvasNode } from "./graphUtils";
import { computeLayout } from "./autoLayout";

interface AlignmentBarProps {
  selectedNodes: CanvasNode[];
  edges: { source: string; target: string; id?: string; label?: string | number | null }[];
  onAlign: (updatedNodes: CanvasNode[]) => void;
  onDismiss: () => void;
}

/**
 * Multi-Node Alignment & Distribution Bar:
 * Shows when 2+ nodes are marquee-selected. Provides alignment and distribution tools.
 */
export function AlignmentBar({ selectedNodes, edges, onAlign, onDismiss }: AlignmentBarProps) {
  if (selectedNodes.length < 2) return null;

  const alignTop = () => {
    const minY = Math.min(...selectedNodes.map((n) => n.position.y));
    onAlign(selectedNodes.map((n) => ({ ...n, position: { ...n.position, y: minY } })));
  };

  const alignBottom = () => {
    const maxY = Math.max(...selectedNodes.map((n) => n.position.y + 100));
    onAlign(selectedNodes.map((n) => ({ ...n, position: { ...n.position, y: maxY - 100 } })));
  };

  const alignLeft = () => {
    const minX = Math.min(...selectedNodes.map((n) => n.position.x));
    onAlign(selectedNodes.map((n) => ({ ...n, position: { ...n.position, x: minX } })));
  };

  const alignRight = () => {
    const maxX = Math.max(...selectedNodes.map((n) => n.position.x + 220));
    onAlign(selectedNodes.map((n) => ({ ...n, position: { ...n.position, x: maxX - 220 } })));
  };

  const distributeHorizontal = () => {
    if (selectedNodes.length < 3) return;
    const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
    const minX = sorted[0].position.x;
    const maxX = sorted[sorted.length - 1].position.x;
    const step = (maxX - minX) / (sorted.length - 1);
    onAlign(sorted.map((n, i) => ({ ...n, position: { ...n.position, x: minX + step * i } })));
  };

  const distributeVertical = () => {
    if (selectedNodes.length < 3) return;
    const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
    const minY = sorted[0].position.y;
    const maxY = sorted[sorted.length - 1].position.y;
    const step = (maxY - minY) / (sorted.length - 1);
    onAlign(sorted.map((n, i) => ({ ...n, position: { ...n.position, y: minY + step * i } })));
  };

  const autoTidy = () => {
    const positions = computeLayout(selectedNodes, edges);
    onAlign(selectedNodes.map((n, i) => ({ ...n, position: positions[i] ?? n.position })));
  };

  const btnClass =
    "inline-flex items-center justify-center h-7 w-7 rounded border border-slate-700/60 bg-[#0a0a14] text-slate-400 hover:text-white hover:border-indigo-400 hover:bg-indigo-950/40 transition-colors cursor-pointer";
  const activeBtnClass =
    "inline-flex items-center justify-center h-7 w-7 rounded border border-indigo-500/50 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 transition-colors cursor-pointer";

  return (
    <div className="absolute left-1/2 bottom-16 z-30 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-slate-700/60 bg-[#0a0a14]/95 backdrop-blur-md px-2.5 py-1.5 shadow-2xl font-mono">
      <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mr-1.5">
        {selectedNodes.length} selected
      </span>

      <div className="w-px h-5 bg-slate-700/60 mx-1" />

      <button onClick={alignLeft} className={btnClass} title="Align Left">
        <AlignStartVertical className="h-3.5 w-3.5" />
      </button>
      <button onClick={alignRight} className={btnClass} title="Align Right">
        <AlignEndVertical className="h-3.5 w-3.5" />
      </button>
      <button onClick={alignTop} className={btnClass} title="Align Top">
        <AlignStartHorizontal className="h-3.5 w-3.5" />
      </button>
      <button onClick={alignBottom} className={btnClass} title="Align Bottom">
        <AlignEndHorizontal className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-5 bg-slate-700/60 mx-1" />

      <button
        onClick={distributeHorizontal}
        className={selectedNodes.length >= 3 ? btnClass : activeBtnClass}
        disabled={selectedNodes.length < 3}
        title="Distribute Horizontally"
      >
        <Rows3 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={distributeVertical}
        className={selectedNodes.length >= 3 ? btnClass : activeBtnClass}
        disabled={selectedNodes.length < 3}
        title="Distribute Vertically"
      >
        <Columns3 className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-5 bg-slate-700/60 mx-1" />

      <button onClick={autoTidy} className={activeBtnClass} title="Auto-Tidy Layout">
        <LayoutTemplate className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-5 bg-slate-700/60 mx-1" />

      <button
        onClick={onDismiss}
        className="inline-flex items-center justify-center h-7 w-7 rounded border border-slate-700/60 bg-[#0a0a14] text-slate-500 hover:text-red-400 hover:border-red-500/50 transition-colors cursor-pointer"
        title="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
