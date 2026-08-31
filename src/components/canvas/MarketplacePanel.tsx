"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  X,
  Download,
  Sparkles,
  Database,
  BrainCircuit,
  Rss,
  Mic,
  Shield,
  GitFork,
  Target,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { GraphNodeType, AgentGraphDefinition } from "@/types/graph";

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: "starter" | "integration" | "data" | "advanced";
  icon: LucideIcon;
  tags: string[];
  graph: AgentGraphDefinition;
  popularity: number;
}

interface MarketplacePanelProps {
  onDragStart: (event: React.DragEvent, type: GraphNodeType) => void;
  onAddMacro: (graph: AgentGraphDefinition) => void;
  disabled?: boolean;
  onClose: () => void;
}

const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: "tpl-research-agent",
    name: "Research Agent",
    description: "Web search → scrape → analyze → summarize pipeline",
    category: "starter",
    icon: BrainCircuit,
    tags: ["research", "search", "analysis"],
    popularity: 95,
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: 200 }, data: { label: "START" } },
        { id: "agent_1", type: "agent", position: { x: 260, y: 200 }, data: { label: "RESEARCHER", prompt: "Research the given topic thoroughly using web search. Identify key findings and sources.", allowedTools: ["web_search"] } },
        { id: "tool_1", type: "tool", position: { x: 500, y: 200 }, data: { label: "WEB SCRAPE", toolName: "web_reader", action: "read" } },
        { id: "agent_2", type: "agent", position: { x: 740, y: 200 }, data: { label: "ANALYST", prompt: "Analyze the scraped content and extract key insights." } },
        { id: "end", type: "end", position: { x: 980, y: 200 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "agent_1" },
        { id: "e2", source: "agent_1", target: "tool_1" },
        { id: "e3", source: "tool_1", target: "agent_2" },
        { id: "e4", source: "agent_2", target: "end" },
      ],
    },
  },
  {
    id: "tpl-classifier-router",
    name: "Intent Classifier & Router",
    description: "Classify input intent and route to specialist agents",
    category: "advanced",
    icon: GitFork,
    tags: ["routing", "classifier", "multi-agent"],
    popularity: 88,
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: 200 }, data: { label: "START" } },
        { id: "router_1", type: "router", position: { x: 260, y: 200 }, data: { label: "CLASSIFIER", routerMode: "ai", routerPrompt: "Classify the user request into: question, task, or conversation" } },
        { id: "agent_q", type: "agent", position: { x: 520, y: 80 }, data: { label: "Q&A AGENT", prompt: "Answer the user's question comprehensively." } },
        { id: "agent_t", type: "agent", position: { x: 520, y: 200 }, data: { label: "TASK AGENT", prompt: "Execute the requested task step by step." } },
        { id: "agent_c", type: "agent", position: { x: 520, y: 320 }, data: { label: "CHAT AGENT", prompt: "Engage in friendly conversation with the user." } },
        { id: "end", type: "end", position: { x: 760, y: 200 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "router_1" },
        { id: "e2", source: "router_1", target: "agent_q", label: "question" },
        { id: "e3", source: "router_1", target: "agent_t", label: "task" },
        { id: "e4", source: "router_1", target: "agent_c", label: "conversation" },
        { id: "e5", source: "agent_q", target: "end" },
        { id: "e6", source: "agent_t", target: "end" },
        { id: "e7", source: "agent_c", target: "end" },
      ],
    },
  },
  {
    id: "tpl-approval-pipeline",
    name: "HITL Approval Pipeline",
    description: "Agent with human approval gates before critical actions",
    category: "starter",
    icon: Shield,
    tags: ["approval", "safety", "HITL"],
    popularity: 82,
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: 200 }, data: { label: "START" } },
        { id: "agent_1", type: "agent", position: { x: 260, y: 200 }, data: { label: "ANALYZER", prompt: "Analyze the request and prepare an action plan." } },
        { id: "approval_1", type: "approval", position: { x: 500, y: 200 }, data: { label: "REVIEW GATE", approvalReason: "Human must approve the proposed action before execution." } },
        { id: "tool_1", type: "tool", position: { x: 740, y: 200 }, data: { label: "EXECUTE", toolName: "action_executor", action: "run" } },
        { id: "end", type: "end", position: { x: 980, y: 200 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "agent_1" },
        { id: "e2", source: "agent_1", target: "approval_1" },
        { id: "e3", source: "approval_1", target: "tool_1" },
        { id: "e4", source: "tool_1", target: "end" },
      ],
    },
  },
  {
    id: "tpl-rss-ingest",
    name: "RSS Feed Monitor",
    description: "Poll RSS feeds → extract content → notify",
    category: "integration",
    icon: Rss,
    tags: ["rss", "monitoring", "notification"],
    popularity: 75,
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: 200 }, data: { label: "START" } },
        { id: "rss_1", type: "rss_feed", position: { x: 260, y: 200 }, data: { label: "RSS FEED", rssUrl: "https://news.ycombinator.com/rss", rssMaxItems: 10 } },
        { id: "agent_1", type: "agent", position: { x: 500, y: 200 }, data: { label: "SUMMARIZER", prompt: "Summarize the RSS feed items and identify noteworthy articles." } },
        { id: "dispatch_1", type: "notification_dispatcher", position: { x: 740, y: 200 }, data: { label: "NOTIFY", dispatchDestination: "discord", dispatchMessage: "**Feed Update:**\n{{ results.summarizer }}" } },
        { id: "end", type: "end", position: { x: 980, y: 200 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "rss_1" },
        { id: "e2", source: "rss_1", target: "agent_1" },
        { id: "e3", source: "agent_1", target: "dispatch_1" },
        { id: "e4", source: "dispatch_1", target: "end" },
      ],
    },
  },
  {
    id: "tpl-doc-processor",
    name: "Document Processor",
    description: "Parse PDFs → extract tables → store in database",
    category: "data",
    icon: Database,
    tags: ["pdf", "extraction", "database"],
    popularity: 70,
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: 200 }, data: { label: "START" } },
        { id: "docling_1", type: "docling_pdf_parser", position: { x: 260, y: 200 }, data: { label: "PDF PARSE", doclingDocumentUrl: "{{ input.documentUrl }}", doclingOutputFormat: "markdown" } },
        { id: "agent_1", type: "agent", position: { x: 500, y: 200 }, data: { label: "EXTRACTOR", prompt: "Extract structured data from the parsed document." } },
        { id: "nocodb_1", type: "nocodb_record", position: { x: 740, y: 200 }, data: { label: "STORE", nocodbOperation: "create", nocodbTableId: "documents" } },
        { id: "end", type: "end", position: { x: 980, y: 200 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "docling_1" },
        { id: "e2", source: "docling_1", target: "agent_1" },
        { id: "e3", source: "agent_1", target: "nocodb_1" },
        { id: "e4", source: "nocodb_1", target: "end" },
      ],
    },
  },
  {
    id: "tpl-parallel-map",
    name: "Parallel Map-Reduce",
    description: "Fan out work across parallel branches then aggregate",
    category: "advanced",
    icon: Target,
    tags: ["parallel", "fan-out", "aggregate"],
    popularity: 72,
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: 200 }, data: { label: "START" } },
        { id: "parallel_1", type: "parallel", position: { x: 260, y: 200 }, data: { label: "FAN OUT", parallelMode: "map", mapField: "input.items" } },
        { id: "agent_1", type: "agent", position: { x: 520, y: 120 }, data: { label: "WORKER 1", prompt: "Process this item in parallel." } },
        { id: "agent_2", type: "agent", position: { x: 520, y: 200 }, data: { label: "WORKER 2", prompt: "Process this item in parallel." } },
        { id: "agent_3", type: "agent", position: { x: 520, y: 280 }, data: { label: "WORKER 3", prompt: "Process this item in parallel." } },
        { id: "aggregate_1", type: "aggregate", position: { x: 760, y: 200 }, data: { label: "MERGE", aggregateMode: "concat" } },
        { id: "end", type: "end", position: { x: 980, y: 200 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "parallel_1" },
        { id: "e2", source: "parallel_1", target: "agent_1", label: "worker" },
        { id: "e3", source: "parallel_1", target: "agent_2", label: "worker" },
        { id: "e4", source: "parallel_1", target: "agent_3", label: "worker" },
        { id: "e5", source: "agent_1", target: "aggregate_1", label: "join" },
        { id: "e6", source: "agent_2", target: "aggregate_1", label: "join" },
        { id: "e7", source: "agent_3", target: "aggregate_1", label: "join" },
        { id: "e8", source: "aggregate_1", target: "end" },
      ],
    },
  },
  {
    id: "tpl-voice-pipeline",
    name: "Voice Transcription Pipeline",
    description: "Audio input → transcribe → analyze → TTS response",
    category: "integration",
    icon: Mic,
    tags: ["audio", "transcription", "tts"],
    popularity: 65,
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: 200 }, data: { label: "START" } },
        { id: "audio_1", type: "audio_transcriber", position: { x: 260, y: 200 }, data: { label: "STT", audioSourceUrl: "{{ input.audioUrl }}", audioLanguage: "auto" } },
        { id: "agent_1", type: "agent", position: { x: 500, y: 200 }, data: { label: "ANALYZER", prompt: "Analyze the transcribed audio and generate a response." } },
        { id: "tts_1", type: "piper_tts", position: { x: 740, y: 200 }, data: { label: "TTS", piperText: "{{ results.analyzer }}" } },
        { id: "end", type: "end", position: { x: 980, y: 200 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "audio_1" },
        { id: "e2", source: "audio_1", target: "agent_1" },
        { id: "e3", source: "agent_1", target: "tts_1" },
        { id: "e4", source: "tts_1", target: "end" },
      ],
    },
  },
  {
    id: "tpl-loop-refine",
    name: "Iterative Refinement Loop",
    description: "Generate → evaluate → refine loop until quality threshold",
    category: "advanced",
    icon: Layers,
    tags: ["loop", "refinement", "quality"],
    popularity: 78,
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: 200 }, data: { label: "START" } },
        { id: "loop_1", type: "loop", position: { x: 260, y: 200 }, data: { label: "REFINE LOOP", maxIterations: 3 } },
        { id: "agent_gen", type: "agent", position: { x: 500, y: 140 }, data: { label: "GENERATOR", prompt: "Generate or improve the output based on feedback." } },
        { id: "agent_crit", type: "agent", position: { x: 500, y: 280 }, data: { label: "CRITIC", prompt: "Evaluate the quality of the output. Be constructive." } },
        { id: "router_1", type: "router", position: { x: 740, y: 200 }, data: { label: "QUALITY CHECK", routerMode: "deterministic", condition: "results.critic.score >= 8" } },
        { id: "end", type: "end", position: { x: 980, y: 200 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "loop_1" },
        { id: "e2", source: "loop_1", target: "agent_gen", label: "body" },
        { id: "e3", source: "agent_gen", target: "agent_crit" },
        { id: "e4", source: "agent_crit", target: "router_1" },
        { id: "e5", source: "router_1", target: "loop_1", label: "retry" },
        { id: "e6", source: "router_1", target: "end", label: "pass" },
        { id: "e7", source: "loop_1", target: "end", label: "exit" },
      ],
    },
  },
];

