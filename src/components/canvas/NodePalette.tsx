"use client";

import React from "react";
import { CANVAS_NODE_TYPES } from "./nodeTypes";
import { GraphNodeType } from "@/types/graph";

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, type: GraphNodeType) => void;
  disabled?: boolean;
}

export function NodePalette({ onDragStart, disabled = false }: NodePaletteProps) {
  return (
    <div className="space-y-2.5 font-mono">
      <div className="px-1">
        <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-bold">
          NODE PALETTE
        </div>
        <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
          Drag onto canvas to add
        </div>
      </div>
      <div className="space-y-1.5">
        {CANVAS_NODE_TYPES.map((meta) => {
          const Icon = meta.icon;
          return (
            <div
              key={meta.type}
              draggable={!disabled}
              onDragStart={(e) => onDragStart(e, meta.type)}
              title={meta.description}
              className={`group flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800/80 bg-slate-50/90 dark:bg-[#0c0d18]/90 px-2.5 py-2 cursor-grab transition-all hover:border-indigo-400 dark:hover:border-indigo-500/60 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 shadow-xs hover:shadow-md ${
                disabled ? "opacity-40 cursor-not-allowed" : "active:cursor-grabbing hover:-translate-y-0.5"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-slate-800 dark:text-slate-100 tracking-wider truncate">{meta.label}</div>
                <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">{meta.description}</div>
              </div>
              <span className={`px-1.5 py-0.5 rounded border text-[8px] font-bold ${meta.badgeClass} shrink-0`}>
                {meta.tag}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
