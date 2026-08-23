"use client";

import { Trash2, GitBranch, Braces, Boxes, CornerUpRight, RefreshCw, Sparkles, Circle } from "lucide-react";
import { clsx } from "clsx";
import { BUILT_IN_TOOL_CATALOG } from "@/modules/tools";
import type { CanvasNode, CanvasNodeData } from "./graphUtils";
import { GraphNodeType } from "@/types/graph";
import type { McpServerDTO } from "@/types/mcp";

interface NodeInspectorProps {
  node: CanvasNode;
  onUpdate: (patch: Partial<CanvasNodeData>) => void;
  onDelete: () => void;
  /** Ids of every node on the canvas — used for `{{ results.<nodeId> }}` reference autocomplete. */
  allNodeIds?: string[];
  /** Opens a subgraph node for nested editing (canvas pushes the inner graph). */
  onOpenSubgraph?: (node: CanvasNode) => void;
  /** Toggle a breakpoint on this node (debug mode). */
  onToggleBreakpoint?: (nodeId: string) => void;
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

/** Rough token estimate — prompts are prose, ~4 chars/token is a decent proxy. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

/**
 * Prompt editor with one-click template references (`{{ input.x }}`,
 * `{{ results.<nodeId> }}`, `{{ item }}`) inserted at the caret, plus a live
 * token estimate.
 */
function PromptField({
  label,
  hint,
  value,
  onChange,
  rows = 5,
  allNodeIds,
  showItem = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  allNodeIds?: string[];
  showItem?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const references = [
    ...(showItem ? ["item"] : []),
    "input",
    ...(allNodeIds ?? []).map((id) => `results.${id}`),
  ];

  const insertReference = (path: string) => {
    const el = ref.current;
    if (!el) {
      onChange(`${value}${value && !value.endsWith("\n") ? "\n" : ""}{{ ${path} }}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const snippet = `{{ ${path} }}`;
    onChange(`${value.slice(0, start)}${snippet}${value.slice(end)}`);
    // Restore focus + caret after the inserted snippet.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const tokens = estimateTokens(value);

  return (
    <Field label={label} hint={hint}>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        placeholder="System prompt for this node…"
        className={`${inputClass} resize-y leading-relaxed`}
      />
      {references.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="inline-flex items-center gap-0.5 text-[8px] text-slate-500 self-center">
            <Braces className="h-2.5 w-2.5" /> refs:
          </span>
          {references.map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => insertReference(path)}
              className="rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/50 px-1 py-0.5 text-[8px] font-mono text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
              title={`Insert {{ ${path} }} at the cursor`}
            >
              {path}
            </button>
          ))}
        </div>
      )}
      <div className="text-[8px] text-slate-500 text-right">
        ~{tokens} tokens
        {tokens > 2000 && <span className="text-amber-500 font-bold"> · long prompt</span>}
      </div>
    </Field>
  );
}

function useJsonField(
  initial: Record<string, string> | undefined,
  onCommit: (value: Record<string, string>) => void
) {
  const [raw, setRaw] = useState(() => (initial && Object.keys(initial).length > 0 ? JSON.stringify(initial, null, 2) : ""));
  const [error, setError] = useState<string | null>(null);

  const handle = (text: string) => {
    setRaw(text);
    if (!text.trim()) {
      setError(null);
      onCommit({});
      return;
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Must be a JSON object of string → template");
      }
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v !== "string") throw new Error(`Mapping "${k}" must be a template string`);
      }
      setError(null);
      onCommit(parsed as Record<string, string>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return { raw, setRaw, error, handle };
}

export function NodeInspector({ node, onUpdate, onDelete, allNodeIds, onOpenSubgraph, onToggleBreakpoint }: NodeInspectorProps) {
  // Prompt optimizer state
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [optimizeStats, setOptimizeStats] = useState<{ originalTokens: number; optimizedTokens: number; improvement: string } | null>(null);

  const handleOptimizePrompt = useCallback(async () => {
    const currentPrompt = node.data.prompt ?? "";
    if (!currentPrompt.trim() || optimizing) return;
    setOptimizing(true);
    setOptimizeError(null);
    setOptimizeStats(null);
    try {
      const res = await fetch("/api/canvas/optimize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: currentPrompt,
          nodeType: node.type,
          label: node.data.label,
          condition: node.data.condition,
          toolName: node.data.toolName,
        }),
      });
      const data = await res.json();
      if (data.success && data.optimizedPrompt) {
        onUpdate({ prompt: data.optimizedPrompt });
        if (data.stats) setOptimizeStats(data.stats);
      } else {
        setOptimizeError(data.error ?? "Optimization failed");
      }
    } catch (e) {
      setOptimizeError(e instanceof Error ? e.message : "Failed");
    } finally {
      setOptimizing(false);
    }
  }, [node, onUpdate, optimizing]);
  const [templateRaw, setTemplateRaw] = useState(() =>
    node.data.inputTemplate && Object.keys(node.data.inputTemplate).length > 0
      ? JSON.stringify(node.data.inputTemplate, null, 2)
      : ""
  );
  const [templateError, setTemplateError] = useState<string | null>(null);
  const type = (node.type ?? "agent") as GraphNodeType;

  // ── Dynamically fetch connected MCP servers + their tools ──
  const [mcpServers, setMcpServers] = useState<McpServerDTO[]>([]);
  useEffect(() => {
    fetch("/api/mcp/servers")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setMcpServers(json.data);
        }
      })
      .catch(() => {});
  }, []);

  // Build a map of serverId → tool names for the MCP tool selector
  const mcpServerToolMap = React.useMemo(() => {
    const map = new Map<string, { name: string; displayName: string; description: string }[]>();
    for (const server of mcpServers) {
      if (server.status !== "CONNECTED" || server.cachedTools.length === 0) continue;
      map.set(
        server.id,
        server.cachedTools.map((t) => ({
          name: t.name,
          displayName: t.annotations?.title ?? t.name,
          description: t.description ?? "",
        }))
      );
    }
    return map;
  }, [mcpServers]);

  const inputMap = useJsonField(node.data.inputMapping, (v) => onUpdate({ inputMapping: v }));
  const outputMap = useJsonField(node.data.outputMapping, (v) => onUpdate({ outputMapping: v }));

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
        <div className="text-[10px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400/80 font-bold">
          {type.toUpperCase()} NODE
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 dark:border-red-400/50 text-[9px] font-mono text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
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
        <>
          <PromptField
            label="Agent Prompt"
            hint="System prompt for this specialist agent. Receives the accumulated workflow context."
            value={node.data.prompt ?? ""}
            onChange={(v) => onUpdate({ prompt: v })}
            rows={6}
            allNodeIds={allNodeIds}
          />
          {/* Optimize Prompt Button */}
          {node.data.prompt && node.data.prompt.trim().length > 20 && (
            <button
              type="button"
              onClick={handleOptimizePrompt}
              disabled={optimizing}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-purple-400/50 bg-purple-950/30 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-purple-300 hover:bg-purple-900/40 transition-colors cursor-pointer disabled:opacity-50"
            >
              {optimizing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" /> OPTIMIZING…
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" /> OPTIMIZE PROMPT
                </>
              )}
            </button>
          )}
          {optimizeStats && (
            <div className="text-[8px] text-purple-400 font-mono">
              {optimizeStats.originalTokens}→{optimizeStats.optimizedTokens} tokens ({optimizeStats.improvement})
            </div>
          )}
          {optimizeError && (
            <div className="text-[8px] text-red-400">✗ {optimizeError}</div>
          )}
        </>
      )}

      {type === "supervisor" && (
        <>
          <PromptField
            label="Supervisor Prompt"
            hint="The model picks the next node among the outgoing edge labels."
            value={node.data.prompt ?? ""}
            onChange={(v) => onUpdate({ prompt: v })}
            rows={5}
            allNodeIds={allNodeIds}
          />
          {/* Optimize Prompt Button */}
          {node.data.prompt && node.data.prompt.trim().length > 20 && (
            <button
              type="button"
              onClick={handleOptimizePrompt}
              disabled={optimizing}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-purple-400/50 bg-purple-950/30 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-purple-300 hover:bg-purple-900/40 transition-colors cursor-pointer disabled:opacity-50"
            >
              {optimizing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" /> OPTIMIZING…
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" /> OPTIMIZE PROMPT
                </>
              )}
            </button>
          )}
          {optimizeStats && (
            <div className="text-[8px] text-purple-400 font-mono">
              {optimizeStats.originalTokens}→{optimizeStats.optimizedTokens} tokens ({optimizeStats.improvement})
            </div>
          )}
          {optimizeError && (
            <div className="text-[8px] text-red-400">✗ {optimizeError}</div>
          )}
          <Field label="Routing Hint" hint="Add label text to each outgoing edge — the supervisor returns one of them.">
            <div className="rounded border border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-950/20 p-2 text-[9px] text-violet-700 dark:text-violet-300">
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
            <PromptField
              label="Router Prompt"
              hint={'The model returns { "next": "<edge label>" }.'}
              value={node.data.routerPrompt ?? ""}
              onChange={(v) => onUpdate({ routerPrompt: v })}
              rows={4}
              allNodeIds={allNodeIds}
            />
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
        <>
          <Field label="Approval Reason" hint="Shown to the human reviewer in the review queue.">
            <textarea
              value={node.data.approvalReason ?? ""}
              onChange={(e) => onUpdate({ approvalReason: e.target.value })}
              rows={3}
              className={`${inputClass} resize-y`}
            />
          </Field>
          <Field
            label="Auto-Approve Condition (optional)"
            hint="Leave empty to always require approval. When set, the gate auto-passes if the condition is true — e.g. results.risk.decision == &quot;low&quot;"
          >
            <input
              value={node.data.autoApproveCondition ?? ""}
              onChange={(e) => onUpdate({ autoApproveCondition: e.target.value || undefined })}
              placeholder="results.risk.decision == &quot;low&quot;"
              className={inputClass}
            />
          </Field>
          <Field label="Escalate After (minutes, optional)" hint="A pending request auto-escalates (leaves the review queue) after this long.">
            <input
              type="number"
              min={1}
              max={10080}
              value={node.data.escalateAfterMin ?? ""}
              onChange={(e) => onUpdate({ escalateAfterMin: e.target.value ? Math.max(1, Math.min(10080, Number(e.target.value) || 1)) : undefined })}
              placeholder="e.g. 60"
              className={inputClass}
            />
          </Field>
        </>
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

      {type === "subgraph" && (
        <>
          <Field label="Inner Graph">
            <div className="rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/40 p-2 space-y-1">
              <div className="text-[9px] font-mono text-slate-700 dark:text-slate-300">
                {node.data.subgraph?.nodes?.length ?? 0} nodes · {node.data.subgraph?.edges?.length ?? 0} edges
              </div>
              <button
                type="button"
                onClick={() => onOpenSubgraph?.(node)}
                disabled={!node.data.subgraph || !onOpenSubgraph}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-slate-400 dark:border-slate-600 bg-white dark:bg-[#0a0a0a] px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer disabled:opacity-40"
              >
                <CornerUpRight className="h-3 w-3" /> OPEN SUBGRAPH EDITOR
              </button>
            </div>
          </Field>
          <Field
            label="Input Mapping (JSON)"
            hint={'Inner variables → parent state. Example: { "in_agent": "{{ results.agent_1.output }}" }'}
          >
            <textarea
              value={inputMap.raw}
              onChange={(e) => inputMap.handle(e.target.value)}
              rows={3}
              spellCheck={false}
              placeholder='{ "in_1": "{{ results.agent_1.output }}" }'
              className={`${inputClass} resize-y text-[9px] leading-relaxed ${inputMap.error ? "border-red-500/60" : ""}`}
            />
            {inputMap.error && <p className="text-[8px] font-mono text-red-400">[ JSON ERROR ] {inputMap.error}</p>}
          </Field>
          <Field
            label="Output Mapping (JSON)"
            hint={'Outer result keys → inner results. Example: { "summary": "results.summarizer.content" }'}
          >
            <textarea
              value={outputMap.raw}
              onChange={(e) => outputMap.handle(e.target.value)}
              rows={3}
              spellCheck={false}
              placeholder='{ "summary": "results.summarizer.content" }'
              className={`${inputClass} resize-y text-[9px] leading-relaxed ${outputMap.error ? "border-red-500/60" : ""}`}
            />
            {outputMap.error && <p className="text-[8px] font-mono text-red-400">[ JSON ERROR ] {outputMap.error}</p>}
          </Field>
          <div className="flex items-center gap-1.5 text-[8px] text-slate-500">
            <Boxes className="h-3 w-3" /> Inside, nodes reference inputs as <code>input.&lt;key&gt;</code> and outputs as{" "}
            <code>results.&lt;innerNodeId&gt;</code>.
          </div>
        </>
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

      {/* ─── MCP & Ecosystem Nodes ─── */}

      {type === "mcp_server" && (
        <>
          <Field label="MCP Server" hint="Connected servers from your MCP Hub">
            <div className="flex items-center gap-1.5">
              <select
                value={node.data.mcpServerId ?? ""}
                onChange={(e) => onUpdate({ mcpServerId: e.target.value })}
                className={`${inputClass} cursor-pointer flex-1`}
              >
                <option value="">— select connected server —</option>
                {mcpServers.length === 0 && (
                  <option value="" disabled>No servers connected — go to Tools → MCP Hub</option>
                )}
                {mcpServers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.cachedTools.length} tools) [{s.status}]
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => fetch("/api/mcp/servers").then(r => r.json()).then(j => { if (j.success) setMcpServers(j.data); }).catch(() => {})}
                className="p-1.5 rounded border border-slate-300 dark:border-indigo-900/50 hover:bg-slate-100 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                title="Refresh servers"
              >
                <RefreshCw className="h-3 w-3 text-slate-500" />
              </button>
            </div>
          </Field>
          <Field label="Transport">
            <select
              value={node.data.mcpTransport ?? "SSE"}
              onChange={(e) => onUpdate({ mcpTransport: e.target.value as "STDIO" | "SSE" })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="SSE">SSE (Remote)</option>
              <option value="STDIO">STDIO (Local)</option>
            </select>
          </Field>
          <Field label="Endpoint / Command">
            <input
              value={node.data.mcpEndpoint ?? ""}
              onChange={(e) => onUpdate({ mcpEndpoint: e.target.value })}
              placeholder="https://... or npx -y ..."
              className={inputClass}
            />
            <p className="text-[8px] text-slate-500 leading-tight">URL for SSE, command for STDIO</p>
          </Field>
        </>
      )}

      {type === "mcp_tool" && (
        <>
          <Field label="MCP Server" hint="Select a connected server to pick its tools">
            <select
              value={node.data.mcpToolServer ?? ""}
              onChange={(e) => {
                onUpdate({ mcpToolServer: e.target.value, mcpToolName: "" });
              }}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">— select server —</option>
              {mcpServers
                .filter((s) => s.status === "CONNECTED" && s.cachedTools.length > 0)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.cachedTools.length} tools)
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Tool Name" hint={node.data.mcpToolServer ? `Tools from selected server` : "Select a server first"}>
            {node.data.mcpToolServer && mcpServerToolMap.has(node.data.mcpToolServer) ? (
              <select
                value={node.data.mcpToolName ?? ""}
                onChange={(e) => onUpdate({ mcpToolName: e.target.value })}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">— select tool —</option>
                {mcpServerToolMap.get(node.data.mcpToolServer)!.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.displayName} ({t.name})
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={node.data.mcpToolName ?? ""}
                onChange={(e) => onUpdate({ mcpToolName: e.target.value })}
                placeholder="e.g. search_repositories, execute_sql"
                className={inputClass}
              />
            )}
          </Field>
          <Field label="Input Parameters (JSON)">
            <textarea
              value={node.data.mcpToolParams ? JSON.stringify(node.data.mcpToolParams, null, 2) : ""}
              onChange={(e) => {
                try { onUpdate({ mcpToolParams: e.target.value ? JSON.parse(e.target.value) : {} }); } catch {}
              }}
              rows={4}
              spellCheck={false}
              placeholder="{ }"
              className={`${inputClass} resize-y text-[9px] leading-relaxed`}
            />
          </Field>
        </>
      )}

      {type === "skill" && (
        <>
          <Field label="Skill ID">
            <input
              value={node.data.skillId ?? ""}
              onChange={(e) => onUpdate({ skillId: e.target.value })}
              placeholder="e.g. skill-web-research-pipeline"
              className={inputClass}
            />
            <p className="text-[8px] text-slate-500 leading-tight">Find skills in the Skills Marketplace tab</p>
          </Field>
          <Field label="Skill Input (JSON)">
            <textarea
              value={node.data.skillInput ? JSON.stringify(node.data.skillInput, null, 2) : ""}
              onChange={(e) => {
                try { onUpdate({ skillInput: e.target.value ? JSON.parse(e.target.value) : {} }); } catch {}
              }}
              rows={4}
              spellCheck={false}
              placeholder="{ }"
              className={`${inputClass} resize-y text-[9px] leading-relaxed`}
            />
          </Field>
        </>
      )}

      {type === "http" && (
        <>
          <Field label="Method">
            <select
              value={node.data.httpMethod ?? "GET"}
              onChange={(e) => onUpdate({ httpMethod: e.target.value as CanvasNodeData["httpMethod"] })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </Field>
          <Field label="URL">
            <input
              value={node.data.httpUrl ?? ""}
              onChange={(e) => onUpdate({ httpUrl: e.target.value })}
              placeholder="https://api.example.com/{{ input.id }}"
              className={inputClass}
            />
          </Field>
          <Field label="Headers (JSON)">
            <textarea
              value={node.data.httpHeaders ? JSON.stringify(node.data.httpHeaders, null, 2) : ""}
              onChange={(e) => {
                try { onUpdate({ httpHeaders: e.target.value ? JSON.parse(e.target.value) : {} }); } catch {}
              }}
              rows={3}
              spellCheck={false}
              placeholder={'{ "Authorization": "Bearer {{ input.token }}" }'}
              className={`${inputClass} resize-y text-[9px] leading-relaxed`}
            />
          </Field>
          <Field label="Body (JSON)">
            <textarea
              value={node.data.httpBody ? JSON.stringify(node.data.httpBody, null, 2) : ""}
              onChange={(e) => {
                try { onUpdate({ httpBody: e.target.value ? JSON.parse(e.target.value) : {} }); } catch {}
              }}
              rows={4}
              spellCheck={false}
              placeholder="{ }"
              className={`${inputClass} resize-y text-[9px] leading-relaxed`}
            />
          </Field>
          <Field label="Response Type">
            <select
              value={node.data.httpResponseType ?? "json"}
              onChange={(e) => onUpdate({ httpResponseType: e.target.value as CanvasNodeData["httpResponseType"] })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="json">JSON</option>
              <option value="text">Text</option>
              <option value="blob">Blob</option>
            </select>
          </Field>
        </>
      )}

      {type === "transform" && (
        <>
          <Field label="Operation">
            <select
              value={node.data.transformOp ?? "map"}
              onChange={(e) => onUpdate({ transformOp: e.target.value as CanvasNodeData["transformOp"] })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="map">MAP (transform each item)</option>
              <option value="filter">FILTER (keep matching items)</option>
              <option value="merge">MERGE (combine objects)</option>
              <option value="flatten">FLATTEN (nested arrays)</option>
              <option value="sort">SORT (order items)</option>
              <option value="dedupe">DEDUPE (remove duplicates)</option>
              <option value="pick">PICK (select fields)</option>
              <option value="omit">OMIT (exclude fields)</option>
              <option value="template">TEMPLATE (string interpolation)</option>
            </select>
          </Field>
          <Field label="Expression (JavaScript)">
            <textarea
              value={node.data.transformExpr ?? ""}
              onChange={(e) => onUpdate({ transformExpr: e.target.value })}
              rows={3}
              spellCheck={false}
              placeholder="(item) => ({ ...item, processed: true })"
              className={`${inputClass} resize-y text-[9px] leading-relaxed font-mono`}
            />
          </Field>
        </>
      )}

      {type === "delay" && (
        <Field label="Delay (milliseconds)">
          <input
            type="number"
            value={node.data.delayMs ?? 1000}
            onChange={(e) => onUpdate({ delayMs: parseInt(e.target.value, 10) || 0 })}
            className={inputClass}
          />
        </Field>
      )}

      {type === "aggregate" && (
        <>
          <Field label="Mode">
            <select
              value={node.data.aggregateMode ?? "concat"}
              onChange={(e) => onUpdate({ aggregateMode: e.target.value as CanvasNodeData["aggregateMode"] })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="concat">CONCAT (combine arrays)</option>
              <option value="merge">MERGE (combine objects)</option>
              <option value="count">COUNT (total items)</option>
              <option value="first">FIRST (take first result)</option>
              <option value="all">ALL (wait for all branches)</option>
              <option value="custom">CUSTOM (JS expression)</option>
            </select>
          </Field>
          {node.data.aggregateMode === "custom" && (
            <Field label="Custom Expression">
              <textarea
                value={node.data.aggregateExpr ?? ""}
                onChange={(e) => onUpdate({ aggregateExpr: e.target.value })}
                rows={3}
                spellCheck={false}
                placeholder="(results) => results.flat()"
                className={`${inputClass} resize-y text-[9px] leading-relaxed`}
              />
            </Field>
          )}
          <p className="text-[8px] text-amber-500/80 leading-tight">
            Connect multiple incoming edges — this node waits for all branches to complete before combining.
          </p>
        </>
      )}

      {type === "variable" && (
        <>
          <Field label="Variable Name">
            <input
              value={node.data.varName ?? ""}
              onChange={(e) => onUpdate({ varName: e.target.value })}
              placeholder="e.g. counter, token, context"
              className={inputClass}
            />
          </Field>
          <Field label="Operation">
            <select
              value={node.data.varOp ?? "get"}
              onChange={(e) => onUpdate({ varOp: e.target.value as CanvasNodeData["varOp"] })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="get">GET (read variable)</option>
              <option value="set">SET (write variable)</option>
            </select>
          </Field>
          {node.data.varOp === "set" && (
            <Field label="Value (JSON)">
              <textarea
                value={node.data.varValue ? JSON.stringify(node.data.varValue, null, 2) : ""}
                onChange={(e) => {
                  try { onUpdate({ varValue: e.target.value ? JSON.parse(e.target.value) : undefined }); } catch {}
                }}
                rows={3}
                spellCheck={false}
                placeholder="{{ results.agent_1.content }}"
                className={`${inputClass} resize-y text-[9px] leading-relaxed`}
              />
            </Field>
          )}
        </>
      )}

      {type === "output" && (
        <>
          <Field label="Output Template">
            <textarea
              value={node.data.outputTemplate ?? ""}
              onChange={(e) => onUpdate({ outputTemplate: e.target.value })}
              rows={4}
              spellCheck={false}
              placeholder="{{ results }}"
              className={`${inputClass} resize-y text-[9px] leading-relaxed`}
            />
            <p className="text-[8px] text-slate-500 leading-tight">{`Template for the final output. Use {{ results }} for all node results.`}</p>
          </Field>
          <Field label="Field Mappings (JSON)">
            <textarea
              value={node.data.outputFields ? JSON.stringify(node.data.outputFields, null, 2) : ""}
              onChange={(e) => {
                try { onUpdate({ outputFields: e.target.value ? JSON.parse(e.target.value) : {} }); } catch {}
              }}
              rows={4}
              spellCheck={false}
              placeholder='{ "summary": "{{ results.agent_1.content }}", "data": "{{ results.tool_1.output }}" }'
              className={`${inputClass} resize-y text-[9px] leading-relaxed`}
            />
          </Field>
        </>
      )}

      {/* Sticky Note Inspector */}
      {type === "sticky_note" && (
        <>
          <Field label="Note Color">
            <select
              value={(node.data.noteColor as string) ?? "yellow"}
              onChange={(e) => onUpdate({ noteColor: e.target.value })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="yellow">🟡 Yellow</option>
              <option value="pink">🩷 Pink</option>
              <option value="blue">🔵 Blue</option>
              <option value="green">🟢 Green</option>
              <option value="purple">🟣 Purple</option>
            </select>
          </Field>
          <Field label="Content (Markdown)">
            <textarea
              value={(node.data.noteContent as string) ?? ""}
              onChange={(e) => onUpdate({ noteContent: e.target.value })}
              rows={8}
              spellCheck={false}
              placeholder="# Notes\nAdd documentation here..."
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </Field>
        </>
      )}

      {/* Frame Inspector */}
      {type === "frame" && (
        <>
          <Field label="Frame Title">
            <input
              value={(node.data.frameTitle as string) ?? ""}
              onChange={(e) => onUpdate({ frameTitle: e.target.value })}
              placeholder="e.g. Research Phase"
              className={inputClass}
            />
          </Field>
          <Field label="Background Opacity">
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.05}
              value={(node.data.frameOpacity as number) ?? 0.08}
              onChange={(e) => onUpdate({ frameOpacity: Number(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="text-[8px] text-slate-500 text-right">
              {(((node.data.frameOpacity as number) ?? 0.08) * 100).toFixed(0)}%
            </div>
          </Field>
        </>
      )}

      {/* Breakpoint Toggle (debug mode) */}
      {onToggleBreakpoint && (type === "agent" || type === "supervisor" || type === "tool" || type === "router" || type === "approval") && (
        <div className="border-t border-slate-200 dark:border-slate-700/60 pt-2">
          <button
            type="button"
            onClick={() => onToggleBreakpoint(node.id)}
            className={clsx(
              "inline-flex w-full items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer",
              node.data.breakpoint
                ? "border-red-400 bg-red-950/40 text-red-300"
                : "border-slate-700 text-slate-400 hover:border-red-400 hover:text-red-300"
            )}
          >
            <Circle className={clsx("h-3 w-3", node.data.breakpoint ? "fill-red-500 text-red-500" : "text-slate-500")} />
            {node.data.breakpoint ? "BREAKPOINT SET" : "SET BREAKPOINT"}
          </button>
        </div>
      )}

      <div className="border-t border-slate-200 dark:border-slate-700/60 pt-2">
        <p className="text-[8px] text-slate-500 leading-tight">
          {'Edges: drag from the right handle to connect. Click an edge then edit its label in the inspector to set a branch condition.'}
        </p>
      </div>
    </div>
  );
}
