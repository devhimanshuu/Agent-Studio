"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Trash2,
  GitBranch,
  Braces,
  Boxes,
  CornerUpRight,
  RefreshCw,
  Sparkles,
  Circle,
  Sliders,
  X,
  Key,
  Globe,
  Eye,
  EyeOff,
  Loader2,
  Check,
  AlertCircle,
  Play,
  Brain,
  Zap,
  BrainCircuit,
} from "lucide-react";
import { clsx } from "clsx";
import { BUILT_IN_TOOL_CATALOG } from "@/modules/tools";
import type { CanvasNode, CanvasNodeData } from "./graphUtils";
import { GraphNodeType } from "@/types/graph";
import type { McpServerDTO } from "@/types/mcp";
import {
  GROQ_FREE_MODELS,
  GROQ_SAFETY_MODELS,
  OPENROUTER_CHAT_MODELS,
} from "@/providers/llm";
import { useModels } from "@/hooks/useModels";
import { ModelDropdown } from "@/components/common/ModelDropdown";

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

interface ModelSelectFieldProps {
  value?: string;
  customApiKey?: string;
  customApiBaseUrl?: string;
  customApiProvider?: string;
  onUpdate: (patch: {
    model?: string;
    customApiKey?: string;
    customApiBaseUrl?: string;
    customApiProvider?: string;
  }) => void;
}