const CATEGORIES = [
  { id: "all", label: "ALL" },
  { id: "starter", label: "STARTERS" },
  { id: "integration", label: "INTEGRATIONS" },
  { id: "data", label: "DATA" },
  { id: "advanced", label: "ADVANCED" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  starter: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50",
  integration: "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700/50",
  data: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/50",
  advanced: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700/50",
};

export function MarketplacePanel({ onDragStart: _onDragStart, onAddMacro, disabled = false, onClose }: MarketplacePanelProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [, setDragItem] = useState<MarketplaceItem | null>(null);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return MARKETPLACE_ITEMS.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((t) => t.includes(q))
      );
    }).sort((a, b) => b.popularity - a.popularity);
  }, [search, activeCategory]);

  const handleTemplateDragStart = (event: React.DragEvent, item: MarketplaceItem) => {
    event.dataTransfer.setData("application/marketplace-template", JSON.stringify(item.graph));
    event.dataTransfer.effectAllowed = "copy";
    setDragItem(item);
  };

  return (
    <div className="space-y-2.5 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-bold">
            MARKETPLACE
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <p className="text-[8px] text-slate-500 dark:text-slate-400 leading-relaxed">
        Drag templates onto the canvas or click to add them directly.
      </p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="w-full pl-6 pr-6 py-1 text-[9px] rounded bg-white dark:bg-[#07080f] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-1.5 py-0.5 text-[8px] font-bold rounded transition-all cursor-pointer ${
              activeCategory === cat.id
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template List */}
      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 scrollbar-thin">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const nodeCount = item.graph.nodes.length;
          const edgeCount = item.graph.edges.length;
          return (
            <div
              key={item.id}
              draggable={!disabled}
              onDragStart={(e) => handleTemplateDragStart(e, item)}
              onClick={() => !disabled && onAddMacro(item.graph)}
              className={`group relative rounded-lg border border-slate-200 dark:border-slate-800/80 bg-slate-50/90 dark:bg-[#0c0d18]/90 p-2.5 transition-all hover:border-amber-400 dark:hover:border-amber-500/60 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 shadow-xs hover:shadow-md ${
                disabled ? "opacity-40 cursor-not-allowed" : "cursor-grab active:cursor-grabbing hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="shrink-0 p-1.5 rounded bg-amber-100/80 dark:bg-amber-900/30">
                  <Icon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100 tracking-wider truncate">
                      {item.name}
                    </span>
                    <span className={`px-1 py-0.5 rounded border text-[7px] font-bold ${CATEGORY_COLORS[item.category]}`}>
                      {item.category.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[8px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {item.description}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[7px] text-slate-400">{nodeCount} nodes · {edgeCount} edges</span>
                    <div className="flex gap-0.5">
                      {item.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800/60 text-[7px] text-slate-500 dark:text-slate-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Download className="h-3 w-3 text-amber-500" />
                </div>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <div className="text-center py-4 text-[9px] text-slate-400">
            No matching templates found
          </div>
        )}
      </div>
    </div>
  );
}
