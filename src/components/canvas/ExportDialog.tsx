"use client";

import React, { useCallback, useState } from "react";
import { Download, X, Image, Code2, FileJson, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import {
  EXPORT_FORMATS,
  type ExportFormat,
  exportCanvasAsPng,
  exportCanvasAsSvg,
  exportCanvasAsPdf,
  graphToMermaid,
  graphToLangGraphPython,
  graphToLangGraphTS,
  exportGraphAsJson,
} from "./exportUtils";
import type { AgentGraphDefinition } from "@/types/graph";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  graph: AgentGraphDefinition;
  canvasContainerRef?: React.RefObject<HTMLDivElement | null>;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  visual: Image,
  code: Code2,
  data: FileJson,
};

const CATEGORIES = ["visual", "code", "data"] as const;

/**
 * Export & Portability Suite dialog:
 * Visual export (PNG/SVG/PDF), Code/Framework export (Mermaid/LangGraph), JSON import/export.
 */
export function ExportDialog({ isOpen, onClose, graph, canvasContainerRef }: ExportDialogProps) {
  const [activeCategory, setActiveCategory] = useState<"visual" | "code" | "data">("visual");
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(format.id);
      try {
        switch (format.id) {
          case "png":
            if (canvasContainerRef?.current) {
              await exportCanvasAsPng(canvasContainerRef.current);
            }
            break;
          case "svg":
            if (canvasContainerRef?.current) {
              await exportCanvasAsSvg(canvasContainerRef.current);
            }
            break;
          case "pdf":
            if (canvasContainerRef?.current) {
              await exportCanvasAsPdf(canvasContainerRef.current);
            }
            break;
          case "mermaid": {
            const code = graphToMermaid(graph);
            downloadText(code, "agent-graph.md", "text/markdown");
            break;
          }
          case "langgraph-py": {
            const code = graphToLangGraphPython(graph);
            downloadText(code, "agent_graph.py", "text/x-python");
            break;
          }
          case "langgraph-ts": {
            const code = graphToLangGraphTS(graph);
            downloadText(code, "agentGraph.ts", "text/typescript");
            break;
          }
          case "json": {
            const code = exportGraphAsJson(graph);
            downloadText(code, "agent-graph.json", "application/json");
            break;
          }
        }
        onClose();
      } catch (e) {
        console.error("Export failed:", e);
      } finally {
        setExporting(null);
      }
    },
    [graph, canvasContainerRef, onClose]
  );

  if (!isOpen) return null;

  const filteredFormats = EXPORT_FORMATS.filter((f) => f.category === activeCategory);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-[480px] max-w-[90vw] rounded-xl border border-slate-700/60 bg-[#0a0a14] shadow-2xl font-mono overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-indigo-400" />
            <span className="text-[11px] font-bold text-white uppercase tracking-widest">
              Export Graph
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 px-4 pt-3">
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={clsx(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                  activeCategory === cat
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                )}
              >
                <Icon className="h-3 w-3" />
                {cat}
              </button>
            );
          })}
        </div>

        {/* Format cards */}
        <div className="p-4 space-y-2">
          {filteredFormats.map((format) => (
            <button
              key={format.id}
              onClick={() => handleExport(format)}
              disabled={exporting !== null}
              className="w-full flex items-center gap-3 rounded-lg border border-slate-700/60 bg-[#0d0d1a] p-3 text-left hover:border-indigo-400/50 hover:bg-indigo-950/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <span className="text-xl">{format.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-white tracking-wider">
                  {format.label}
                </div>
                <div className="text-[8px] text-slate-500">{format.description}</div>
              </div>
              {exporting === format.id ? (
                <Loader2 className="h-4 w-4 text-indigo-400 animate-spin shrink-0" />
              ) : (
                <Download className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