const PRESET_ENDPOINTS = [
  { label: "Ollama", url: "http://localhost:11434/v1", provider: "ollama", defaultModel: "llama3.2" },
  { label: "Groq", url: "https://api.groq.com/openai/v1", provider: "groq", defaultModel: "groq/compound" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1", provider: "openrouter", defaultModel: "google/gemma-4-26b-a4b-it:free" },
  { label: "OpenAI", url: "https://api.openai.com/v1", provider: "openai", defaultModel: "gpt-4o" },
  { label: "Together", url: "https://api.together.xyz/v1", provider: "together", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  { label: "vLLM", url: "http://localhost:8000/v1", provider: "custom_openai", defaultModel: "local-model" },
];

function ModelSelectField({
  value,
  customApiKey,
  customApiBaseUrl,
  customApiProvider,
  onUpdate,
}: ModelSelectFieldProps) {
  const { allModels } = useModels();

  const [isCustom, setIsCustom] = useState(() => {
    if (customApiBaseUrl || customApiKey) return true;
    if (!value || value === "openrouter/free" || value === "") return false;
    const isKnown =
      allModels.some((m) => m.model === value) ||
      GROQ_FREE_MODELS.some((m) => m.model === value) ||
      GROQ_SAFETY_MODELS.some((m) => m.model === value) ||
      OPENROUTER_CHAT_MODELS.some((m) => m.model === value);
    return !isKnown;
  });

  const [showApiConfig, setShowApiConfig] = useState(() => Boolean(customApiKey || customApiBaseUrl));
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSelectChange = (val: string) => {
    if (val === "__custom__") {
      setIsCustom(true);
      setShowApiConfig(true);
      return;
    }
    setIsCustom(false);
    onUpdate({ model: val || undefined });
  };

  const handleTestApi = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: value || "gpt-4o",
          apiKey: customApiKey,
          apiBaseUrl: customApiBaseUrl,
          provider: customApiProvider,
        }),
      });
      const data = await res.json();
      if (res.ok && data.connected) {
        setTestResult({ ok: true, message: `Connected (${data.latencyMs}ms)` });
      } else {
        setTestResult({ ok: false, message: data.error || "Connection failed" });
      }
    } catch (err: unknown) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Field label="LLM Model" hint="Select a curated model, auto-failover router, or configure custom API endpoint">
        <ModelDropdown
          value={isCustom ? "__custom__" : (value ?? "openrouter/free")}
          onChange={handleSelectChange}
          onSelectCustom={() => {
            setIsCustom(true);
            setShowApiConfig(true);
          }}
        />
      </Field>

      {/* Model Name Input for Custom Model */}
      {isCustom && (
        <div className="space-y-1 pl-2 border-l-2 border-indigo-500/60">
          <label className="text-[8px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Custom Model Identifier
          </label>
          <input
            type="text"
            value={value ?? ""}
            onChange={(e) => onUpdate({ model: e.target.value })}
            placeholder="e.g. openai/gpt-4o, llama3.3:70b, deepseek-chat, claude-3-7-sonnet"
            className={inputClass}
          />
        </div>
      )}

      {/* Toggle Custom API & Auth Header Options */}
      <div className="pt-0.5">
        <button
          type="button"
          onClick={() => setShowApiConfig(!showApiConfig)}
          className="flex items-center justify-between w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-[9px] font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Key className="h-3 w-3 text-indigo-500" />
            <span>CUSTOM API & AUTH CONFIGURATION</span>
            {(customApiKey || customApiBaseUrl) && (
              <span className="text-[7.5px] px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                ACTIVE
              </span>
            )}
          </span>
          <span className="text-slate-400">{showApiConfig ? "–" : "+"}</span>
        </button>

        {showApiConfig && (
          <div className="mt-1.5 p-2 rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-2 text-[9px]">
            {/* Quick Endpoint Presets */}
            <div>
              <span className="text-[8px] font-mono text-slate-500 block mb-1">Quick Endpoint Presets:</span>
              <div className="flex flex-wrap gap-1">
                {PRESET_ENDPOINTS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      onUpdate({
                        customApiBaseUrl: preset.url,
                        customApiProvider: preset.provider,
                        ...(isCustom && !value ? { model: preset.defaultModel } : {}),
                      });
                    }}
                    className={clsx(
                      "px-1.5 py-0.5 rounded border text-[8px] font-mono transition-colors cursor-pointer",
                      customApiBaseUrl === preset.url
                        ? "border-indigo-500 bg-indigo-600 text-white font-bold"
                        : "border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-indigo-400"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom API Base URL */}
            <div className="space-y-1">
              <label className="text-[8px] font-mono text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Globe className="h-2.5 w-2.5 text-indigo-400" /> API Base URL / Endpoint
              </label>
              <input
                type="text"
                value={customApiBaseUrl ?? ""}
                onChange={(e) => onUpdate({ customApiBaseUrl: e.target.value.trim() || undefined })}
                placeholder="e.g. http://localhost:11434/v1, https://api.openai.com/v1"
                className={inputClass}
              />
              <p className="text-[7.5px] text-slate-500 font-mono">
                OpenAI-compatible `/chat/completions` endpoint URL.
              </p>
            </div>

            {/* Custom API Key */}
            <div className="space-y-1">
              <label className="text-[8px] font-mono text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Key className="h-2.5 w-2.5 text-indigo-400" /> Model API Key (Optional)
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={customApiKey ?? ""}
                  onChange={(e) => onUpdate({ customApiKey: e.target.value.trim() || undefined })}
                  placeholder="Enter custom API key (or leave empty to use default vault key)"
                  className={`${inputClass} pr-7`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                  title={showKey ? "Hide API key" : "Reveal API key"}
                >
                  {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
              <p className="text-[7.5px] text-slate-500 font-mono">
                Stored securely for this node. Overrides global environment keys.
              </p>
            </div>

            {/* Test Connection Button & Status */}
            <div className="pt-1 flex items-center justify-between gap-2 border-t border-indigo-200/50 dark:border-indigo-900/40">
              <button
                type="button"
                onClick={handleTestApi}
                disabled={testing}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-400/60 bg-indigo-600 hover:bg-indigo-500 text-white text-[8.5px] font-bold tracking-wider uppercase transition-colors cursor-pointer disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-2.5 w-2.5 animate-spin" /> TESTING API…
                  </>
                ) : (
                  <>
                    <Play className="h-2.5 w-2.5" /> TEST MODEL API
                  </>
                )}
              </button>

              {testResult && (
                <div
                  className={clsx(
                    "text-[8px] font-mono flex items-center gap-1 font-semibold truncate max-w-[170px]",
                    testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}
                  title={testResult.message}
                >
                  {testResult.ok ? (
                    <Check className="h-2.5 w-2.5 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-500" />
                  )}
                  <span className="truncate">{testResult.message}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmbeddingModelSelectField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (model: string) => void;
}) {
  return (
    <Field label="Vector Embedding Model" hint="Dense embedding model used to compute vector embeddings for RAG">
      <ModelDropdown
        value={value ?? "nvidia/nemotron-3-embed-1b:free"}
        onChange={onChange}
        filterCategory="embedding"
        showAutoRouter={false}
        showCustomOption={false}
      />
    </Field>
  );
}

function AudioModelSelectField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (model: string) => void;
}) {
  return (
    <Field label="Audio Speech & STT Model" hint="Cloud Groq LPU transcription or local Faster-Whisper">
      <ModelDropdown
        value={value ?? "whisper-large-v3-turbo"}
        onChange={onChange}
        filterCategory="audio"
        showAutoRouter={false}
        showCustomOption={false}
      />
    </Field>
  );
}

function VisionModelSelectField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (model: string) => void;
}) {
  return (
    <Field label="Document Vision & OCR Model" hint="Multimodal vision model used to parse charts, figures and tables">
      <ModelDropdown
        value={value ?? "nvidia/nemotron-nano-12b-v2-vl:free"}
        onChange={onChange}
        filterCategory="vision"
        showAutoRouter={false}
        showCustomOption={false}
      />
    </Field>
  );
}

