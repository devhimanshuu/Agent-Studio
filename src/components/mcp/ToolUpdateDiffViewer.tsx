"use client";

import React, { useState } from "react";
import {
  X,
  ArrowUpCircle,
  Plus,
  Minus,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronRight,
  Check,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import { McpToolUpdate, McpToolChange, McpToolDefinition } from "@/types/mcp";

interface ToolUpdateDiffViewerProps {
  update: McpToolUpdate;
  affectedSkillNames: string[];
  isOpen: boolean;
  onClose: () => void;
  onApply: (updateId: string, toolNames?: string[]) => Promise<void>;
}

const KIND_CONFIG: Record<
  string,
  { icon: React.ReactNode; label: string; color: string; bgColor: string }
> = {
  added: {
    icon: <Plus className="h-3 w-3" />,
    label: "NEW",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40",
  },
  removed: {
    icon: <Minus className="h-3 w-3" />,
    label: "REMOVED",
    color: "text-red-700 dark:text-red-300",
    bgColor: "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40",
  },
  schema_changed: {
    icon: <RefreshCw className="h-3 w-3" />,
    label: "UPDATED",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40",
  },
  description_changed: {
    icon: <FileText className="h-3 w-3" />,
    label: "DOCS",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/40",
  },
};

export function ToolUpdateDiffViewer({
  update,
  affectedSkillNames,
  isOpen,
  onClose,
  onApply,
}: ToolUpdateDiffViewerProps) {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(update.changes.map((c) => c.toolName))
  );

  if (!isOpen) return null;

  const addedCount = update.changes.filter((c) => c.kind === "added").length;
  const removedCount = update.changes.filter((c) => c.kind === "removed").length;
  const changedCount = update.changes.filter((c) => c.kind === "schema_changed").length;

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(update.id, Array.from(selectedTools));
      setApplied(true);
      setTimeout(onClose, 1500);
    } catch {
      setApplying(false);
    }
  };

  const toggleTool = (name: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[85vh] mx-4 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] shadow-2xl flex flex-col font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-indigo-900/50 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Tool Updates Available
              </h2>
            </div>
            <p className="text-[10px] text-slate-500">
              {update.serverName} · Detected {new Date(update.detectedAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-100 dark:border-indigo-900/30 bg-slate-50 dark:bg-[#0a0a0a]/50 shrink-0">
          {addedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              <Plus className="h-3 w-3" /> {addedCount} new
            </span>
          )}
          {changedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              <RefreshCw className="h-3 w-3" /> {changedCount} updated
            </span>
          )}
          {removedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 dark:text-red-400">
              <Minus className="h-3 w-3" /> {removedCount} removed
            </span>
          )}
          {affectedSkillNames.length > 0 && (
            <span className="text-[10px] text-slate-500 ml-auto">
              Affects: {affectedSkillNames.join(", ")}
            </span>
          )}
        </div>

        {/* Changes list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {update.changes.map((change) => {
            const config = KIND_CONFIG[change.kind] ?? KIND_CONFIG.schema_changed;
            const isExpanded = expandedTool === change.toolName;
            const isSelected = selectedTools.has(change.toolName);

            return (
              <div
                key={change.toolName}
                className={clsx(
                  "rounded border transition-all",
                  isSelected
                    ? "border-indigo-300 dark:border-indigo-500/40 shadow-sm"
                    : "border-slate-200 dark:border-indigo-900/30 opacity-60"
                )}
              >
                {/* Tool header */}
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTool(change.toolName)}
                    className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <button
                    onClick={() => setExpandedTool(isExpanded ? null : change.toolName)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {change.toolName}
                  </button>
                  <span className={clsx("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold", config.bgColor, config.color)}>
                    {config.icon} {config.label}
                  </span>
                </div>

                {/* Summary */}
                <div className="px-3 pb-2 text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {change.summary}
                </div>

                {/* Expanded schema diff */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-indigo-900/20 px-3 py-3 space-y-3">
                    {change.kind === "added" && change.newDef && (
                      <SchemaView label="New Tool Schema" definition={change.newDef} />
                    )}
                    {change.kind === "removed" && change.oldDef && (
                      <SchemaView label="Removed Tool Schema" definition={change.oldDef} />
                    )}
                    {change.kind === "schema_changed" && change.oldDef && change.newDef && (
                      <SchemaDiff oldDef={change.oldDef} newDef={change.newDef} />
                    )}
                    {change.kind === "description_changed" && (
                      <div className="space-y-2">
                        {change.oldDef?.description && (
                          <div className="text-[10px]">
                            <span className="font-bold text-red-600 dark:text-red-400">− </span>
                            <span className="text-slate-500 line-through">{change.oldDef.description}</span>
                          </div>
                        )}
                        {change.newDef?.description && (
                          <div className="text-[10px]">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">+ </span>
                            <span className="text-slate-700 dark:text-slate-300">{change.newDef.description}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 dark:border-indigo-900/50 shrink-0">
          <div className="text-[10px] text-slate-500">
            {selectedTools.size} of {update.changes.length} changes selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer"
            >
              CANCEL
            </button>
            <button
              onClick={handleApply}
              disabled={applying || applied || selectedTools.size === 0}
              className={clsx(
                "inline-flex items-center gap-1.5 px-4 py-1.5 rounded border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                applied
                  ? "border-emerald-400 bg-emerald-600 text-white"
                  : "border-indigo-400 bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-500/25",
                (applying || selectedTools.size === 0) && "opacity-50 cursor-not-allowed"
              )}
            >
              {applied ? (
                <><Check className="h-3 w-3" /> APPLIED</>
              ) : applying ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> APPLYING...</>
              ) : (
                <><ArrowUpCircle className="h-3 w-3" /> UPGRADE {selectedTools.size} TOOLS</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Loader2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/** Read-only schema viewer for a single tool definition. */
function SchemaView({ label, definition }: { label: string; definition: McpToolDefinition }) {
  const props = (definition.inputSchema?.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set((definition.inputSchema?.required ?? []) as string[]);

  return (
    <div className="space-y-2">
      <div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{label}</div>
      {definition.description && (
        <p className="text-[10px] text-slate-600 dark:text-slate-400">{definition.description}</p>
      )}
      {Object.keys(props).length > 0 && (
        <div className="rounded border border-slate-200 dark:border-indigo-900/30 overflow-hidden">
          <table className="w-full text-[9px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-black/30 border-b border-slate-200 dark:border-indigo-900/30">
                <th className="px-2 py-1.5 text-left font-bold text-slate-500 uppercase">Parameter</th>
                <th className="px-2 py-1.5 text-left font-bold text-slate-500 uppercase">Type</th>
                <th className="px-2 py-1.5 text-left font-bold text-slate-500 uppercase">Required</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(props).map(([name, prop]) => (
                <tr key={name} className="border-b border-slate-100 dark:border-indigo-900/20 last:border-0">
                  <td className="px-2 py-1.5 font-mono font-semibold text-slate-800 dark:text-slate-200">{name}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-500">{String(prop?.type ?? "any")}</td>
                  <td className="px-2 py-1.5">
                    {required.has(name) ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">YES</span>
                    ) : (
                      <span className="text-slate-400">no</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Side-by-side schema diff for two tool definitions. */
function SchemaDiff({ oldDef, newDef }: { oldDef: McpToolDefinition; newDef: McpToolDefinition }) {
  const oldProps = (oldDef.inputSchema?.properties ?? {}) as Record<string, Record<string, unknown>>;
  const newProps = (newDef.inputSchema?.properties ?? {}) as Record<string, Record<string, unknown>>;
  const oldRequired = new Set((oldDef.inputSchema?.required ?? []) as string[]);
  const newRequired = new Set((newDef.inputSchema?.required ?? []) as string[]);

  const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

  return (
    <div className="space-y-2">
      <div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Schema Diff</div>
      <div className="rounded border border-slate-200 dark:border-indigo-900/30 overflow-hidden">
        <table className="w-full text-[9px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-black/30 border-b border-slate-200 dark:border-indigo-900/30">
              <th className="px-2 py-1.5 text-left font-bold text-slate-500 uppercase">Parameter</th>
              <th className="px-2 py-1.5 text-left font-bold text-slate-500 uppercase">Old Type</th>
              <th className="px-2 py-1.5 text-left font-bold text-slate-500 uppercase">New Type</th>
              <th className="px-2 py-1.5 text-left font-bold text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(allKeys).sort().map((name) => {
              const inOld = name in oldProps;
              const inNew = name in newProps;
              const oldType = inOld ? String(oldProps[name]?.type ?? "any") : "—";
              const newType = inNew ? String(newProps[name]?.type ?? "any") : "—";
              const oldReq = oldRequired.has(name);
              const newReq = newRequired.has(name);

              let status: "added" | "removed" | "changed" | "unchanged" = "unchanged";
              if (inOld && !inNew) status = "removed";
              else if (!inOld && inNew) status = "added";
              else if (oldType !== newType || oldReq !== newReq) status = "changed";

              return (
                <tr
                  key={name}
                  className={clsx(
                    "border-b border-slate-100 dark:border-indigo-900/20 last:border-0",
                    status === "added" && "bg-emerald-50/50 dark:bg-emerald-950/20",
                    status === "removed" && "bg-red-50/50 dark:bg-red-950/20",
                    status === "changed" && "bg-amber-50/50 dark:bg-amber-950/20"
                  )}
                >
                  <td className="px-2 py-1.5 font-mono font-semibold text-slate-800 dark:text-slate-200">{name}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-500">{oldType}{oldReq ? " *" : ""}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-500">{newType}{newReq ? " *" : ""}</td>
                  <td className="px-2 py-1.5">
                    {status === "added" && <span className="text-emerald-600 dark:text-emerald-400 font-bold">+ ADDED</span>}
                    {status === "removed" && <span className="text-red-600 dark:text-red-400 font-bold">− REMOVED</span>}
                    {status === "changed" && <span className="text-amber-600 dark:text-amber-400 font-bold">~ CHANGED</span>}
                    {status === "unchanged" && <span className="text-slate-400">= same</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[8px] text-slate-400">* = required parameter</p>
    </div>
  );
}
