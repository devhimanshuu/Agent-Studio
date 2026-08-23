"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Wand2,
  Loader2,
  Sparkles,
  Server,
  FileCode2,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  GitBranch,
  Zap,
  Shield,
  Bot,
  Wrench,
  RefreshCw,
} from "lucide-react";
import { clsx } from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/stores/toastStore";
import type { AgentGraphDefinition, GraphNodeType } from "@/types/graph";

// ────────────── Types ──────────────

interface SynthesizedServer {
  name: string;
  searchQuery: string;
  purpose: string;
  category: string;
  directoryMatch?: {
    id: string;
    name: string;
    source: string;
    endpointUrl?: string;
    command?: string;
    transport: string;
    description: string;
    tags: string[];
    stars: number;
  };
}

interface SynthesisResult {
  analysis: {
    goal: string;
    servers: SynthesizedServer[];
    steps: string[];
  };
  graph: AgentGraphDefinition;
  skillName: string;
  skillPurpose: string;
  servers: SynthesizedServer[];
  mountedServerIds: string[];
  skillId: string | null;
  warning?: string;
}

// ────────────── Helpers ──────────────

const NODE_ICONS: Partial<Record<GraphNodeType, React.ComponentType<{ className?: string }>>> = {
  start: Zap,
  end: Zap,
  agent: Bot,
  supervisor: GitBranch,
  tool: Wrench,
  router: GitBranch,
  approval: Shield,
  mcp_tool: Server,
  mcp_server: Server,
  loop: RefreshCw,
};

const NODE_COLORS: Partial<Record<GraphNodeType, string>> = {
  start: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
  end: "border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300",
  agent: "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300",
  supervisor: "border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300",
  tool: "border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300",
  router: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
  approval: "border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300",
  mcp_tool: "border-fuchsia-300 dark:border-fuchsia-500/40 bg-fuchsia-50 dark:bg-fuchsia-950/30 text-fuchsia-700 dark:text-fuchsia-300",
  mcp_server: "border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300",
  loop: "border-fuchsia-300 dark:border-fuchsia-500/40 bg-fuchsia-50 dark:bg-fuchsia-950/30 text-fuchsia-700 dark:text-fuchsia-300",
  parallel: "border-teal-300 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300",
};

const EXAMPLE_PROMPTS = [
  {
    label: "GitHub Issue Monitor",
    prompt:
      "Automate checking new GitHub issues, querying our Postgres DB for user tier, and posting high-priority alerts to Slack",
  },
  {
    label: "Customer Support Pipeline",
    prompt:
      "Build a support pipeline that classifies incoming tickets, routes billing questions to Stripe lookup, technical issues to GitHub issue creation, and sends Slack notifications with approval gates before responding",
  },
  {
    label: "Data ETL Pipeline",
    prompt:
      "Extract data from PostgreSQL, transform it with Python, load into Snowflake, and send a completion report to Slack",
  },
  {
    label: "Content Scheduler",
    prompt:
      "Pull content from Notion, generate social media posts, schedule them on Twitter/X, and track engagement metrics",
  },
  {
    label: "Incident Response",
    prompt:
      "Monitor Sentry for critical errors, create GitHub issues, alert the team on Slack, and require human approval before deploying hotfixes",
  },
];

// ────────────── Component ──────────────

