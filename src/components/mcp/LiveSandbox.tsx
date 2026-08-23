"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Play,
  Square,
  Loader2,
  Bot,
  Wrench,
  GitBranch,
  Shield,
  Server,
  Clock,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Zap,
  AlertTriangle,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";

// ────────────── Types ──────────────

interface SandboxEvent {
  type: string;
  executionId: string;
  seq: number;
  at: number;
  nodeId?: string;
  nodeLabel?: string;
  nodeType?: string;
  status?: string;
  detail?: string;
  durationMs?: number;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  model?: string;
  prompt?: string;
  response?: string;
  decision?: string;
  iteration?: number;
  branch?: string;
}

interface LiveSandboxProps {
  skillName: string;
  skillDescription: string;
  steps: Array<{ order: number; action: string; description: string; requiredTool?: string }>;
  requiredServers: string[];
  isOpen: boolean;
  onClose: () => void;
}

type RunPhase = "idle" | "creating" | "running" | "completed" | "failed";

// ────────────── Node Status Helpers ──────────────

const NODE_STATUS_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  RUNNING: { icon: Loader2, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300", label: "RUNNING" },
  SUCCESS: { icon: Check, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300", label: "DONE" },
  FAILED: { icon: X, color: "text-red-600 bg-red-50 dark:bg-red-950/40 border-red-300", label: "FAILED" },
  AWAITING_APPROVAL: { icon: Shield, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 border-orange-300", label: "WAITING" },
  SKIPPED: { icon: ChevronRight, color: "text-slate-400 bg-slate-50 dark:bg-slate-950/40 border-slate-300", label: "SKIPPED" },
};

const NODE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  agent: Bot,
  supervisor: GitBranch,
  tool: Wrench,
  router: GitBranch,
  approval: Shield,
  mcp_tool: Wrench,
  mcp_server: Server,
  start: Zap,
  end: Zap,
};

// ────────────── Component ──────────────

export function LiveSandbox({
  skillName,
  skillDescription,
  steps,
  requiredServers,
  isOpen,
  onClose,
}: LiveSandboxProps) {
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [events, setEvents] = useState<SandboxEvent[]>([]);
  const [nodeStates, setNodeStates] = useState<Map<string, { status: string; label: string; type: string; durationMs?: number }>>(new Map());
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [inputData, setInputData] = useState("{}");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalDuration, setTotalDuration] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      // Cleanup sandbox skill
      if (skillId) {
        fetch(`/api/skills/sandbox?skillId=${skillId}`, { method: "DELETE" }).catch(() => {});
      }
    };
  }, [skillId]);

  // Auto-scroll events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const reset = useCallback(() => {
    eventSourceRef.current?.close();
    setPhase("idle");
    setEvents([]);
    setNodeStates(new Map());
    setExpandedEvents(new Set());
    setPreviewId(null);
    setSkillId(null);
    setError(null);
    setTotalDuration(null);
  }, []);

  const handleStart = useCallback(async () => {
    reset();
    setPhase("creating");
    startTimeRef.current = Date.now();

    try {
      // Parse input
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = JSON.parse(inputData);
      } catch {
        parsedInput = { query: inputData || "test input" };
      }

      // Create sandbox skill + preview
      const res = await fetch("/api/skills/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillName,
          skillDescription,
          steps,
          requiredServers,
          inputData: parsedInput,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Sandbox creation failed (${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || "Sandbox creation failed");
      }

      setPreviewId(data.data.previewId);
      setSkillId(data.data.skillId);
      setPhase("running");

      // Connect to SSE stream
      const es = new EventSource(`/api/canvas/preview/${data.data.previewId}/stream`);
      eventSourceRef.current = es;

      es.addEventListener("node:start", (e) => {
        const event = JSON.parse(e.data) as SandboxEvent;
        setEvents((prev) => [...prev, event]);
        if (event.nodeId) {
          setNodeStates((prev) => {
            const next = new Map(prev);
            next.set(event.nodeId!, {
              status: "RUNNING",
              label: event.nodeLabel || event.nodeId || "",
              type: event.nodeType || "agent",
            });
            return next;
          });
        }
      });

      es.addEventListener("node:end", (e) => {
        const event = JSON.parse(e.data) as SandboxEvent;
        setEvents((prev) => [...prev, event]);
        if (event.nodeId) {
          setNodeStates((prev) => {
            const next = new Map(prev);
            const existing = next.get(event.nodeId!);
            next.set(event.nodeId!, {
              status: event.status || "SUCCESS",
              label: existing?.label || event.nodeLabel || event.nodeId || "",
              type: existing?.type || event.nodeType || "agent",
              durationMs: event.durationMs,
            });
            return next;
          });
        }
      });

      es.addEventListener("tool:call", (e) => {
        const event = JSON.parse(e.data) as SandboxEvent;
        setEvents((prev) => [...prev, event]);
      });

      es.addEventListener("tool:result", (e) => {
        const event = JSON.parse(e.data) as SandboxEvent;
        setEvents((prev) => [...prev, event]);
      });

      es.addEventListener("llm:call", (e) => {
        const event = JSON.parse(e.data) as SandboxEvent;
        setEvents((prev) => [...prev, event]);
      });

      es.addEventListener("llm:result", (e) => {
        const event = JSON.parse(e.data) as SandboxEvent;
        setEvents((prev) => [...prev, event]);
      });

      es.addEventListener("mcp:tool:start", (e) => {
        const event = JSON.parse(e.data) as SandboxEvent;
        setEvents((prev) => [...prev, event]);
      });

      es.addEventListener("mcp:tool:end", (e) => {
        const event = JSON.parse(e.data) as SandboxEvent;
        setEvents((prev) => [...prev, event]);
      });

      es.addEventListener("router:decision", (e) => {
        const event = JSON.parse(e.data) as SandboxEvent;
        setEvents((prev) => [...prev, event]);
      });

      es.addEventListener("approval:requested", (e) => {
        const event = JSON.parse(e.data) as SandboxEvent;
        setEvents((prev) => [...prev, event]);
        // Auto-approve in sandbox mode
        if (event.nodeId) {
          fetch(`/api/canvas/preview/${data.data.previewId}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId: event.nodeId, approved: true }),
          }).catch(() => {});
        }
      });

      es.addEventListener("execution:status", (e) => {
        const event = JSON.parse(e.data) as SandboxEvent;
        setEvents((prev) => [...prev, event]);
        if (event.status === "COMPLETED") {
          setPhase("completed");
          setTotalDuration(Date.now() - startTimeRef.current);
          es.close();
        } else if (event.status === "FAILED" || event.status === "CANCELLED") {
          setPhase("failed");
          setTotalDuration(Date.now() - startTimeRef.current);
          setError(event.detail || "Execution failed");
          es.close();
        } else if (event.status === "PAUSED_FOR_APPROVAL") {
          // Auto-approve handled above
        }
      });

      es.onerror = () => {
        // SSE connection error — may be normal if execution finished quickly
        setTimeout(() => {
          if (phase === "running") {
            setPhase("failed");
            setError("Stream connection lost");
          }
        }, 2000);
      };
    } catch (err) {
      setPhase("failed");
      setError(err instanceof Error ? err.message : "Sandbox failed");
    }
  }, [skillName, skillDescription, steps, requiredServers, inputData, reset, phase]);

  const handleStop = useCallback(() => {
    eventSourceRef.current?.close();
    setPhase("failed");
    setError("Stopped by user");
    setTotalDuration(Date.now() - startTimeRef.current);
  }, []);

  const handleCleanup = useCallback(async () => {
    if (skillId) {
      try {
        await fetch(`/api/skills/sandbox?skillId=${skillId}`, { method: "DELETE" });
      } catch {}
    }
    reset();
  }, [skillId, reset]);

  const toggleEvent = (idx: number) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (!isOpen) return null;

  const nodeCount = nodeStates.size;
  const completedCount = Array.from(nodeStates.values()).filter(
    (n) => n.status === "SUCCESS" || n.status === "SKIPPED"
  ).length;
  const failedCount = Array.from(nodeStates.values()).filter((n) => n.status === "FAILED").length;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[85vh] mx-4 mb-4 rounded-t-xl border border-slate-200 dark:border-indigo-800/60 bg-white dark:bg-[#0a0a0a] shadow-2xl flex flex-col font-mono overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-indigo-500" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                SANDBOX: {skillName}
              </h2>
            </div>
            {phase === "running" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-300 animate-pulse">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> LIVE
              </span>
            )}
            {phase === "completed" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
                <Check className="h-2.5 w-2.5" /> COMPLETED
              </span>
            )}
            {phase === "failed" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-300">
                <AlertTriangle className="h-2.5 w-2.5" /> FAILED
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {totalDuration && (
              <span className="text-[9px] text-slate-500">
                <Clock className="inline h-3 w-3 mr-0.5" />
                {(totalDuration / 1000).toFixed(1)}s
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Node Pipeline */}
          <div className="w-1/3 border-r border-slate-200 dark:border-indigo-900/30 overflow-y-auto p-3 space-y-1.5">
            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              PIPELINE ({completedCount}/{nodeCount} done{failedCount > 0 ? `, ${failedCount} failed` : ""})
            </div>
            {/* Progress bar */}
            {nodeCount > 0 && (
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mb-2">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all duration-500",
                    failedCount > 0 ? "bg-red-500" : "bg-indigo-500"
                  )}
                  style={{ width: `${(completedCount / nodeCount) * 100}%` }}
                />
              </div>
            )}
            {Array.from(nodeStates.entries()).map(([nodeId, state]) => {
              const statusConfig = NODE_STATUS_CONFIG[state.status] || NODE_STATUS_CONFIG.RUNNING;
              const StatusIcon = statusConfig.icon;
              const NodeIcon = NODE_TYPE_ICONS[state.type] || Bot;
              const isRunning = state.status === "RUNNING";

              return (
                <div
                  key={nodeId}
                  className={clsx(
                    "flex items-center gap-2 px-2.5 py-2 rounded border transition-all",
                    statusConfig.color
                  )}
                >
                  <NodeIcon className="h-3 w-3 shrink-0" />
                  <span className="text-[9px] font-bold truncate flex-1">{state.label}</span>
                  {state.durationMs != null && (
                    <span className="text-[8px] opacity-70 shrink-0">{state.durationMs}ms</span>
                  )}
                  <StatusIcon className={clsx("h-3 w-3 shrink-0", isRunning && "animate-spin")} />
                </div>
              );
            })}
            {nodeCount === 0 && phase === "idle" && (
              <div className="text-center py-8 text-[10px] text-slate-400">
                Click START to begin the sandbox run
              </div>
            )}
            {nodeCount === 0 && phase === "creating" && (
              <div className="text-center py-8 text-[10px] text-indigo-500">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Creating sandbox...
              </div>
            )}
          </div>

          {/* Right: Event Stream */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Input Section */}
            {phase === "idle" && (
              <div className="p-3 border-b border-slate-100 dark:border-indigo-950/30 space-y-2">
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                  SAMPLE INPUT
                </div>
                <textarea
                  value={inputData}
                  onChange={(e) => setInputData(e.target.value)}
                  placeholder='{"query": "Check for high-priority GitHub issues"}'
                  rows={3}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/40 text-[10px] font-mono text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            )}

            {/* Event Stream */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                EVENT STREAM ({events.length} events)
              </div>
              {events.length === 0 && phase !== "idle" && (
                <div className="text-center py-6 text-[10px] text-slate-400">
                  Waiting for events...
                </div>
              )}
              {events.map((event, idx) => {
                const isExpanded = expandedEvents.has(idx);
                const isNodeEvent = event.type.startsWith("node:");
                const isToolEvent = event.type.startsWith("tool:") || event.type.startsWith("mcp:");
                const isLlmEvent = event.type.startsWith("llm:");
                const isExecEvent = event.type.startsWith("execution:");

                const timeSinceStart = event.at - startTimeRef.current;
                const timeStr = timeSinceStart > 0 ? `+${(timeSinceStart / 1000).toFixed(1)}s` : "0s";

                let iconColor = "text-slate-400";
                let bgColor = "bg-slate-50 dark:bg-black/20";
                if (isNodeEvent && event.type === "node:start") { iconColor = "text-indigo-500"; bgColor = "bg-indigo-50/50 dark:bg-indigo-950/20"; }
                if (isNodeEvent && event.type === "node:end") {
                  if (event.status === "SUCCESS") { iconColor = "text-emerald-500"; bgColor = "bg-emerald-50/50 dark:bg-emerald-950/20"; }
                  else if (event.status === "FAILED") { iconColor = "text-red-500"; bgColor = "bg-red-50/50 dark:bg-red-950/20"; }
                  else { iconColor = "text-amber-500"; bgColor = "bg-amber-50/50 dark:bg-amber-950/20"; }
                }
                if (isToolEvent) { iconColor = "text-cyan-500"; bgColor = "bg-cyan-50/50 dark:bg-cyan-950/20"; }
                if (isLlmEvent) { iconColor = "text-violet-500"; bgColor = "bg-violet-50/50 dark:bg-violet-950/20"; }
                if (isExecEvent) { iconColor = "text-amber-500"; bgColor = "bg-amber-50/50 dark:bg-amber-950/20"; }

                const hasDetails = event.input || event.output || event.prompt || event.response || event.detail || event.error;

                return (
                  <div
                    key={idx}
                    className={clsx("rounded border border-slate-100 dark:border-indigo-950/30 overflow-hidden transition-all", bgColor)}
                  >
                    <button
                      type="button"
                      onClick={() => hasDetails && toggleEvent(idx)}
                      className={clsx(
                        "w-full flex items-center gap-2 px-2.5 py-1.5 text-left",
                        hasDetails && "hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      )}
                    >
                      <span className={clsx("text-[8px] font-mono w-12 shrink-0", iconColor)}>
                        {timeStr}
                      </span>
                      <span className={clsx("text-[9px] font-mono font-bold shrink-0", iconColor)}>
                        {event.type}
                      </span>
                      {event.nodeLabel && (
                        <span className="text-[9px] font-mono text-slate-600 dark:text-slate-400 truncate">
                          {event.nodeLabel}
                        </span>
                      )}
                      {event.toolName && (
                        <span className="text-[9px] font-mono text-cyan-600 dark:text-cyan-400 truncate">
                          {event.toolName}
                        </span>
                      )}
                      {event.status && (
                        <span className={clsx(
                          "px-1 py-0.5 rounded text-[7px] font-bold border shrink-0",
                          event.status === "SUCCESS" ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                          event.status === "FAILED" ? "bg-red-100 text-red-700 border-red-300" :
                          "bg-slate-100 text-slate-500 border-slate-300"
                        )}>
                          {event.status}
                        </span>
                      )}
                      {event.durationMs != null && (
                        <span className="text-[8px] font-mono text-slate-400 shrink-0 ml-auto">
                          {event.durationMs}ms
                        </span>
                      )}
                      {hasDetails && (
                        <span className="text-slate-400 shrink-0">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </span>
                      )}
                    </button>

                    {isExpanded && hasDetails && (
                      <div className="px-3 pb-2.5 pt-0 border-t border-slate-100 dark:border-indigo-950/20 space-y-2 mt-1">
                        {event.prompt && (
                          <div>
                            <div className="text-[7px] font-bold text-violet-600 dark:text-violet-400 uppercase mb-0.5">Prompt</div>
                            <p className="text-[9px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                              {String(event.prompt)}
                            </p>
                          </div>
                        )}
                        {event.response && (
                          <div>
                            <div className="text-[7px] font-bold text-violet-600 dark:text-violet-400 uppercase mb-0.5">Response</div>
                            <p className="text-[9px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                              {String(event.response)}
                            </p>
                          </div>
                        )}
                        {event.input != null && (
                          <div>
                            <div className="text-[7px] font-bold text-cyan-600 dark:text-cyan-400 uppercase mb-0.5">Input</div>
                            <pre className="text-[9px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap max-h-24 overflow-y-auto bg-black/5 dark:bg-white/5 rounded p-2">
                              {typeof event.input === "string" ? event.input : JSON.stringify(event.input, null, 2)}
                            </pre>
                          </div>
                        )}
                        {event.output != null && (
                          <div>
                            <div className="text-[7px] font-bold text-cyan-600 dark:text-cyan-400 uppercase mb-0.5">Output</div>
                            <pre className="text-[9px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap max-h-24 overflow-y-auto bg-black/5 dark:bg-white/5 rounded p-2">
                              {typeof event.output === "string" ? event.output : JSON.stringify(event.output, null, 2)}
                            </pre>
                          </div>
                        )}
                        {event.detail && (
                          <div>
                            <div className="text-[7px] font-bold text-slate-500 uppercase mb-0.5">Detail</div>
                            <p className="text-[9px] text-slate-500">{event.detail}</p>
                          </div>
                        )}
                        {event.error && (
                          <div className="bg-red-50 dark:bg-red-950/30 rounded p-2">
                            <div className="text-[7px] font-bold text-red-600 uppercase mb-0.5">Error</div>
                            <p className="text-[9px] text-red-600 dark:text-red-400">{event.error}</p>
                          </div>
                        )}
                        {event.decision && (
                          <div>
                            <div className="text-[7px] font-bold text-amber-600 uppercase mb-0.5">Decision</div>
                            <p className="text-[9px] text-amber-600 dark:text-amber-400">{event.decision}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={eventsEndRef} />
            </div>

            {/* Error Banner */}
            {error && (
              <div className="px-4 py-2 border-t border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span className="text-[10px] font-mono text-red-700 dark:text-red-300 flex-1">{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/40 shrink-0">
          <div className="text-[9px] font-mono text-slate-500">
            {steps.length} steps · {requiredServers.length} servers · {events.length} events
          </div>
          <div className="flex items-center gap-2">
            {phase === "idle" && (
              <button
                type="button"
                onClick={handleStart}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Play className="h-3 w-3" /> START SANDBOX
              </button>
            )}
            {phase === "running" && (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-red-600 text-white hover:bg-red-500 shadow-md shadow-red-500/20 transition-all cursor-pointer"
              >
                <Square className="h-3 w-3" /> STOP
              </button>
            )}
            {(phase === "completed" || phase === "failed") && (
              <>
                <button
                  type="button"
                  onClick={handleCleanup}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-400 transition-all cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" /> CLEANUP
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" /> RE-RUN
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-500 hover:border-slate-400 transition-all cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
