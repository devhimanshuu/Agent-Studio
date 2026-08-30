"use client";

import React, { useState, useEffect } from "react";
import {
  Network,
  Radio,
  Send,
  Sparkles,
  Bot,
  MessageSquare,
  Users,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Copy,
  Check,
  Zap,
  Terminal,
  Activity,
  Layers,
  Search,
  ExternalLink,
  Cpu,
  Flame,
  Gavel,
  Pause,
  Play,
  HandMetal,
  ShieldCheck,
} from "lucide-react";
import { A2A_AGENT_PRESETS } from "@/modules/a2a/presets";
import { A2AAgentManifest } from "@/types/a2a";

export default function A2APage() {
  const [activeTab, setActiveTab] = useState<"discovery" | "tasks" | "auction" | "debate">("discovery");

  // Manifest Discovery State
  const [discoveredAgents, setDiscoveredAgents] = useState<A2AAgentManifest[]>(A2A_AGENT_PRESETS);
  const [selectedAgent, setSelectedAgent] = useState<A2AAgentManifest>(A2A_AGENT_PRESETS[0]);
  const [customAgentUrl, setCustomAgentUrl] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Task Delegation State
  const [targetAgentUrl, setTargetAgentUrl] = useState("/api/a2a/tasks");
  const [taskCapability, setTaskCapability] = useState("autonomous_delegation");
  const [taskPrompt, setTaskPrompt] = useState(
    "Synthesize an executive architecture review for deploying PostgreSQL pgvector vs standalone Qdrant vector database."
  );
  const [isDelegating, setIsDelegating] = useState(false);
  const [taskTokens, setTaskTokens] = useState<string[]>([]);
  const [taskResponse, setTaskResponse] = useState<Record<string, unknown> | null>(null);

  // Task Auction & Bidding State
  const [auctionTitle, setAuctionTitle] = useState("Enterprise Security & Compliance Audit");
  const [auctionDescription, setAuctionDescription] = useState(
    "Perform a deep static code analysis and token revocation audit across all API endpoints."
  );
  const [auctionCapability, setAuctionCapability] = useState("security_audit");
  const [isAuctionRunning, setIsAuctionRunning] = useState(false);
  const [auctionResult, setAuctionResult] = useState<Record<string, unknown> | null>(null);

  // Multi-Agent Debate Arena State (with Human-in-the-Loop)
  const [debateTopic, setDebateTopic] = useState(
    "Should our platform standardize on PostgreSQL pgvector for vector search or use a dedicated vector database like Qdrant?"
  );
  const [debateRounds, setDebateRounds] = useState(3);
  const [isDebating, setIsDebating] = useState(false);
  const [debateMessages, setDebateMessages] = useState<
    Array<{ sender: string; role: string; content: string; turn: number; isHuman?: boolean }>
  >([]);
  const [debateConsensus, setDebateConsensus] = useState<string | null>(null);
  const [isDebatePaused, setIsDebatePaused] = useState(false);
  const [humanInterventionText, setHumanInterventionText] = useState("");

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Discover Remote Agent
  const handleDiscoverAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAgentUrl.trim()) return;

    setIsDiscovering(true);
    try {
      const res = await fetch(`/api/a2a/discover?url=${encodeURIComponent(customAgentUrl)}`);
      const json = await res.json();
      if (res.ok && json.manifest) {
        setDiscoveredAgents((prev) => [json.manifest, ...prev.filter((a) => a.name !== json.manifest.name)]);
        setSelectedAgent(json.manifest);
      } else {
        alert(json.error || "Failed to discover agent manifest");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsDiscovering(false);
    }
  };

  // Delegate Task with SSE Token Streaming
  const handleDelegateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPrompt.trim()) return;

    setIsDelegating(true);
    setTaskTokens([]);
    setTaskResponse(null);

    try {
      const res = await fetch(targetAgentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: `task_${Date.now()}`,
          capability: taskCapability,
          input: { prompt: taskPrompt },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setTaskResponse(json);
      } else {
        const json = await res.json();
        alert(json.error || "Task delegation failed");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error connecting to agent");
    } finally {
      setIsDelegating(false);
    }
  };

  // Run Task Auction & Bidding
  const handleRunAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auctionTitle.trim() || !auctionDescription.trim()) return;

    setIsAuctionRunning(true);
    setAuctionResult(null);

    try {
      const res = await fetch("/api/a2a/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: auctionTitle,
          description: auctionDescription,
          requiredCapability: auctionCapability,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setAuctionResult(json.auction);
      } else {
        const json = await res.json();
        alert(json.error || "Auction failed");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsAuctionRunning(false);
    }
  };

  // Run Multi-Agent Debate Arena
  const handleStartDebate = async () => {
    if (!debateTopic.trim()) return;

    setIsDebating(true);
    setDebateMessages([]);
    setDebateConsensus(null);
    setIsDebatePaused(false);

    const agents = [
      { name: "Proposer Agent", role: "proposer", stance: "unified pgvector simplicity and transactional consistency" },
      { name: "Critic Agent", role: "critic", stance: "dedicated Qdrant high-throughput scalability and advanced filtering" },
      { name: "Security Auditor", role: "auditor", stance: "compliance, isolated access control, and credential management" },
    ];

    const messages: Array<{ sender: string; role: string; content: string; turn: number; isHuman?: boolean }> = [];

    for (let turn = 1; turn <= debateRounds; turn++) {
      const agent = agents[(turn - 1) % agents.length];

      try {
        const res = await fetch("/api/a2a/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: agent.name,
            role: agent.role,
            turn,
            content: `Round ${turn} Stance: In regards to "${debateTopic}", we advocate for ${agent.stance}.`,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          messages.push({
            sender: agent.name,
            role: agent.role,
            content: json.reply,
            turn,
          });
          setDebateMessages([...messages]);
        }
      } catch {
        // Continue
      }

      await new Promise((r) => setTimeout(r, 600));
    }

    // Synthesize the consensus from the actual transcript via a real LLM call —
    // previously this was a hardcoded string returned regardless of what was said.
    try {
      const transcript = messages.map((m) => `${m.sender} (${m.role}): ${m.content}`).join("\n");
      const res = await fetch("/api/a2a/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: "Consensus Synthesizer",
          role: "moderator",
          turn: debateRounds + 1,
          content: `Debate topic: "${debateTopic}"\n\nFull transcript:\n${transcript || "(no agent responses were recorded)"}\n\nSynthesize one concrete consensus recommendation that reconciles the strongest points raised by each participant above. Respond with only the consensus paragraph, no preamble.`,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setDebateConsensus(json.reply);
      } else {
        setDebateConsensus("Consensus synthesis failed (LLM call errored) — review the transcript above manually.");
      }
    } catch (err) {
      setDebateConsensus(
        `Consensus synthesis failed (${err instanceof Error ? err.message : "network error"}) — review the transcript above manually.`
      );
    }
    setIsDebating(false);
  };

  // Inject Human Argument in Debate
  const handleInjectHumanArgument = () => {
    if (!humanInterventionText.trim()) return;

    const newMsg = {
      sender: "Human Moderator (HITL)",
      role: "mediator",
      content: humanInterventionText.trim(),
      turn: debateMessages.length + 1,
      isHuman: true,
    };

    setDebateMessages((prev) => [...prev, newMsg]);
    setHumanInterventionText("");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 font-mono">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/80 via-slate-50 to-indigo-50/50 dark:from-indigo-950/40 dark:via-black/60 dark:to-indigo-950/20 shadow-sm backdrop-blur-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50">
              GOOGLE A2A PROTOCOL 1.0.0
            </span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> AGENT DISCOVERY & MANIFESTS
            </span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
              <Gavel className="h-3 w-3" /> TASK AUCTION & HITL DEBATE
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Network className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Agent-to-Agent (A2A) Protocol Suite
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Autonomous multi-agent discovery (<code className="text-indigo-600 font-mono">/.well-known/agent.json</code>), task delegation with streaming tokens, decentralized task auctions, and live Human-in-the-Loop deliberation.
          </p>
        </div>

        {/* Global Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-black/60 shadow-sm text-center min-w-[100px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Known Agents</div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {discoveredAgents.length}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-indigo-900/40 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("discovery")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all shrink-0 ${
            activeTab === "discovery"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40"
          }`}
        >
          <Bot className="h-4 w-4" /> 1. Discovery & Manifests
        </button>
        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all shrink-0 ${
            activeTab === "tasks"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40"
          }`}
        >
          <Radio className="h-4 w-4" /> 2. Live Task Delegation
        </button>
        <button
          onClick={() => setActiveTab("auction")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all shrink-0 ${
            activeTab === "auction"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40"
          }`}
        >
          <Gavel className="h-4 w-4" /> 3. Task Auction & Bidding
        </button>
        <button
          onClick={() => setActiveTab("debate")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all shrink-0 ${
            activeTab === "debate"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40"
          }`}
        >
          <Users className="h-4 w-4" /> 4. Multi-Agent Debate Arena (HITL)
        </button>
      </div>

      {/* TAB 1: DISCOVERY & MANIFESTS */}
      {activeTab === "discovery" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Search className="h-4 w-4 text-indigo-600" />
                Discover Remote A2A Agent
              </h2>

              <form onSubmit={handleDiscoverAgent} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Agent Root Endpoint or URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customAgentUrl}
                      onChange={(e) => setCustomAgentUrl(e.target.value)}
                      placeholder="e.g. http://localhost:3000 or https://remote-agent.corp"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    />
                    <button
                      type="submit"
                      disabled={isDiscovering || !customAgentUrl.trim()}
                      className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isDiscovering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      Probe
                    </button>
                  </div>
                </div>
              </form>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-indigo-900/30">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Known A2A Agents ({discoveredAgents.length})
                </div>
                <div className="space-y-2">
                  {discoveredAgents.map((agent) => (
                    <div
                      key={agent.name}
                      onClick={() => setSelectedAgent(agent)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedAgent.name === agent.name
                          ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-sm"
                          : "border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-slate-950 hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Bot className="h-4 w-4 text-indigo-600" />
                          {agent.displayName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          v{agent.protocolVersion}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{agent.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Manifest Inspector */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-indigo-900/30 pb-3">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Bot className="h-5 w-5 text-indigo-600" />
                    {selectedAgent.displayName}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    Identity: {selectedAgent.name} (v{selectedAgent.version})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(JSON.stringify(selectedAgent, null, 2), "manifest")}
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-indigo-900/50 hover:bg-slate-100 text-xs flex items-center gap-1"
                >
                  {copiedKey === "manifest" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy JSON
                </button>
              </div>

              {/* Endpoints */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Protocol Endpoints</div>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 flex items-center justify-between">
                    <span className="text-slate-500">Tasks:</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">
                      {selectedAgent.endpoints.tasks}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 flex items-center justify-between">
                    <span className="text-slate-500">Messages:</span>
                    <span className="font-mono text-purple-600 dark:text-purple-400">
                      {selectedAgent.endpoints.messages}
                    </span>
                  </div>
                </div>
              </div>

              {/* Capabilities */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Registered Capabilities ({selectedAgent.capabilities.length})
                </div>
                <div className="space-y-2">
                  {selectedAgent.capabilities.map((cap) => (
                    <div
                      key={cap.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50/50 dark:bg-slate-950/50 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                        <span>{cap.name}</span>
                        <span className="font-mono text-[10px] text-indigo-600">{cap.id}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{cap.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE TASK DELEGATION */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Radio className="h-5 w-5 text-indigo-600" />
              Live A2A Task Delegation
            </h2>

            <form onSubmit={handleDelegateTask} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target A2A Task Endpoint
                  </label>
                  <input
                    type="text"
                    value={targetAgentUrl}
                    onChange={(e) => setTargetAgentUrl(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Required Capability ID
                  </label>
                  <input
                    type="text"
                    value={taskCapability}
                    onChange={(e) => setTaskCapability(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Task Execution Prompt & Instructions
                </label>
                <textarea
                  value={taskPrompt}
                  onChange={(e) => setTaskPrompt(e.target.value)}
                  rows={4}
                  required
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 font-sans text-xs focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isDelegating || !taskPrompt.trim()}
                className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDelegating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Delegating Task & Streaming A2A Tokens...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Delegate Task via Google A2A Protocol
                  </>
                )}
              </button>
            </form>
          </div>

          {taskResponse && (
            <div className="p-6 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-black/60 shadow-md space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-bold text-xs text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Task Completed Successfully (ID: {taskResponse.taskId as string})
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                  Status: {taskResponse.status as string}
                </span>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 font-sans text-xs leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                {((taskResponse.result as Record<string, unknown>)?.output as string) ||
                  JSON.stringify(taskResponse.result, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TASK AUCTION & BIDDING */}
      {activeTab === "auction" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Gavel className="h-5 w-5 text-indigo-600" />
              Autonomous Multi-Agent Task Bidding & Auction Protocol
            </h2>
            <p className="text-xs text-slate-500">
              Broadcast task specifications to candidate A2A agents. Agents bid with confidence scores, latency estimates, and token budgets. The winning agent executes the task.
            </p>

            <form onSubmit={handleRunAuction} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={auctionTitle}
                    onChange={(e) => setAuctionTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Capability Domain
                  </label>
                  <input
                    type="text"
                    value={auctionCapability}
                    onChange={(e) => setAuctionCapability(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Task Specification & Requirements
                </label>
                <textarea
                  value={auctionDescription}
                  onChange={(e) => setAuctionDescription(e.target.value)}
                  rows={3}
                  required
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isAuctionRunning || !auctionTitle.trim()}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isAuctionRunning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Soliciting Bids & Running Auction...
                  </>
                ) : (
                  <>
                    <Gavel className="h-4 w-4" />
                    Broadcast Task RFP & Run Multi-Agent Auction
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Auction Results Display */}
          {auctionResult && (
            <div className="p-6 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-black/60 shadow-md space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-900/30 pb-3">
                <div className="flex items-center gap-2 font-bold text-sm text-purple-900 dark:text-purple-200">
                  <Gavel className="h-4 w-4 text-purple-600" />
                  Auction Awarded to:{" "}
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {(auctionResult.winningBid as Record<string, unknown>)?.agentName as string}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  Duration: {auctionResult.auctionDurationMs as number}ms
                </span>
              </div>

              {/* Bids Breakdown Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Submitted Agent Bids ({((auctionResult.allBids as Array<Record<string, unknown>>) || []).length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {((auctionResult.allBids as Array<Record<string, unknown>>) || []).map((bid, idx) => {
                    const isWinner =
                      bid.agentName ===
                      (auctionResult.winningBid as Record<string, unknown>)?.agentName;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border space-y-1.5 ${
                          isWinner
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                        }`}
                      >
                        <div className="flex justify-between font-bold">
                          <span>{bid.agentName as string}</span>
                          {isWinner && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] uppercase font-bold">
                              WINNER
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 space-y-0.5">
                          <div>Confidence: <strong className="text-indigo-600">{Math.round(((bid.confidenceScore as number) || 0) * 100)}%</strong></div>
                          <div>Est. Tokens: {bid.estimatedTokens as number}</div>
                          <div>Est. Latency: {bid.estimatedDurationMs as number}ms</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MULTI-AGENT DEBATE ARENA (HITL) */}
      {activeTab === "debate" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Multi-Agent Debate Arena with Human-in-the-Loop (HITL)
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Debate Topic or Architectural Question
                </label>
                <input
                  type="text"
                  value={debateTopic}
                  onChange={(e) => setDebateTopic(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Rounds:</span>
                  <select
                    value={debateRounds}
                    onChange={(e) => setDebateRounds(parseInt(e.target.value, 10))}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-50 dark:bg-slate-950 text-xs"
                  >
                    <option value={2}>2 Turns</option>
                    <option value={3}>3 Turns</option>
                    <option value={5}>5 Turns</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleStartDebate}
                  disabled={isDebating || !debateTopic.trim()}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isDebating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                  Launch Multi-Agent Debate
                </button>
              </div>
            </div>
          </div>

          {/* Debate Messages Stream */}
          <div className="space-y-4">
            {debateMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border space-y-2 text-xs animate-fadeIn ${
                  msg.isHuman
                    ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
                    : msg.role === "proposer"
                    ? "border-indigo-200 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-950/20"
                    : msg.role === "critic"
                    ? "border-rose-200 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/20"
                    : "border-purple-200 dark:border-purple-900 bg-purple-50/30 dark:bg-purple-950/20"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2 font-bold">
                    {msg.isHuman ? (
                      <HandMetal className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Bot className="h-4 w-4 text-indigo-600" />
                    )}
                    <span>{msg.sender}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize">
                      {msg.role}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">Turn #{msg.turn}</span>
                </div>
                <p className="font-sans leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            ))}

            {/* Human Intervention Input */}
            {debateMessages.length > 0 && (
              <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <HandMetal className="h-4 w-4 text-amber-600" />
                  Human-in-the-Loop Intervention
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={humanInterventionText}
                    onChange={(e) => setHumanInterventionText(e.target.value)}
                    placeholder="Inject human argument, counterpoint, or constraint into the debate..."
                    className="flex-1 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-black text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleInjectHumanArgument}
                    disabled={!humanInterventionText.trim()}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Inject Argument
                  </button>
                </div>
              </div>
            )}

            {/* Consensus Card */}
            {debateConsensus && (
              <div className="p-6 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 space-y-2 animate-fadeIn shadow-md">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Multi-Agent Deliberation Consensus Reached
                </div>
                <p className="text-xs font-sans leading-relaxed">{debateConsensus}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