export function SkillSynthesizer() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [result, setResult] = useState<SynthesisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [expandedServers, setExpandedServers] = useState<Set<number>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSynthesize = useCallback(
    async (autoMount: boolean = false) => {
      if (!prompt.trim() || isSynthesizing) return;

      setIsSynthesizing(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/skills/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), autoMount }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error ?? `Synthesis failed (${res.status})`);
        }

        const data = await res.json();
        if (data.success && data.data) {
          setResult(data.data);
          if (data.data.skillId) {
            setInstalled(true);
            queryClient.invalidateQueries({ queryKey: ["skills"] });
            toast.success(
              "Skill synthesized & installed!",
              `${data.data.skillName} is ready in your Studio`
            );
          } else if (data.data.warning) {
            toast.success("Graph generated", data.data.warning);
          }
        } else {
          throw new Error(data.error ?? "Synthesis failed");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Synthesis failed");
      } finally {
        setIsSynthesizing(false);
      }
    },
    [prompt, isSynthesizing, queryClient]
  );

  const handleInstallOnly = useCallback(async () => {
    if (!result || installed) return;
    setInstalling(true);
    try {
      // Re-synthesize with autoMount=true
      setIsSynthesizing(true);
      const res = await fetch("/api/skills/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), autoMount: true }),
      });

      if (!res.ok) throw new Error("Installation failed");

      const data = await res.json();
      if (data.success && data.data?.skillId) {
        setResult(data.data);
        setInstalled(true);
        queryClient.invalidateQueries({ queryKey: ["skills"] });
        toast.success("Installed!", `${data.data.skillName} is now in your Studio`);
      } else {
        throw new Error(data.data?.warning || "Installation failed");
      }
    } catch (e) {
      toast.error("Install failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setInstalling(false);
      setIsSynthesizing(false);
    }
  }, [result, installed, prompt, queryClient]);

  const toggleServer = (idx: number) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-violet-500" />
          SKILL SYNTHESIZER
        </h2>
        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
          Describe your goal in natural language — get a multi-agent graph with MCP servers auto-discovered
        </p>
      </div>

      {/* Prompt Input */}
      <div className="rounded-xl border border-indigo-300 dark:border-indigo-500/40 bg-white dark:bg-[#0a0a0a]/80 shadow-lg shadow-indigo-500/5 overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSynthesize(false);
                }
              }}
              placeholder="Describe your automation goal...&#10;&#10;e.g. &quot;Automate checking new GitHub issues, querying our Postgres DB for user tier, and posting high-priority alerts to Slack&quot;"
              rows={4}
              className="w-full bg-transparent text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none resize-none"
              disabled={isSynthesizing}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSynthesize(false)}
                disabled={!prompt.trim() || isSynthesizing}
                className={clsx(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer",
                  prompt.trim() && !isSynthesizing
                    ? "border border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20 active:scale-95"
                    : "border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                )}
              >
                {isSynthesizing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> SYNTHESIZING…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" /> GENERATE GRAPH
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowExamples(!showExamples)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all cursor-pointer"
              >
                EXAMPLES
              </button>
            </div>
            <span className="text-[8px] font-mono text-slate-400">
              ⌘+Enter to generate
            </span>
          </div>

          {/* Examples */}
          {showExamples && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-indigo-900/30">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => {
                    setPrompt(ex.prompt);
                    setShowExamples(false);
                    inputRef.current?.focus();
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800/40 transition-all cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 text-indigo-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-300">
                      {ex.label}
                    </div>
                    <div className="text-[9px] font-mono text-slate-500 truncate">
                      {ex.prompt}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2.5 border-t border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="text-[10px] font-mono text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}
      </div>

      {/* ──── Results ──── */}
      {result && (
        <div className="space-y-4">
          {/* Goal Summary */}
          <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                  Detected Goal
                </div>
                <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 leading-relaxed">
                  {result.analysis?.goal || prompt}
                </p>
                {result.warning && (
                  <p className="text-[9px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {result.warning}
                  </p>
                )}
              </div>
              {!installed && (
                <button
                  type="button"
                  onClick={handleInstallOnly}
                  disabled={installing}
                  className={clsx(
                    "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0",
                    "border border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-500/20 active:scale-95"
                  )}
                >
                  {installing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> INSTALLING…
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3" /> 1-CLICK INSTALL
                    </>
                  )}
                </button>
              )}
              {installed && (
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                  <Check className="h-3 w-3" /> INSTALLED
                </div>
              )}
            </div>
          </div>

          {/* Discovered Servers */}
          {result.servers && result.servers.length > 0 && (
            <div className="space-y-2">
              <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Server className="h-3 w-3" />
                DISCOVERED MCP SERVERS ({result.servers.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.servers.map((server, idx) => {
                  const isExpanded = expandedServers.has(idx);
                  const isMounted = result.mountedServerIds.includes(
                    server.directoryMatch?.id || ""
                  );
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 dark:border-indigo-900/30 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleServer(idx)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-black/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
                          )}
                          <Server className="h-3 w-3 text-violet-500 shrink-0" />
                          <span className="text-[11px] font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                            {server.name}
                          </span>
                          {server.directoryMatch && (
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 shrink-0">
                              FOUND
                            </span>
                          )}
                          {!server.directoryMatch && (
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 shrink-0">
                              MANUAL
                            </span>
                          )}
                          {isMounted && (
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-300 shrink-0">
                              MOUNTED
                            </span>
                          )}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 border-t border-slate-100 dark:border-indigo-950/30 space-y-2 mt-1">
                          <p className="text-[10px] font-mono text-slate-500">{server.purpose}</p>
                          {server.directoryMatch && (
                            <div className="space-y-1 text-[9px] font-mono text-slate-400">
                              <div>Source: {server.directoryMatch.source} · {server.directoryMatch.transport}</div>
                              <div>Stars: {server.directoryMatch.stars} · ID: {server.directoryMatch.id}</div>
                              {server.directoryMatch.description && (
                                <p className="text-slate-500">{server.directoryMatch.description}</p>
                              )}
                            </div>
                          )}
                          {!server.directoryMatch && (
                            <p className="text-[9px] font-mono text-amber-500">
                              No directory match found — will need manual configuration
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Workflow Steps */}
          {result.analysis?.steps && result.analysis.steps.length > 0 && (
            <div className="space-y-2">
              <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3" />
                WORKFLOW STEPS ({result.analysis.steps.length})
              </div>
              <div className="space-y-1.5">
                {result.analysis.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-black/30 border border-slate-100 dark:border-indigo-950/30"
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Graph Nodes */}
          {result.graph?.nodes && result.graph.nodes.length > 0 && (
            <div className="space-y-2">
              <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <GitBranch className="h-3 w-3" />
                GENERATED GRAPH ({result.graph.nodes.length} nodes, {result.graph.edges.length} edges)
              </div>
              <div className="space-y-1.5">
                {result.graph.nodes.map((node) => {
                  const isExpanded = expandedNodes.has(node.id);
                  const Icon = NODE_ICONS[node.type] || Bot;
                  const colorClass = NODE_COLORS[node.type] || "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300";

                  return (
                    <div
                      key={node.id}
                      className={clsx(
                        "rounded-lg border overflow-hidden transition-all",
                        colorClass
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleNode(node.id)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 opacity-50 shrink-0" />
                          )}
                          <Icon className="h-3 w-3 shrink-0" />
                          <span className="text-[10px] font-mono font-bold truncate">
                            {node.data.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-white/50 dark:bg-black/20 border border-current/20 uppercase shrink-0">
                            {node.type}
                          </span>
                        </div>
                        {node.type === "approval" && (
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700/50 shrink-0">
                            HITL
                          </span>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-current/10 space-y-2">
                          {node.data.prompt && (
                            <div>
                              <div className="text-[8px] font-mono font-bold opacity-60 uppercase mb-1">
                                System Prompt
                              </div>
                              <p className="text-[9px] font-mono opacity-80 leading-relaxed whitespace-pre-wrap">
                                {node.data.prompt}
                              </p>
                            </div>
                          )}
                          {node.data.mcpToolName && (
                            <div className="text-[9px] font-mono opacity-80">
                              <span className="font-bold">Tool:</span> {node.data.mcpToolServer}/{node.data.mcpToolName}
                            </div>
                          )}
                          {node.data.condition && (
                            <div className="text-[9px] font-mono opacity-80">
                              <span className="font-bold">Condition:</span> {node.data.condition}
                            </div>
                          )}
                          {node.data.routerPrompt && (
                            <div className="text-[9px] font-mono opacity-80">
                              <span className="font-bold">Router:</span> {node.data.routerPrompt}
                            </div>
                          )}
                          {node.data.approvalReason && (
                            <div className="text-[9px] font-mono opacity-80">
                              <span className="font-bold">Approval:</span> {node.data.approvalReason}
                            </div>
                          )}
                          {node.data.maxIterations && (
                            <div className="text-[9px] font-mono opacity-80">
                              <span className="font-bold">Max Iterations:</span> {node.data.maxIterations}
                            </div>
                          )}
                          {/* Edges from this node */}
                          {result.graph.edges
                            .filter((e) => e.source === node.id)
                            .map((edge) => (
                              <div
                                key={edge.id}
                                className="text-[8px] font-mono opacity-60 flex items-center gap-1"
                              >
                                <ArrowRight className="h-2.5 w-2.5" />
                                → {edge.target}
                                {edge.label && (
                                  <span className="px-1 py-0.5 rounded bg-white/30 dark:bg-black/20 text-[7px]">
                                    [{edge.label}]
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Skill Name */}
          {result.skillName && (
            <div className="rounded-lg border border-slate-200 dark:border-indigo-900/30 p-3 flex items-center gap-3">
              <FileCode2 className="h-4 w-4 text-indigo-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono font-bold text-slate-900 dark:text-slate-100">
                  {result.skillName}
                </div>
                <div className="text-[9px] font-mono text-slate-500 truncate">
                  {result.skillPurpose}
                </div>
              </div>
              {result.skillId && (
                <a
                  href={`/dashboard/skills/${result.skillId}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all"
                >
                  OPEN <ArrowRight className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