function HyperparametersField({
  temperature,
  maxTokens,
  onChange,
}: {
  temperature?: number;
  maxTokens?: number;
  onChange: (patch: { temperature?: number; maxTokens?: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50/50 dark:bg-black/30 p-2 space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-400 cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          <Sliders className="h-3 w-3 text-indigo-400" />
          <span>SAMPLING & LIMITS</span>
          <span className="text-[8px] font-normal text-slate-400">({temperature ?? 0.2} temp · {maxTokens ?? 800} max)</span>
        </span>
        <span className="text-[8px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-indigo-950/50">
          <Field label="Temperature" hint="0 = deterministic, 1 = creative">
            <input
              type="number"
              step={0.05}
              min={0}
              max={2}
              value={temperature ?? 0.2}
              onChange={(e) => onChange({ temperature: parseFloat(e.target.value) || 0 })}
              className={inputClass}
            />
          </Field>
          <Field label="Max Output Tokens" hint="Cap response length">
            <input
              type="number"
              step={100}
              min={50}
              max={8192}
              value={maxTokens ?? 800}
              onChange={(e) => onChange({ maxTokens: parseInt(e.target.value, 10) || 800 })}
              className={inputClass}
            />
          </Field>
        </div>
      )}
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

      {/* ─── Real-Time Token Streaming & Trace Monitor ─── */}
      {node.data.traceTokenStream && (node.data.traceTokenStream.text || node.data.traceStatus === "RUNNING") && (
        <div className="p-3 rounded-lg border border-cyan-500/40 bg-slate-950/95 dark:bg-black/95 font-mono space-y-2 shadow-lg shadow-cyan-950/40">
          <div className="flex items-center justify-between border-b border-indigo-950/80 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
              <span className="flex items-center gap-1 text-[9px] font-pixel text-cyan-300 uppercase tracking-wide">
                {node.data.traceTokenStream.isThinking ? (
                  <>
                    <Brain className="h-3 w-3 text-violet-400" /> REASONING ACTIVE
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3 text-cyan-400" /> LIVE TOKEN STREAM
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[8px] font-mono">
              {node.data.traceTokenStream.tokensPerSec ? (
                <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-bold">
                  {node.data.traceTokenStream.tokensPerSec} tok/s
                </span>
              ) : (
                <span className="text-cyan-400 font-bold">STREAMING</span>
              )}
              {node.data.traceTokenStream.totalTokens !== undefined && (
                <span className="text-slate-400">
                  {node.data.traceTokenStream.totalTokens} tokens
                </span>
              )}
            </div>
          </div>

          {/* Stream Buffer Display */}
          <div className="p-2 rounded bg-[#070709] border border-slate-800/80 max-h-48 overflow-y-auto font-mono text-[9px] text-slate-200 leading-relaxed custom-scrollbar whitespace-pre-wrap select-text break-words">
            {node.data.traceTokenStream.text ? (
              <>
                {node.data.traceTokenStream.text.includes("<think>") ? (
                  (() => {
                    const parts = node.data.traceTokenStream.text.split(/<\/?think>/);
                    return (
                      <>
                        {parts[1] && (
                          <div className="p-2 rounded bg-violet-950/40 border border-violet-800/40 text-violet-300 text-[8px] mb-2 font-mono">
                            <span className="text-[7.5px] font-bold uppercase text-violet-400 flex items-center gap-1 mb-1">
                              <BrainCircuit className="h-3 w-3 text-violet-400" /> Chain-of-Thought / Deep Reasoning:
                            </span>
                            {parts[1]}
                          </div>
                        )}
                        <span>{parts.slice(2).join("") || parts[0]}</span>
                      </>
                    );
                  })()
                ) : (
                  <span>{node.data.traceTokenStream.text}</span>
                )}
                {node.data.traceTokenStream.active && (
                  <span className="inline-block w-1.5 h-3.5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse ml-0.5 align-middle" />
                )}
              </>
            ) : (
              <span className="text-slate-500 italic">Waiting for initial token chunk from provider...</span>
            )}
          </div>
        </div>
      )}

      {type === "agent" && (
        <>
          <ModelSelectField
            value={node.data.model}
            customApiKey={node.data.customApiKey}
            customApiBaseUrl={node.data.customApiBaseUrl}
            customApiProvider={node.data.customApiProvider}
            onUpdate={(patch) => onUpdate(patch)}
          />
          <HyperparametersField
            temperature={node.data.temperature}
            maxTokens={node.data.maxTokens}
            onChange={(patch) => onUpdate(patch)}
          />
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
            <div className="text-[8px] text-red-400 flex items-center gap-1">
              <X className="h-2.5 w-2.5 shrink-0" /> {optimizeError}
            </div>
          )}
        </>
      )}

      {type === "supervisor" && (
        <>
          <ModelSelectField
            value={node.data.model}
            customApiKey={node.data.customApiKey}
            customApiBaseUrl={node.data.customApiBaseUrl}
            customApiProvider={node.data.customApiProvider}
            onUpdate={(patch) => onUpdate(patch)}
          />
          <HyperparametersField
            temperature={node.data.temperature}
            maxTokens={node.data.maxTokens}
            onChange={(patch) => onUpdate(patch)}
          />
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
            <div className="text-[8px] text-red-400 flex items-center gap-1">
              <X className="h-2.5 w-2.5 shrink-0" /> {optimizeError}
            </div>
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
            <>
              <ModelSelectField
                value={node.data.model}
                customApiKey={node.data.customApiKey}
                customApiBaseUrl={node.data.customApiBaseUrl}
                customApiProvider={node.data.customApiProvider}
                onUpdate={(patch) => onUpdate(patch)}
              />
              <PromptField
                label="Router Prompt"
                hint={'The model returns { "next": "<edge label>" }.'}
                value={node.data.routerPrompt ?? ""}
                onChange={(v) => onUpdate({ routerPrompt: v })}
                rows={4}
                allNodeIds={allNodeIds}
              />
            </>
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

      {/* ─── Schedule Trigger Inspector ─── */}
      {type === "schedule_trigger" && (
        <>
          <Field label="Cron Expression" hint="Standard 5-field cron (min hour dom month dow)">
            <input
              value={node.data.cronExpression ?? "0 9 * * *"}
              onChange={(e) => onUpdate({ cronExpression: e.target.value })}
              placeholder="0 9 * * *"
              className={inputClass}
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {[
                { label: "Hourly", expr: "0 * * * *", desc: "Every hour" },
                { label: "Daily 9AM", expr: "0 9 * * *", desc: "Every day at 9:00 AM" },
                { label: "Weekdays", expr: "0 9 * * 1-5", desc: "Mon-Fri at 9:00 AM" },
                { label: "Every 15m", expr: "*/15 * * * *", desc: "Every 15 minutes" },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onUpdate({ cronExpression: preset.expr, scheduleInterval: preset.desc })}
                  className="px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/40 text-[8px] font-mono text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Timezone">
            <input
              value={node.data.cronTimezone ?? "UTC"}
              onChange={(e) => onUpdate({ cronTimezone: e.target.value })}
              placeholder="UTC, America/New_York, Asia/Kolkata"
              className={inputClass}
            />
          </Field>
          <Field label="Schedule Description">
            <input
              value={node.data.scheduleInterval ?? "Every day at 9:00 AM UTC"}
              onChange={(e) => onUpdate({ scheduleInterval: e.target.value })}
              placeholder="Human-readable schedule description"
              className={inputClass}
            />
          </Field>
        </>
      )}

      {/* ─── Webhook Trigger Inspector ─── */}
      {type === "webhook_trigger" && (
        <>
          <Field label="Webhook Endpoint Path">
            <input
              value={node.data.webhookPath ?? "/api/webhooks/incoming"}
              onChange={(e) => onUpdate({ webhookPath: e.target.value })}
              placeholder="/api/webhooks/my-trigger"
              className={inputClass}
            />
          </Field>
          <Field label="HTTP Method">
            <select
              value={node.data.webhookMethod ?? "POST"}
              onChange={(e) => onUpdate({ webhookMethod: e.target.value as "GET" | "POST" | "PUT" })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="POST">POST (Standard Event Body)</option>
              <option value="GET">GET (Query Parameters)</option>
              <option value="PUT">PUT (Payload Update)</option>
            </select>
          </Field>
          <Field label="Secret Token (Optional)" hint="Validates Authorization: Bearer <secret> or X-Webhook-Secret">
            <input
              type="password"
              value={node.data.webhookSecret ?? ""}
              onChange={(e) => onUpdate({ webhookSecret: e.target.value })}
              placeholder="whsec_..."
              className={inputClass}
            />
          </Field>
        </>
      )}

      {/* ─── RSS / Atom Feed Ingestion Inspector ─── */}
      {type === "rss_feed" && (
        <>
          <Field label="Feed URL" hint="Supports any valid RSS 2.0 or Atom XML URL">
            <input
              value={node.data.rssUrl ?? ""}
              onChange={(e) => onUpdate({ rssUrl: e.target.value })}
              placeholder="https://news.ycombinator.com/rss"
              className={inputClass}
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {[
                { label: "Hacker News", url: "https://news.ycombinator.com/rss" },
                { label: "TechCrunch", url: "https://techcrunch.com/feed/" },
                { label: "ArXiv AI", url: "https://export.arxiv.org/rss/cs.AI" },
                { label: "GitHub Releases", url: "https://github.com/facebook/react/releases.atom" },
              ].map((feed) => (
                <button
                  key={feed.label}
                  type="button"
                  onClick={() => onUpdate({ rssUrl: feed.url })}
                  className="px-1.5 py-0.5 rounded border border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-orange-950/40 text-[8px] font-mono text-orange-700 dark:text-orange-300 hover:bg-orange-100"
                >
                  {feed.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Max Items to Ingest">
            <input
              type="number"
              min={1}
              max={50}
              value={node.data.rssMaxItems ?? 10}
              onChange={(e) => onUpdate({ rssMaxItems: parseInt(e.target.value, 10) || 10 })}
              className={inputClass}
            />
          </Field>
        </>
      )}

      {/* ─── Jina Web Reader Inspector ─── */}
      {type === "web_reader" && (
        <>
          <Field label="Target Web Page URL" hint="Converts any live website into clean LLM markdown via r.jina.ai">
            <input
              value={node.data.readerUrl ?? ""}
              onChange={(e) => onUpdate({ readerUrl: e.target.value })}
              placeholder="https://example.com or {{ input.url }}"
              className={inputClass}
            />
          </Field>
          <Field label="Reader Format Mode">
            <select
              value={node.data.readerFormat ?? "markdown"}
              onChange={(e) => onUpdate({ readerFormat: e.target.value as "markdown" | "text" | "html" })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="markdown">Clean Markdown (Recommended for LLMs)</option>
              <option value="text">Plain Text</option>
              <option value="html">Sanitized HTML</option>
            </select>
          </Field>
          <Field label="CSS Selector Target (Optional)" hint="Extracts only specific article container or main body">
            <input
              value={node.data.readerTargetSelector ?? ""}
              onChange={(e) => onUpdate({ readerTargetSelector: e.target.value })}
              placeholder="article, main, .content"
              className={inputClass}
            />
          </Field>
        </>
      )}

      {/* ─── Notification Dispatcher Inspector ─── */}
      {type === "notification_dispatcher" && (
        <>
          <Field label="Destination Platform">
            <select
              value={node.data.dispatchDestination ?? "discord"}
              onChange={(e) => onUpdate({ dispatchDestination: e.target.value as "discord" | "slack" | "telegram" | "webhook" })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="discord">Discord Webhook</option>
              <option value="slack">Slack Incoming Webhook</option>
              <option value="telegram">Telegram Bot</option>
              <option value="webhook">Generic HTTP Webhook</option>
            </select>
          </Field>
          {node.data.dispatchDestination === "telegram" ? (
            <>
              <Field label="Telegram Bot Token">
                <input
                  type="password"
                  value={node.data.telegramBotToken ?? ""}
                  onChange={(e) => onUpdate({ telegramBotToken: e.target.value })}
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  className={inputClass}
                />
              </Field>
              <Field label="Telegram Chat ID">
                <input
                  value={node.data.telegramChatId ?? ""}
                  onChange={(e) => onUpdate({ telegramChatId: e.target.value })}
                  placeholder="-1001234567890 or @channelname"
                  className={inputClass}
                />
              </Field>
            </>
          ) : (
            <Field label="Webhook URL" hint="Paste Discord/Slack webhook URL or custom endpoint">
              <input
                value={node.data.dispatchWebhookUrl ?? ""}
                onChange={(e) => onUpdate({ dispatchWebhookUrl: e.target.value })}
                placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
                className={inputClass}
              />
            </Field>
          )}
          <Field label="Message Content Template">
            <textarea
              value={node.data.dispatchMessage ?? ""}
              onChange={(e) => onUpdate({ dispatchMessage: e.target.value })}
              rows={4}
              spellCheck={false}
              placeholder="**Alert Report:**\n{{ results.agent_1 }}"
              className={`${inputClass} resize-y text-[9px] leading-relaxed`}
            />
            <p className="text-[8px] text-slate-500 leading-tight">
              Supports markdown and template variables (e.g. {`{{ results.<nodeId> }}`})
            </p>
          </Field>
        </>
      )}

      {/* ─── Data Mapper Inspector ─── */}
      {type === "data_mapper" && (
        <>
          <Field label="Schema Mappings (JSON)" hint="Maps output fields to dot-paths or expressions">
            <textarea
              value={node.data.mapperSchema ? JSON.stringify(node.data.mapperSchema, null, 2) : ""}
              onChange={(e) => {
                try { onUpdate({ mapperSchema: e.target.value ? JSON.parse(e.target.value) : {} }); } catch {}
              }}
              rows={5}
              spellCheck={false}
              placeholder='{\n  "title": "item.title",\n  "url": "item.link",\n  "score": "item.score"\n}'
              className={`${inputClass} resize-y text-[9px] leading-relaxed font-mono`}
            />
          </Field>
          <Field label="Custom JSONPath / Transform Expression (Optional)">
            <input
              value={node.data.mapperExpression ?? ""}
              onChange={(e) => onUpdate({ mapperExpression: e.target.value })}
              placeholder="$.items[?(@.score > 100)]"
              className={inputClass}
            />
          </Field>
        </>
      )}

      {/* ─── SearXNG Metasearch Inspector ─── */}
      {type === "searxng_search" && (
        <>
          <Field label="SearXNG Instance Endpoint" hint="Any public instance or self-hosted SearXNG (e.g. http://localhost:8080)">
            <input
              value={node.data.searxngHost ?? "https://searx.be"}
              onChange={(e) => onUpdate({ searxngHost: e.target.value })}
              placeholder="https://searx.be or http://localhost:8080"
              className={inputClass}
            />
          </Field>
          <Field label="Search Query Template" hint="Supports template strings like {{ input.query }} or {{ results.agent.topic }}">
            <input
              value={node.data.searxngQuery ?? ""}
              onChange={(e) => onUpdate({ searxngQuery: e.target.value })}
              placeholder="autonomous AI agents or {{ input.query }}"
              className={inputClass}
            />
          </Field>
          <Field label="Max Results Limit">
            <input
              type="number"
              min={1}
              max={20}
              value={node.data.searxngLimit ?? 5}
              onChange={(e) => onUpdate({ searxngLimit: parseInt(e.target.value, 10) || 5 })}
              className={inputClass}
            />
          </Field>
        </>
      )}

      {/* ─── Crawl4AI Scraper Inspector ─── */}
      {type === "crawl4ai_scrape" && (
        <>
          <Field label="Target Page URL" hint="Supports template strings like {{ input.targetUrl }} or {{ results.searxng.url }}">
            <input
              value={node.data.crawl4aiUrl ?? ""}
              onChange={(e) => onUpdate({ crawl4aiUrl: e.target.value })}
              placeholder="https://news.ycombinator.com or {{ results.search.url }}"
              className={inputClass}
            />
          </Field>
          <Field label="Crawl4AI Service Host (Optional)" hint="Self-hosted Crawl4AI Docker endpoint (defaults to built-in cleaner)">
            <input
              value={node.data.crawl4aiHost ?? ""}
              onChange={(e) => onUpdate({ crawl4aiHost: e.target.value })}
              placeholder="http://localhost:11235"
              className={inputClass}
            />
          </Field>
          <Field label="CSS Selector Extraction (Optional)" hint="Filter article body, table, or main container">
            <input
              value={node.data.crawl4aiSelector ?? ""}
              onChange={(e) => onUpdate({ crawl4aiSelector: e.target.value })}
              placeholder="main, article, .content-body"
              className={inputClass}
            />
          </Field>
        </>
      )}

      {/* ─── Docling PDF & Document Parser Inspector ─── */}
      {type === "docling_pdf_parser" && (
        <>
          <VisionModelSelectField
            value={node.data.model}
            onChange={(m) => onUpdate({ model: m || undefined })}
          />
          <Field label="Document / PDF URL" hint="Target PDF file, paper URL, or local path">
            <input
              value={node.data.doclingDocumentUrl ?? ""}
              onChange={(e) => onUpdate({ doclingDocumentUrl: e.target.value })}
              placeholder="https://arxiv.org/pdf/1706.03762.pdf or {{ input.pdfUrl }}"
              className={inputClass}
            />
          </Field>
          <Field label="Output Format">
            <select
              value={node.data.doclingOutputFormat ?? "markdown"}
              onChange={(e) => onUpdate({ doclingOutputFormat: e.target.value as "markdown" | "json" | "html" })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="markdown">Structured Markdown with Tables</option>
              <option value="json">Structured JSON (Tokens + BBoxes)</option>
              <option value="html">Semantic HTML</option>
            </select>
          </Field>
          <Field label="Docling Service Host (Optional)" hint="Self-hosted Docling REST service (e.g. http://localhost:5001)">
            <input
              value={node.data.doclingHost ?? ""}
              onChange={(e) => onUpdate({ doclingHost: e.target.value })}
              placeholder="http://localhost:5001"
              className={inputClass}
            />
          </Field>
        </>
      )}

      {/* ─── Gotenberg PDF Exporter Inspector ─── */}
      {type === "gotenberg_pdf_exporter" && (
        <>
          <Field label="Gotenberg Service Host" hint="Docker gotenberg/gotenberg endpoint">
            <input
              value={node.data.gotenbergHost ?? "http://localhost:3000"}
              onChange={(e) => onUpdate({ gotenbergHost: e.target.value })}
              placeholder="http://localhost:3000"
              className={inputClass}
            />
          </Field>
          <Field label="Paper Size & Layout">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={node.data.gotenbergPaperSize ?? "A4"}
                onChange={(e) => onUpdate({ gotenbergPaperSize: e.target.value as "A4" | "Letter" | "Legal" })}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="A4">A4 Standard</option>
                <option value="Letter">US Letter</option>
                <option value="Legal">Legal</option>
              </select>
              <label className="flex items-center gap-1.5 text-[9px] text-slate-700 dark:text-slate-300 font-mono">
                <input
                  type="checkbox"
                  checked={node.data.gotenbergLandscape ?? false}
                  onChange={(e) => onUpdate({ gotenbergLandscape: e.target.checked })}
                  className="rounded border-slate-400"
                />
                Landscape
              </label>
            </div>
          </Field>
          <Field label="HTML / Markdown Report Template" hint="Content to render to PDF. Supports {{ results.<nodeId> }}">
            <textarea
              value={node.data.gotenbergHtmlContent ?? ""}
              onChange={(e) => onUpdate({ gotenbergHtmlContent: e.target.value })}
              rows={5}
              spellCheck={false}
              placeholder="<h1>Executive Summary</h1>\n<p>{{ results.agent }}</p>"
              className={`${inputClass} resize-y text-[9px] leading-relaxed font-mono`}
            />
          </Field>
        </>
      )}

      {/* ─── NocoDB Record Inspector ─── */}
      {type === "nocodb_record" && (
        <>
          <Field label="NocoDB Host URL" hint="Self-hosted NocoDB instance (e.g. http://localhost:8080)">
            <input
              value={node.data.nocodbHost ?? "http://localhost:8080"}
              onChange={(e) => onUpdate({ nocodbHost: e.target.value })}
              placeholder="http://localhost:8080"
              className={inputClass}
            />
          </Field>
          <Field label="Table ID / Table Name">
            <input
              value={node.data.nocodbTableId ?? ""}
              onChange={(e) => onUpdate({ nocodbTableId: e.target.value })}
              placeholder="tbl_leads, tbl_articles"
              className={inputClass}
            />
          </Field>
          <Field label="Database Operation">
            <select
              value={node.data.nocodbOperation ?? "create"}
              onChange={(e) => onUpdate({ nocodbOperation: e.target.value as "create" | "list" | "find" | "update" })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="create">CREATE (Insert New Record)</option>
              <option value="list">LIST (Query / Find Rows)</option>
              <option value="find">FIND BY ID</option>
              <option value="update">UPDATE (Patch Record)</option>
            </select>
          </Field>
          <Field label="Record Payload / Query Data (JSON)" hint="Row values to insert or query filters">
            <textarea
              value={node.data.nocodbData ? JSON.stringify(node.data.nocodbData, null, 2) : "{}"}
              onChange={(e) => {
                try { onUpdate({ nocodbData: e.target.value ? JSON.parse(e.target.value) : {} }); } catch {}
              }}
              rows={4}
              spellCheck={false}
              placeholder='{\n  "title": "{{ results.agent.title }}",\n  "status": "APPROVED"\n}'
              className={`${inputClass} resize-y text-[9px] leading-relaxed font-mono`}
            />
          </Field>
        </>
      )}

      {/* ─── PocketBase Store Inspector ─── */}
      {type === "pocketbase_store" && (
        <>
          <Field label="PocketBase Host URL" hint="Self-hosted PocketBase single binary (e.g. http://127.0.0.1:8090)">
            <input
              value={node.data.pocketbaseHost ?? "http://127.0.0.1:8090"}
              onChange={(e) => onUpdate({ pocketbaseHost: e.target.value })}
              placeholder="http://127.0.0.1:8090"
              className={inputClass}
            />
          </Field>
          <Field label="Collection Name">
            <input
              value={node.data.pocketbaseCollection ?? "agent_state"}
              onChange={(e) => onUpdate({ pocketbaseCollection: e.target.value })}
              placeholder="agent_state, session_logs"
              className={inputClass}
            />
          </Field>
          <Field label="Store Action">
            <select
              value={node.data.pocketbaseAction ?? "create"}
              onChange={(e) => onUpdate({ pocketbaseAction: e.target.value as "create" | "get" | "list" | "update" })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="create">CREATE (Insert Document)</option>
              <option value="get">GET (Retrieve by ID)</option>
              <option value="list">LIST (Query Collection)</option>
              <option value="update">UPDATE (Patch Document)</option>
            </select>
          </Field>
          <Field label="Auth Token (Optional)" hint="PocketBase admin or user auth token for protected collections">
            <input
              value={node.data.pocketbaseAuthToken ?? ""}
              onChange={(e) => onUpdate({ pocketbaseAuthToken: e.target.value })}
              placeholder="pbc_xxx... (leave empty for public)"
              className={inputClass}
              type="password"
            />
          </Field>
        </>
      )}

      {/* ─── Qdrant Vector Memory Inspector ─── */}
      {type === "qdrant_vector_memory" && (
        <>
          <EmbeddingModelSelectField
            value={node.data.model}
            onChange={(m) => onUpdate({ model: m || undefined })}
          />
          <Field label="Qdrant Host URL" hint="Self-hosted Qdrant vector database (e.g. http://localhost:6333)">
            <input
              value={node.data.qdrantHost ?? "http://localhost:6333"}
              onChange={(e) => onUpdate({ qdrantHost: e.target.value })}
              placeholder="http://localhost:6333"
              className={inputClass}
            />
          </Field>
          <Field label="Vector Collection Name">
            <input
              value={node.data.qdrantCollection ?? "knowledge_base"}
              onChange={(e) => onUpdate({ qdrantCollection: e.target.value })}
              placeholder="knowledge_base, user_memories"
              className={inputClass}
            />
          </Field>
          <Field label="Semantic Search Query Template">
            <input
              value={node.data.qdrantQuery ?? ""}
              onChange={(e) => onUpdate({ qdrantQuery: e.target.value })}
              placeholder="{{ input.question }} or search text"
              className={inputClass}
            />
          </Field>
          <Field label="Top K Nearest Neighbors">
            <input
              type="number"
              min={1}
              max={20}
              value={node.data.qdrantTopK ?? 3}
              onChange={(e) => onUpdate({ qdrantTopK: parseInt(e.target.value, 10) || 3 })}
              className={inputClass}
            />
          </Field>
          <Field label="API Key (Optional)" hint="Qdrant API key if QDRANT__SERVICE__API_KEY is set on the server">
            <input
              value={node.data.qdrantApiKey ?? ""}
              onChange={(e) => onUpdate({ qdrantApiKey: e.target.value })}
              placeholder="qdrant_xxx... (leave empty for no auth)"
              className={inputClass}
              type="password"
            />
          </Field>
        </>
      )}

      {/* ─── Audio Transcriber (Faster-Whisper) Inspector ─── */}
      {type === "audio_transcriber" && (
        <>
          <AudioModelSelectField
            value={node.data.model}
            onChange={(m) => onUpdate({ model: m || undefined })}
          />
          <Field label="Audio Source URL / Base64" hint="Direct audio URL (.mp3, .wav) or template {{ input.audioUrl }}">
            <input
              value={node.data.audioSourceUrl ?? ""}
              onChange={(e) => onUpdate({ audioSourceUrl: e.target.value })}
              placeholder="https://example.com/recording.mp3 or {{ input.audioUrl }}"
              className={inputClass}
            />
          </Field>
          <Field label="Audio Language Code">
            <input
              value={node.data.audioLanguage ?? "auto"}
              onChange={(e) => onUpdate({ audioLanguage: e.target.value })}
              placeholder="auto, en, es, de, fr, hi"
              className={inputClass}
            />
          </Field>
          <Field label="Faster-Whisper Service Host (Optional)" hint="Self-hosted Faster-Whisper REST API">
            <input
              value={node.data.audioTranscriberHost ?? ""}
              onChange={(e) => onUpdate({ audioTranscriberHost: e.target.value })}
              placeholder="http://localhost:8000"
              className={inputClass}
            />
          </Field>
        </>
      )}

      {/* ─── Piper TTS Voice Synthesizer Inspector ─── */}
      {type === "piper_tts" && (
        <>
          <Field label="Speech Voice Model">
            <input
              value={node.data.piperVoice ?? "en_US-lessac-medium"}
              onChange={(e) => onUpdate({ piperVoice: e.target.value })}
              placeholder="en_US-lessac-medium, en_GB-alan-medium"
              className={inputClass}
            />
          </Field>
          <Field label="Text Content to Speak Template" hint="Supports template strings like {{ results.agent }}">
            <textarea
              value={node.data.piperText ?? ""}
              onChange={(e) => onUpdate({ piperText: e.target.value })}
              rows={4}
              spellCheck={false}
              placeholder="{{ results.agent }} or Hello, how may I assist you today?"
              className={`${inputClass} resize-y text-[9px] leading-relaxed`}
            />
          </Field>
          <Field label="Piper Service Host (Optional)">
            <input
              value={node.data.piperHost ?? ""}
              onChange={(e) => onUpdate({ piperHost: e.target.value })}
              placeholder="http://localhost:5000"
              className={inputClass}
            />
          </Field>
        </>
      )}

      {/* ─── Google A2A Protocol: A2A Delegate Inspector ─── */}
      {type === "a2a_delegate" && (
        <>
          <Field label="Remote A2A Agent Endpoint" hint="Google A2A compliant agent URL (supports /.well-known/agent.json)">
            <input
              value={node.data.a2aAgentUrl ?? ""}
              onChange={(e) => onUpdate({ a2aAgentUrl: e.target.value })}
              placeholder="https://a2a.agents.google.dev/v1/gemini-researcher/tasks"
              className={inputClass}
            />
          </Field>
          <Field label="Target Capability ID">
            <input
              value={node.data.a2aCapability ?? "deep_research"}
              onChange={(e) => onUpdate({ a2aCapability: e.target.value })}
              placeholder="deep_research, security_audit, sentiment_analysis"
              className={inputClass}
            />
          </Field>
          <Field label="Auth Token / API Key (Optional)">
            <input
              type="password"
              value={node.data.a2aAuthToken ?? ""}
              onChange={(e) => onUpdate({ a2aAuthToken: e.target.value })}
              placeholder="Bearer a2a_sk_..."
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="SLA Timeout (ms)">
              <input
                type="number"
                value={node.data.a2aTimeoutMs ?? 60000}
                onChange={(e) => onUpdate({ a2aTimeoutMs: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Fallback Strategy">
              <select
                value={node.data.a2aFallbackStrategy ?? "retry"}
                onChange={(e) => onUpdate({ a2aFallbackStrategy: e.target.value as "retry" | "fail" | "skip" | "local_agent" })}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="retry">Retry (2x)</option>
                <option value="fail">Fail Run</option>
                <option value="skip">Skip Node</option>
                <option value="local_agent">Local Fallback</option>
              </select>
            </Field>
          </div>
        </>
      )}

      {/* ─── Google A2A Protocol: A2A Channel / Swarm Inspector ─── */}
      {type === "a2a_channel" && (
        <>
          <Field label="Swarm Coordination Mode">
            <select
              value={node.data.a2aChannelMode ?? "debate"}
              onChange={(e) => onUpdate({ a2aChannelMode: e.target.value as "debate" | "round_robin" | "consensus" | "delegation" })}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="debate">Debate & Peer Review</option>
              <option value="consensus">Consensus Voting</option>
              <option value="round_robin">Round-Robin Turns</option>
              <option value="delegation">Supervisor Delegation</option>
            </select>
          </Field>
          <Field label="Channel Discussion Topic / Goal" hint="Supports dynamic templates {{ results.agent }}">
            <textarea
              value={node.data.a2aChannelTopic ?? ""}
              onChange={(e) => onUpdate({ a2aChannelTopic: e.target.value })}
              rows={3}
              placeholder="Synthesize findings into strategic conclusion..."
              className={`${inputClass} resize-y text-[9px]`}
            />
          </Field>
          <Field label="Max Dialogue Turns">
            <input
              type="number"
              min={1}
              max={10}
              value={node.data.a2aMaxTurns ?? 2}
              onChange={(e) => onUpdate({ a2aMaxTurns: Number(e.target.value) })}
              className={inputClass}
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
              <option value="yellow">Yellow</option>
              <option value="pink">Pink</option>
              <option value="blue">Blue</option>
              <option value="green">Green</option>
              <option value="purple">Purple</option>
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
