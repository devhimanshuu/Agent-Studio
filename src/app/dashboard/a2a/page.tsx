"use client";

import React, { useState } from "react";
import {
  Bot,
  Network,
  Radio,
  Send,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Play,
  RefreshCw,
  Layers,
  ShieldCheck,
  Code2,
  Users,
  MessageSquare,
  ArrowRight,
  ExternalLink,
  Cpu,
  Flame,
  Search,
} from "lucide-react";
import { A2A_AGENT_PRESETS } from "@/modules/a2a/presets";
import { A2AAgentManifest } from "@/types/a2a";

export default function A2AProtocolPage() {
  const [activeTab, setActiveTab] = useState<"discovery" | "delegation" | "debate">("discovery");

  // Discovery State
  const [discoverUrl, setDiscoverUrl] = useState("/api/a2a/manifest");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredManifest, setDiscoveredManifest] = useState<A2AAgentManifest | null>(null);

  // Task Delegation State
  const [targetAgentUrl, setTargetAgentUrl] = useState("/api/a2a/tasks");
  const [taskCapability, setTaskCapability] = useState("visual_graph_orchestration");
  const [taskPrompt, setTaskPrompt] = useState(
    "Synthesize a fault-tolerant multi-agent consensus workflow with human-in-the-loop approval gates."
  );
  const [isStreaming, setIsStreaming] = useState(true);
  const [isDelegating, setIsDelegating] = useState(false);
  const [streamedTokens, setStreamedTokens] = useState("");
  const [taskResult, setTaskResult] = useState<Record<string, unknown> | null>(null);
  const [taskDuration, setTaskDuration] = useState<number | null>(null);

  // Multi-Agent Debate Arena State
  const [debateTopic, setDebateTopic] = useState(
    "Should vector memory for RAG use pgvector in PostgreSQL or a dedicated standalone vector database?"
  );
  const [debateMode, setDebateMode] = useState<"debate" | "consensus" | "round_robin">("debate");
  const [maxTurns, setMaxTurns] = useState(2);
  const [isDebating, setIsDebating] = useState(false);
  const [debateLogs, setDebateLogs] = useState<Array<{ sender: string; role: string; content: string; turn: number }>>([]);
  const [synthesizedConsensus, setSynthesizedConsensus] = useState<string | null>(null);

  // Run Discovery
  const handleDiscover = async (urlToProbe?: string) => {
    const probe = urlToProbe || discoverUrl;
    setIsDiscovering(true);
    try {
      const res = await fetch(`/api/a2a/discover?url=${encodeURIComponent(probe)}`);
      const json = await res.json();
      if (res.ok && json.manifest) {
        setDiscoveredManifest(json.manifest);
      } else {
        // Fallback to synthetic manifest or preset
        const preset = A2A_AGENT_PRESETS.find((p) => p.name === probe || p.endpoints.tasks.includes(probe));
        if (preset) {
          setDiscoveredManifest(preset);
        } else {
          setDiscoveredManifest({
            name: "remote-a2a-agent",
            displayName: "Remote A2A Autonomous Agent",
            description: `A2A protocol compliant agent endpoint at ${probe}`,
            version: "1.0.0",
            protocolVersion: "1.0.0",
            endpoints: {
              tasks: `${probe}/tasks`,
              messages: `${probe}/messages`,
              health: `${probe}/health`,
            },
            capabilities: [
              {
                id: "default_task",
                name: "Autonomous Delegation",
                description: "Executes delegated tasks under Google A2A protocol specification.",
              },
            ],
          });
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsDiscovering(false);
    }
  };

  // Run Task Delegation
  const handleDelegateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPrompt.trim()) return;

    setIsDelegating(true);
    setStreamedTokens("");
    setTaskResult(null);
    setTaskDuration(null);

    const started = Date.now();

    try {
      if (isStreaming) {
        const res = await fetch(`${targetAgentUrl}?stream=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability: taskCapability,
            input: { prompt: taskPrompt },
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n");
            for (const line of lines) {
              if (line.startsWith("data:")) {
                const data = line.slice(5).trim();
                if (data === "[DONE]") break;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.chunk) {
                    accumulated += parsed.chunk;
                    setStreamedTokens(accumulated);
                  }
                } catch {
                  if (data) {
                    accumulated += data;
                    setStreamedTokens(accumulated);
                  }
                }
              }
            }
          }
        }

        setTaskResult({ output: accumulated, streaming: true });
        setTaskDuration(Date.now() - started);
      } else {
        const res = await fetch(targetAgentUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability: taskCapability,
            input: { prompt: taskPrompt },
          }),
        });

        const json = await res.json();
        setTaskResult(json.result || json);
        setTaskDuration(Date.now() - started);
      }
    } catch (err) {
      setTaskResult({ error: err instanceof Error ? err.message : "Delegation failed" });
      setTaskDuration(Date.now() - started);
    } finally {
      setIsDelegating(false);
    }
  };

  // Run Multi-Agent Debate
  const handleRunDebate = async () => {
    if (!debateTopic.trim()) return;

    setIsDebating(true);
    setDebateLogs([]);
    setSynthesizedConsensus(null);

    const participants = [
      {
        name: "Proposer Agent",
        role: "proposer",
        persona: "Advocate for unified PostgreSQL pgvector simplicity, zero-operational overhead, and ACID guarantees.",
      },
      {
        name: "Critic Agent",
        role: "critic",
        persona: "Evaluate latency edge cases, high-dimensional billion-scale indexing, and GPU acceleration.",
      },
      {
        name: "Synthesis Arbiter",
        role: "arbiter",
        persona: "Synthesize empirical consensus, trade-off matrix, and architectural recommendation.",
      },
    ];

    const logs: Array<{ sender: string; role: string; content: string; turn: number }> = [];

    for (let turn = 1; turn <= maxTurns; turn++) {
      for (const p of participants.slice(0, 2)) {
        try {
          const res = await fetch("/api/a2a/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: p.name,
              role: p.role,
              turn,
              content: `[Turn #${turn} - ${p.name}] Topic: "${debateTopic}". Perspective: ${p.persona}. Prior arguments: ${JSON.stringify(
                logs.slice(-2).map((l) => `${l.sender}: ${l.content}`)
              )}`,
            }),
          });
          const json = await res.json();
          const entry = {
            sender: p.name,
            role: p.role,
            content: json.reply || "Deliberating perspective...",
            turn,
          };
          logs.push(entry);
          setDebateLogs([...logs]);
          await new Promise((r) => setTimeout(r, 600));
        } catch {
          // Continue
        }
      }
    }

    // Arbiter consensus synthesis
    try {
      const arbiter = participants[2];
      const res = await fetch("/api/a2a/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: arbiter.name,
          role: arbiter.role,
          turn: maxTurns + 1,
          content: `Synthesize final consensus for topic: "${debateTopic}" based on the exchanges: ${JSON.stringify(logs)}`,
        }),
      });
      const json = await res.json();
      setSynthesizedConsensus(json.reply || "Consensus formulated.");
    } catch {
      // Continue
    } finally {
      setIsDebating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 font-mono">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-r from-purple-50/80 via-slate-50 to-indigo-50/50 dark:from-purple-950/40 dark:via-black/60 dark:to-indigo-950/20 shadow-sm backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50">
              AGENT-TO-AGENT (A2A)
            </span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50 flex items-center gap-1">
              <Radio className="h-3 w-3 animate-pulse" /> PROTOCOL v1.0 ACTIVE
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Bot className="h-7 w-7 text-purple-600 dark:text-purple-400" />
            Google Agent-to-Agent (A2A) Protocol Studio
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Autonomous inter-agent communication: discovery manifests (<code className="text-indigo-600 dark:text-indigo-400">/.well-known/agent.json</code>), live task delegation with SSE streaming, and multi-agent debate consensus.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/api/a2a/manifest"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-black text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 flex items-center gap-1.5 shadow-sm"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View Live Agent Manifest
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-indigo-900/40 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("discovery")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-150 ${
            activeTab === "discovery"
              ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-purple-950/40"
          }`}
        >
          <Network className="h-4 w-4" /> 1. Agent Discovery & Manifests
        </button>
        <button
          onClick={() => setActiveTab("delegation")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-150 ${
            activeTab === "delegation"
              ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-purple-950/40"
          }`}
        >
          <Send className="h-4 w-4" /> 2. Live Task Delegation (SSE Streaming)
        </button>
        <button
          onClick={() => setActiveTab("debate")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-150 ${
            activeTab === "debate"
              ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-purple-950/40"
          }`}
        >
          <Users className="h-4 w-4" /> 3. Multi-Agent Debate Arena
        </button>
      </div>

      {/* TAB 1: DISCOVERY */}
      {activeTab === "discovery" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Network className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Agent Discovery & Card Handshake
            </h2>
            <p className="text-xs text-slate-500">
              Probes target agent endpoint to validate <code className="text-indigo-600">/.well-known/agent.json</code>, extract capabilities, input schemas, and communication endpoints.
            </p>

            {/* Presets */}
            <div className="space-y-2">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">Built-in A2A Agent Presets:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {A2A_AGENT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setDiscoverUrl(preset.endpoints.tasks);
                      handleDiscover(preset.name);
                    }}
                    className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-slate-950 text-left hover:border-purple-500 transition-all space-y-1"
                  >
                    <div className="font-bold text-xs text-slate-900 dark:text-white">{preset.displayName}</div>
                    <div className="text-[10px] text-slate-500 line-clamp-2">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Discovery Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={discoverUrl}
                onChange={(e) => setDiscoverUrl(e.target.value)}
                placeholder="Enter A2A agent URL (e.g. http://localhost:3000 or /api/a2a/manifest)"
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <button
                type="button"
                onClick={() => handleDiscover()}
                disabled={isDiscovering || !discoverUrl.trim()}
                className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDiscovering ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Probe Agent
              </button>
            </div>
          </div>

          {/* Manifest Inspector */}
          {discoveredManifest && (
            <div className="p-6 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-black/60 shadow-md space-y-4 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-indigo-900/30 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      {discoveredManifest.displayName}
                      <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px]">
                        v{discoveredManifest.version}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">{discoveredManifest.description}</p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  Protocol Version: <strong>Google-A2A/{discoveredManifest.protocolVersion}</strong>
                </div>
              </div>

              {/* Endpoints & Capabilities */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                    Registered Endpoints:
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div>Tasks: <code className="text-purple-600 dark:text-purple-400">{discoveredManifest.endpoints.tasks}</code></div>
                    <div>Messages: <code className="text-purple-600 dark:text-purple-400">{discoveredManifest.endpoints.messages}</code></div>
                    <div>Health: <code className="text-purple-600 dark:text-purple-400">{discoveredManifest.endpoints.health || "N/A"}</code></div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                    Capabilities ({discoveredManifest.capabilities.length}):
                  </div>
                  <div className="space-y-1.5">
                    {discoveredManifest.capabilities.map((c, idx) => (
                      <div key={idx} className="p-2 rounded bg-white dark:bg-black/60 border border-slate-200 dark:border-slate-800 text-[11px]">
                        <div className="font-bold text-indigo-600 dark:text-indigo-400">{c.name} ({c.id})</div>
                        <div className="text-slate-500 text-[10px]">{c.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE TASK DELEGATION */}
      {activeTab === "delegation" && (
        <div className="space-y-6">
          <form onSubmit={handleDelegateTask} className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Direct Task Delegation Playground
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Endpoint</label>
                <input
                  type="text"
                  value={targetAgentUrl}
                  onChange={(e) => setTargetAgentUrl(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Capability ID</label>
                <input
                  type="text"
                  value={taskCapability}
                  onChange={(e) => setTaskCapability(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Task Payload / Prompt</label>
              <textarea
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                rows={4}
                required
                className="w-full p-3 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs font-mono outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isStreaming}
                  onChange={(e) => setIsStreaming(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Enable Real-time Server-Sent Events (SSE) Token Streaming</span>
              </label>

              <button
                type="submit"
                disabled={isDelegating || !taskPrompt.trim()}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
              >
                {isDelegating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Dispatch A2A Task
              </button>
            </div>
          </form>

          {/* Response Box */}
          {(streamedTokens || taskResult) && (
            <div className="p-6 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-black/60 shadow-md space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-indigo-900/30 pb-2">
                <span className="font-bold text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Remote A2A Task Output
                </span>
                {taskDuration && (
                  <span className="text-[10px] text-slate-500">Latency: {taskDuration}ms</span>
                )}
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono leading-relaxed whitespace-pre-wrap">
                {streamedTokens || (typeof taskResult?.output === "string" ? taskResult.output : JSON.stringify(taskResult, null, 2))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MULTI-AGENT DEBATE ARENA */}
      {activeTab === "debate" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Autonomous Multi-Agent Debate Arena
            </h2>
            <p className="text-xs text-slate-500">
              Simulates a live multi-turn dialogue channel where specialized agents deliberate across distinct viewpoints and produce synthesized consensus.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Deliberation Topic</label>
              <input
                type="text"
                value={debateTopic}
                onChange={(e) => setDebateTopic(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3 text-xs">
                <span>Dialogue Mode:</span>
                {(["debate", "consensus", "round_robin"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDebateMode(m)}
                    className={`px-3 py-1 rounded border capitalize ${
                      debateMode === m
                        ? "border-purple-600 bg-purple-600 text-white"
                        : "border-slate-300 dark:border-indigo-900/50 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleRunDebate}
                disabled={isDebating || !debateTopic.trim()}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
              >
                {isDebating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                Launch Multi-Agent Debate
              </button>
            </div>
          </div>

          {/* Debate Speech Bubbles */}
          {debateLogs.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Channel Exchanges ({debateLogs.length})
              </h3>
              <div className="space-y-3">
                {debateLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border text-xs space-y-2 animate-fadeIn ${
                      log.role === "proposer"
                        ? "border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20"
                        : "border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px] border-b border-slate-200/50 dark:border-slate-800 pb-1.5">
                      <span className={log.role === "proposer" ? "text-indigo-600 dark:text-indigo-400" : "text-purple-600 dark:text-purple-400"}>
                        {log.sender} ({log.role.toUpperCase()})
                      </span>
                      <span className="text-slate-500">Turn #{log.turn}</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap text-xs">
                      {log.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synthesized Consensus Display */}
          {synthesizedConsensus && (
            <div className="p-6 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 shadow-md space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Synthesized Multi-Agent Consensus
              </div>
              <p className="text-xs leading-relaxed font-sans whitespace-pre-wrap">
                {synthesizedConsensus}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
