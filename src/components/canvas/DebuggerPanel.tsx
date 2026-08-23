"use client";

import React, { useState, useCallback } from "react";
import {
  Bug,
  Circle,
  Play,
  Pause,
  SkipForward,
  Eye,
  Edit3,
  ChevronRight,
  ChevronDown,
  RotateCcw,
} from "lucide-react";

interface DebuggerPanelProps {
  /** Current trace node statuses. */
  nodeStatuses: Record<string, string>;
  /** Current trace details. */
  nodeDetails: Record<string, string>;
  /** Whether execution is currently running. */
  isRunning: boolean;
  /** Callback to toggle breakpoint on a node. */
  onToggleBreakpoint: (nodeId: string) => void;
  /** Callback to step to next node. */
  onStepNext?: () => void;
  /** Callback to continue execution. */
  onContinue?: () => void;
  /** Callback to pause execution. */
  onPause?: () => void;
  /** Callback to restart execution. */
  onRestart?: () => void;
}

interface VariableEntry {
  key: string;
  value: unknown;
  expanded?: boolean;
}

/**
 * Interactive Debugger & Live Stepping:
 * Breakpoints, variable inspector, step controls, and live state editing.
 */
export function DebuggerPanel({
  nodeStatuses,
  nodeDetails,
  isRunning,
  onToggleBreakpoint: _onToggleBreakpoint,
  onStepNext,
  onContinue,
  onPause,
  onRestart,
}: DebuggerPanelProps) {
  const [variables, setVariables] = useState<VariableEntry[]>([
    { key: "input", value: { query: "example input" } },
    { key: "results", value: {} },
    { key: "loopCounters", value: {} },
    { key: "state", value: { step: 0, retryCount: 0 } },
  ]);
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showVars, setShowVars] = useState(true);
  const [showBreakpoints, setShowBreakpoints] = useState(true);

  const toggleExpand = useCallback((key: string) => {
    setVariables((prev) =>
      prev.map((v) => (v.key === key ? { ...v, expanded: !v.expanded } : v))
    );
  }, []);

  const startEdit = useCallback((key: string, value: unknown) => {
    setEditingVar(key);
    setEditValue(JSON.stringify(value, null, 2));
  }, []);

  const saveEdit = useCallback(
    (key: string) => {
      try {
        const parsed = JSON.parse(editValue);
        setVariables((prev) =>
          prev.map((v) => (v.key === key ? { ...v, value: parsed } : v))
        );
        setEditingVar(null);
      } catch {
        // Invalid JSON — ignore
      }
    },
    [editValue]
  );

  // Gather breakpoint nodes
  const runningNodeIds = Object.keys(nodeStatuses).filter(
    (id) => nodeStatuses[id] === "RUNNING"
  );

  const formatValue = (value: unknown): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return `"${value.slice(0, 60)}${value.length > 60 ? "…" : ""}"`;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (typeof value === "object") {
      const keys = Object.keys(value as Record<string, unknown>);
      return `{${keys.slice(0, 5).join(", ")}${keys.length > 5 ? ", …" : ""}}`;
    }
    return String(value);
  };

  return (
    <div className="space-y-3 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-indigo-400/80 font-bold flex items-center gap-1.5">
          <Bug className="h-3.5 w-3.5" /> DEBUGGER
        </div>
        {isRunning && (
          <span className="inline-flex items-center gap-1 text-[8px] text-emerald-400 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            RUNNING
          </span>
        )}
      </div>

      {/* Step Controls */}
      <div className="flex items-center gap-1">
        {isRunning ? (
          <button
            onClick={onPause}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-500/50 bg-amber-950/40 text-[8px] font-bold text-amber-300 hover:bg-amber-900/40 transition-colors cursor-pointer"
          >
            <Pause className="h-2.5 w-2.5" /> PAUSE
          </button>
        ) : (
          <button
            onClick={onContinue}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-emerald-500/50 bg-emerald-950/40 text-[8px] font-bold text-emerald-300 hover:bg-emerald-900/40 transition-colors cursor-pointer"
          >
            <Play className="h-2.5 w-2.5" /> CONTINUE
          </button>
        )}
        <button
          onClick={onStepNext}
          disabled={!isRunning}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-500/50 bg-indigo-950/40 text-[8px] font-bold text-indigo-300 hover:bg-indigo-900/40 transition-colors cursor-pointer disabled:opacity-40"
        >
          <SkipForward className="h-2.5 w-2.5" /> STEP NEXT
        </button>
        <button
          onClick={onRestart}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-[8px] font-bold text-slate-400 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
        >
          <RotateCcw className="h-2.5 w-2.5" /> RESTART
        </button>
      </div>

      {/* Running Nodes */}
      {runningNodeIds.length > 0 && (
        <div className="rounded border border-indigo-500/30 bg-indigo-950/30 p-2">
          <div className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider mb-1">
            Current Execution Point
          </div>
          {runningNodeIds.map((id) => (
            <div key={id} className="flex items-center gap-1.5 text-[9px]">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
              <span className="text-indigo-300 font-semibold">{id}</span>
              {nodeDetails[id] && (
                <span className="text-slate-500 truncate text-[8px]">{nodeDetails[id]}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Breakpoints Section */}
      <div className="border-t border-indigo-900/30 pt-2">
        <button
          onClick={() => setShowBreakpoints(!showBreakpoints)}
          className="inline-flex items-center gap-1 text-[8px] uppercase tracking-wider text-slate-500 font-bold hover:text-white transition-colors cursor-pointer"
        >
          {showBreakpoints ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          Breakpoints
        </button>
        {showBreakpoints && (
          <div className="mt-1 text-[8px] text-slate-500 leading-relaxed">
            Click the <Circle className="h-2 w-2 inline text-red-400" /> icon on any node&apos;s inspector to toggle a breakpoint.
            Execution pauses before that node runs.
          </div>
        )}
      </div>

      {/* Variable Inspector */}
      <div className="border-t border-indigo-900/30 pt-2">
        <button
          onClick={() => setShowVars(!showVars)}
          className="inline-flex items-center gap-1 text-[8px] uppercase tracking-wider text-slate-500 font-bold hover:text-white transition-colors cursor-pointer"
        >
          {showVars ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          <Eye className="h-2.5 w-2.5" /> Variables
        </button>
        {showVars && (
          <div className="mt-1.5 space-y-1">
            {variables.map((v) => (
              <div key={v.key} className="rounded border border-slate-700/40 bg-black/30 overflow-hidden">
                <div
                  className="flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => toggleExpand(v.key)}
                >
                  {v.expanded ? (
                    <ChevronDown className="h-2.5 w-2.5 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-2.5 w-2.5 text-slate-500 shrink-0" />
                  )}
                  <span className="text-indigo-400 font-semibold text-[9px]">{v.key}</span>
                  {!v.expanded && (
                    <>
                      <span className="text-slate-600">=</span>
                      <span className="text-slate-400 text-[8px] truncate">
                        {formatValue(v.value)}
                      </span>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(v.key, v.value);
                    }}
                    className="ml-auto p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-white transition-colors cursor-pointer"
                  >
                    <Edit3 className="h-2.5 w-2.5" />
                  </button>
                </div>
                {v.expanded && (
                  <div className="px-2 pb-1.5">
                    {editingVar === v.key ? (
                      <div className="space-y-1">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          rows={4}
                          className="w-full rounded border border-indigo-500/50 bg-black/40 px-2 py-1 text-[8px] text-white font-mono focus:outline-none resize-y"
                          autoFocus
                        />
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => saveEdit(v.key)}
                            className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[7px] font-bold hover:bg-indigo-500 cursor-pointer"
                          >
                            SAVE
                          </button>
                          <button
                            onClick={() => setEditingVar(null)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[7px] font-bold hover:text-white cursor-pointer"
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    ) : (
                      <pre className="text-[8px] text-slate-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-24 overflow-y-auto">
                        {JSON.stringify(v.value, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
