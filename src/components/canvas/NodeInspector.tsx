"use client";

import React, { useState } from "react";
import { Trash2, GitBranch } from "lucide-react";
import { BUILT_IN_TOOL_CATALOG } from "@/modules/tools";
import type { CanvasNode, CanvasNodeData } from "./graphUtils";
import { GraphNodeType } from "@/types/graph";

interface NodeInspectorProps {
  node: CanvasNode;
  onUpdate: (patch: Partial<CanvasNodeData>) => void;
  onDelete: () => void;
}

const inputClass =
  "w-full rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] px-2.5 py-1.5 text-[10px] text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-colors";
const labelClass = "text-[9px] font-mono uppercase tracking-widest text-indigo-600 dark:text-indigo-400/80 font-semibold";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className="text-[8px] text-slate-500 leading-tight">{hint}</p>}
    </div>
  );
}

export function NodeInspector({ node, onUpdate, onDelete }: NodeInspectorProps) {
  const [templateRaw, setTemplateRaw] = useState(() =>
    node.data.inputTemplate && Object.keys(node.data.inputTemplate).length > 0
      ? JSON.stringify(node.data.inputTemplate, null, 2)
      : ""
  );
  const [templateError, setTemplateError] = useState<string | null>(null);
  const type = (node.type ?? "agent") as GraphNodeType;

  const handleTemplate = (text: string) => {
    setTemplateRaw(text);
    if (!text.trim()) {
      setTemplateError(null);
      onUpdate({ inputTemplate: {} });
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) || parsed === null || typeof parsed !== "object") {
        throw new Error("Must be a JSON object");
      }
      setTemplateError(null);
      onUpdate({ inputTemplate: parsed });
    } catch (e) {
      setTemplateError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-indigo-400/80 font-bold">
          {type.toUpperCase()} NODE
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-400/50 text-[9px] font-mono text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
        >
          <Trash2 className="h-3 w-3" /> DELETE
        </button>
      </div>

      <Field label="Label">
        <input
          value={node.data.label ?? ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className={inputClass}
        />
      </Field>

      {type === "agent" && (
        <Field label="Agent Prompt" hint="System prompt for this specialist agent. Receives the accumulated workflow context.">
          <textarea
            value={node.data.prompt ?? ""}
            onChange={(e) => onUpdate({ prompt: e.target.value })}
            rows={6}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </Field>
      )}

      {type === "supervisor" && (
        <>
          <Field label="Supervisor Prompt" hint="The model picks the next node among the outgoing edge labels.">
            <textarea
              value={node.data.prompt ?? ""}
              onChange={(e) => onUpdate({ prompt: e.target.value })}
              rows={5}
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </Field>
          <Field label="Routing Hint" hint="Add label text to each outgoing edge — the supervisor returns one of them.">
            <div className="rounded border border-violet-500/30 bg-violet-950/20 p-2 text-[9px] text-violet-300">
              <GitBranch className="h-3 w-3 inline mr-1" />
              Supervisor routes by edge label. Click an edge to rename it.
            </div>
          </Field>
        </>
      )}

      {type === "tool" && (
        <>
          <Field label="Tool">
            <select
              value={node.data.toolName ?? ""}
              onChange={(e) => onUpdate({ toolName: e.target.value })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">— select tool —</option>
              {BUILT_IN_TOOL_CATALOG.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.name} · {tool.category}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Action">
            <input
              value={node.data.action ?? ""}
              onChange={(e) => onUpdate({ action: e.target.value })}
              placeholder="e.g. add, search"
              className={inputClass}
            />
          </Field>
          <Field
            label="Input Template (JSON)"
            hint="Reference workflow state: {{ input.amount }}, {{ results.agent_1.content }}"
          >
            <textarea
              value={templateRaw}
              onChange={(e) => handleTemplate(e.target.value)}
              rows={4}
              spellCheck={false}
              placeholder="{ }"
              className={`${inputClass} resize-y text-[9px] leading-relaxed ${templateError ? "border-red-500/60" : ""}`}
            />
            {templateError && <p className="text-[8px] font-mono text-red-400">[ JSON ERROR ] {templateError}</p>}
          </Field>
        </>
      )}

      {type === "router" && (
        <>
          <Field label="Router Mode">
            <select
              value={node.data.routerMode ?? "deterministic"}
              onChange={(e) => onUpdate({ routerMode: e.target.value as "deterministic" | "ai" })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="deterministic">DETERMINISTIC CONDITION</option>
              <option value="ai">AI ROUTER (LLM decides)</option>
            </select>
          </Field>
          {node.data.routerMode === "ai" ? (
            <Field label="Router Prompt" hint={'The model returns { "next": "<edge label>" }.'}>
              <textarea
                value={node.data.routerPrompt ?? ""}
                onChange={(e) => onUpdate({ routerPrompt: e.target.value })}
                rows={4}
                className={`${inputClass} resize-y`}
              />
            </Field>
          ) : (
            <Field
              label="Condition Expression"
              hint={'Evaluated against state. Examples: results.classifier.decision == "high" · input.amount > 500 · results.a.count >= 3 && input.flag'}
            >
              <input
                value={node.data.condition ?? ""}
                onChange={(e) => onUpdate({ condition: e.target.value })}
                className={inputClass}
              />
              <p className="text-[8px] text-amber-500/80 leading-tight">
                {'Edge labelled '}
                <code>true</code>
                {' = condition matched · '}
                <code>false</code>
                {' = not matched. A label-less edge is the fallback.'}
              </p>
            </Field>
          )}
        </>
      )}

      {type === "approval" && (
        <Field label="Approval Reason" hint="Shown to the human reviewer in the review queue.">
          <textarea
            value={node.data.approvalReason ?? ""}
            onChange={(e) => onUpdate({ approvalReason: e.target.value })}
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </Field>
      )}

      {type === "loop" && (
        <Field label="Max Iterations" hint="The body edge (labelled body or first edge) repeats up to N times; the exit edge (labelled exit or last edge) continues after.">
          <input
            type="number"
            min={1}
            max={100}
            value={node.data.maxIterations ?? 3}
            onChange={(e) => onUpdate({ maxIterations: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
            className={inputClass}
          />
        </Field>
      )}

      {type === "parallel" && (
        <>
          <Field label="Parallel Mode">
            <select
              value={node.data.parallelMode ?? "map"}
              onChange={(e) => onUpdate({ parallelMode: e.target.value as "map" | "reduce" })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="map">MAP (iterate an array)</option>
              <option value="reduce">FAN-OUT (all branches)</option>
            </select>
          </Field>
          {node.data.parallelMode === "map" && (
            <Field
              label="Map Field"
              hint="Path to the array to iterate, e.g. input.items. Each item is available as {{ item }} inside the worker branch."
            >
              <input
                value={node.data.mapField ?? ""}
                onChange={(e) => onUpdate({ mapField: e.target.value })}
                className={inputClass}
              />
            </Field>
          )}
          <p className="text-[8px] text-teal-500/80 leading-tight">
            {'Edge labelled '}
            <code>worker</code>
            {' (or first edge) runs per item/branch; edge labelled '}
            <code>join</code>
            {' (or last edge) continues after all complete.'}
          </p>
        </>
      )}

      <div className="border-t border-slate-700/60 pt-2">
        <p className="text-[8px] text-slate-500 leading-tight">
          {'Edges: drag from the right handle to connect. Click an edge then edit its label in the inspector to set a branch condition.'}
        </p>
      </div>
    </div>
  );
}
