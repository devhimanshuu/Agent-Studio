import React from "react";
import Link from "next/link";
import {
  Check,
  CheckSquare,
  GitCompare,
  Terminal,
  ArrowRight,
  Lock,
  Wrench,
  Shield,
  ShieldCheck,
  Database,
  Zap,
  HelpCircle,
  ChevronDown,
  GitBranch,
  RefreshCw,
  ListChecks,
  Braces,
  Flag,
  Activity,
  FileText,
  Search,
  SlidersHorizontal,
  Workflow,
  Cpu,
  Layers,
  Bot,
  Users,
  GitFork,
  Repeat,
  Boxes,
  Eye,
  Gauge,
  TimerReset,
  History,
  Wallet,
  MousePointerClick,
  LayoutTemplate,
  Keyboard,
  Palette,
  Link2,
  TriangleAlert,
  BarChart3,
  Sparkles,
  Network,
  Webhook,
  Camera,
  Globe,
  Download,
  Star,
  TrendingUp,
  Puzzle,
  Package,
  ServerCog,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Reveal } from "@/components/Reveal";

// These are all `"use client"` components — client components render on the
// server too, so `ssr: false` is both unnecessary and rejected by Next 15 in
// Server Components (the page module). Lazy-loading without it keeps the
// route split while staying build-safe.
const LiveExecutionTerminal = dynamic(() => import("@/components/landing/LiveExecutionTerminal").then((m) => m.LiveExecutionTerminal));
const LiveAgentCanvasDemo = dynamic(() => import("@/components/landing/LiveAgentCanvasDemo").then((m) => m.LiveAgentCanvasDemo));
const PixelGridWave = dynamic(() => import("@/components/landing/PixelGridWave").then((m) => m.PixelGridWave));
const NeuralPatterns = dynamic(() => import("@/components/landing/NeuralPatterns").then((m) => m.NeuralPatterns));
const FooterPortfolioWidget = dynamic(() => import("@/components/landing/FooterPortfolioWidget").then((m) => m.FooterPortfolioWidget));
const HeroAuthSection = dynamic(() => import("@/components/landing/HeroAuthSection").then((m) => m.HeroAuthSection));
const FooterAuthCTA = dynamic(() => import("@/components/landing/HeroAuthSection").then((m) => m.FooterAuthCTA));


const runtimeNodes = [
  {
    tag: "PLANNER NODE",
    accent: "text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-black/40",
    icon: ListChecks,
    title: "Plan Generation",
    desc: "The LLM is one dependency of one node. It emits a deterministic, schema-validated execution plan — never touches tools directly.",
  },
  {
    tag: "PERMISSION NODE",
    accent: "text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-black/40",
    icon: ShieldCheck,
    title: "Tool Authorization",
    desc: "Every planned step must exist, be enabled, and be listed in the workflow's allowedTools — anything else is rejected before it runs.",
  },
  {
    tag: "SELECTION NODE",
    accent: "text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-black/40",
    icon: GitBranch,
    title: "Step Routing",
    desc: "The graph walks step-by-step via conditional edges: approve, execute, or finish — the plan is walked deterministically.",
  },
  {
    tag: "EXECUTION NODE",
    accent: "text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-black/40",
    icon: Wrench,
    title: "Step Execution",
    desc: "Executes extraction, classification, condition, and tool steps with state continuity and automatic transient retry handling.",
  },
  {
    tag: "REVIEW NODE",
    accent: "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-black/40",
    icon: Shield,
    title: "HITL Pause",
    desc: "Write actions flagged for review park the run in PAUSED_FOR_APPROVAL. A single-use idempotency key guarantees the response happens once.",
  },
  {
    tag: "FINISH NODE",
    accent: "text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-black/40",
    icon: Flag,
    title: "Report Synthesis",
    desc: "Step results and path decisions are synthesized into the final output and persisted alongside the full node timeline.",
  },
];

const boundedStepTypes = [
  {
    name: "structured_input",
    title: "1. Structured Input",
    type: "INPUT",
    icon: Layers,
    badge: "SCHEMA VALIDATED",
    badgeColor: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700/40",
    desc: "Strict JSON Schema parameters validated before execution begins to prevent malformed or invalid inputs.",
  },
  {
    name: "document_retrieval",
    title: "2. Document Retrieval",
    type: "SEARCH",
    icon: Search,
    badge: "KNOWLEDGE SEARCH",
    badgeColor: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700/40",
    desc: "Keyword and semantic lookup over internal document stores and knowledge base policies with relevance ranking.",
  },
  {
    name: "ai_extraction",
    title: "3. AI Extraction",
    type: "DATA",
    icon: Cpu,
    badge: "CONFIDENCE SCORED",
    badgeColor: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700/40",
    desc: "Extracts strongly typed key-value pairs (amounts, IDs, dates) from unstructured payloads with confidence metrics.",
  },
  {
    name: "ai_classification",
    title: "4. AI Classification",
    type: "DATA",
    icon: SlidersHorizontal,
    badge: "REASONING LOGGED",
    badgeColor: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700/40",
    desc: "Categorizes input data into predefined discrete business classes with probability scores and rationale.",
  },
  {
    name: "deterministic_condition",
    title: "5. Deterministic Condition",
    type: "COMPUTE",
    icon: GitBranch,
    badge: "DECISION EXPLAINER",
    badgeColor: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/40",
    desc: "Evaluates deterministic business rules (>, <, =, in) and generates an explicit auditable path decision explanation.",
  },
  {
    name: "human_approval",
    title: "6. Human Approval",
    type: "GUARDRAIL",
    icon: CheckSquare,
    badge: "HITL WRITE LOCK",
    badgeColor: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/40",
    desc: "Pauses the execution state for human review. Enforces single-use idempotency tokens to prevent duplicate writes.",
  },
  {
    name: "mock_external_action",
    title: "7. Mock External Action",
    type: "TASK",
    icon: Wrench,
    badge: "IDEMPOTENT WRITE",
    badgeColor: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700/40",
    desc: "Simulates external tasks, ticket dispatches, or API webhooks under strict permissions and approval locks.",
  },
  {
    name: "final_report",
    title: "8. Final Report",
    type: "REPORT",
    icon: FileText,
    badge: "EXECUTIVE SUMMARY",
    badgeColor: "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700/40",
    desc: "Synthesizes all step outcomes, decision explanations, and evidences into a structured executive markdown report.",
  },
];

const canvasNodeTypes = [
  { name: "START", icon: Flag, cls: "text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-black/40" },
  { name: "AGENT", icon: Bot, cls: "text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-black/40" },
  { name: "SUPERVISOR", icon: Users, cls: "text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-black/40" },
  { name: "TOOL", icon: Wrench, cls: "text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-black/40" },
  { name: "ROUTER", icon: GitBranch, cls: "text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-black/40" },
  { name: "APPROVAL", icon: CheckSquare, cls: "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-black/40" },
  { name: "LOOP", icon: Repeat, cls: "text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-black/40" },
  { name: "PARALLEL", icon: GitFork, cls: "text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-black/40" },
  { name: "SUBGRAPH", icon: Boxes, cls: "text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 bg-teal-50 dark:bg-black/40" },
  { name: "END", icon: Flag, cls: "text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-black/40" },
];

const upcomingNodeTypes = [

  {
    name: "VECTOR MEMORY",
    tag: "Q3",
    icon: Database,
    desc: "Long-term episodic memory & persistent RAG embeddings",
    cls: "text-sky-700 dark:text-sky-300 border-dashed border-sky-400/70 dark:border-sky-500/50 bg-sky-50/60 dark:bg-sky-950/30",
    badgeCls: "bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700",
  },
  {
    name: "WEBHOOK TRIGGER",
    tag: "SOON",
    icon: Webhook,
    desc: "External HTTP event ingress & real-time webhook listener",
    cls: "text-amber-700 dark:text-amber-300 border-dashed border-amber-400/70 dark:border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/30",
    badgeCls: "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700",
  },
  {
    name: "MULTI-MODAL VISION",
    tag: "LABS",
    icon: Camera,
    desc: "Perceptual vision analysis & streaming audio agents",
    cls: "text-rose-700 dark:text-rose-300 border-dashed border-rose-400/70 dark:border-rose-500/50 bg-rose-50/60 dark:bg-rose-950/30",
    badgeCls: "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700",
  },
  {
    name: "CODE SANDBOX",
    tag: "LABS",
    icon: Terminal,
    desc: "Isolated WebAssembly / E2B micro-VM container execution",
    cls: "text-cyan-700 dark:text-cyan-300 border-dashed border-cyan-400/70 dark:border-cyan-500/50 bg-cyan-50/60 dark:bg-cyan-950/30",
    badgeCls: "bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border-cyan-300 dark:border-cyan-700",
  },
];

const runtimeIntel = [
  {
    icon: Eye,
    title: "Ghost-Mode Preview",
    desc: "Run the interpreter in dry-run against live state — nodes light up in fast-forward showing exactly what would happen before you hit Run. Zero writes, zero cost.",
    accent: "text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-black/40",
  },
  {
    icon: Gauge,
    title: "Latency Heatmap",
    desc: "Per-node latency, token, and cost metrics rendered straight on the canvas. Toggle heatmap mode to spot slow or expensive branches at a glance.",
    accent: "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-black/40",
  },
  {
    icon: TimerReset,
    title: "Time-Scrub Replay",
    desc: "A timeline scrubber replays any execution — nodes glow and dim in sync with 1×–8× speed control. Rewatch exactly where a run diverged.",
    accent: "text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-black/40",
  },
  {
    icon: History,
    title: "Deterministic Replay",
    desc: "Persist every LLM response and replay a past execution with the exact same outputs for the non-LLM parts — a debugging superpower.",
    accent: "text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-black/40",
  },
  {
    icon: Wallet,
    title: "Budget Guardrails",
    desc: "Max cost, token, and step caps per node. The interpreter stops a runaway agent and flags the exact node that blew its budget.",
    accent: "text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-black/40",
  },
  {
    icon: ShieldCheck,
    title: "HITL Escalation Rules",
    desc: "Approval nodes get conditions (approve if state.risk < 3, else escalate) plus a timeout that auto-escalates stale requests to a reviewer.",
    accent: "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-black/40",
  },
  {
    icon: GitFork,
    title: "Branch Coverage View",
    desc: "After several runs, edges that have never been traversed are highlighted — so you know your router conditions are actually reachable.",
    accent: "text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-black/40",
  },
  {
    icon: TriangleAlert,
    title: "Idle-Time Validation",
    desc: "Auto-detect disconnected islands, unreachable END nodes, and router conditions that can never be true — inline warnings on the canvas as you edit.",
    accent: "text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-black/40",
  },
];

const devTooling = [
  {
    icon: Network,
    title: "MCP Ecosystem & Server Hub",
    desc: "Connect remote SSE and stdio Model Context Protocol servers (GitHub, Postgres, Slack, Brave Search) or expose Agent Studio workflows as MCP tools to Cursor & Claude Desktop.",
  },
  {
    icon: LayoutTemplate,
    title: "Auto-Layout & Snap Grid",
    desc: "One click runs layered BFS auto-layout over any hand-built graph, with snap-to-grid guides so designs never look messy.",
  },
  {
    icon: Braces,
    title: "Inline Prompt Editor",
    desc: "Monaco-style prompt editing with {{state.field}} autocomplete, hover preview of resolved values, and live token-count feedback as you type.",
  },
  {
    icon: GitCompare,
    title: "Visual Version Diffing",
    desc: "Side-by-side diff of two graph versions — nodes added/removed, edges rerouted — with one-click revert to any published version.",
  },
  {
    icon: Boxes,
    title: "Sub-Graphs & Macros",
    desc: "Collapse any branch into a reusable component node with typed inputs/outputs, then nest graphs inside graphs — up to 8 levels deep.",
  },
  {
    icon: Keyboard,
    title: "Keyboard-First Editing",
    desc: "⌘+drag to pan, ⌥+click to duplicate, ⌫ to delete — with shortcut hints in a command palette for power users.",
  },
  {
    icon: Palette,
    title: "Canvas Themes",
    desc: "Neon/cyber default, graphite minimal, and high-contrast themes — persisted per user with full dark-mode support.",
  },
  {
    icon: Link2,
    title: "Shareable Snapshot Links",
    desc: "Render any graph + its final trace as a read-only, embeddable snapshot view — perfect for docs, PRs, or Slack.",
  },
];

const faqExtra = [
  {
    q: "How does Model Context Protocol (MCP) work in Agent Studio?",
    a: "Agent Studio functions as both an MCP Client and an MCP Server. You can connect remote SSE or local stdio MCP servers (like GitHub, Postgres, and Brave Search), auto-discover their tools, and invoke them in your agent graphs with permission guardrails. External IDEs like Cursor and Claude Desktop can also connect directly to /api/mcp/sse to execute your published workflows as tools.",
  },
  {
    q: "What is the Visual Multi-Agent Canvas?",
    a: "Agent Studio's canvas is a full drag-and-drop graph editor (React Flow) for designing multi-agent architectures — Supervisor → Researcher → Coder → Critic loops, conditional routers, map-reduce parallel branches, loop counters, and nested sub-graphs. Runs stream live over SSE so nodes pulse in real-time as the graph executes.",
  },
  {
    q: "What is Ghost-Mode Preview?",
    a: "A dry-run of your graph against real execution state. Nodes light up in fast-forward showing exactly the path a run would take — including router decisions and approval gates — without writing anything or spending tokens. De-risk graph changes before you hit Run.",
  },
  {
    q: "Can I replay a past execution deterministically?",
    a: "Yes. Every LLM response is persisted, and the Replay button re-executes a past run using those exact recorded outputs for the non-LLM parts (routers, tools, loops). It's the fastest way to debug why a graph diverged.",
  },
  {
    q: "How do budget guardrails work?",
    a: "Each node can carry max cost, token, and step caps. When a node exceeds its budget, the interpreter stops the run and flags the offending node — so runaway agents never rack up surprise bills.",
  },
  {
    q: "Can I edit the canvas without a mouse?",
    a: "Yes — the editor is keyboard-first: ⌘/Ctrl+drag pans, ⌥/Alt+click duplicates a node, ⌫ deletes, and a command palette lists every shortcut. Auto-layout and snap-to-grid keep hand-built graphs tidy.",
  },
  {
    q: "Are graphs versioned and shareable?",
    a: "Every graph version is immutable and diffable side-by-side against any published version with one-click revert. Any graph + its final trace can be shared as a read-only snapshot link for docs or review.",
  },
  {
    q: "How does the LLM auto-failover router work?",
    a: "Agent Studio routes every LLM call through 12 free models across Groq and OpenRouter with circuit-breaker failover. If a model returns a 429, 5xx, or 404, the router automatically tries the next healthy model with adaptive cooldowns — so your agent runs never fail due to a single provider outage.",
  },
];

// ────────────── Official MCP Ecosystem SVG Logos ──────────────
function SmitheryOfficialLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 135 159" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Smithery.ai Official Logo">
      <path d="M31.3508 58.4053H0V78.9492C0 90.8872 9.67578 100.563 21.6138 100.563H42.1577V69.2122C42.1577 63.2432 37.3198 58.4053 31.3508 58.4053Z" fill="#FF5601"/>
      <path d="M46.2327 69.2122V100.563H77.5835C83.5525 100.563 88.3904 95.7251 88.3904 89.7561V58.4053H57.0396C51.0706 58.4053 46.2327 63.2432 46.2327 69.2122Z" fill="#FF5601"/>
      <path d="M113.013 58.4053H92.4695V89.7561C92.4695 95.7251 97.3074 100.563 103.276 100.563H134.627V80.0191C134.627 68.0811 124.951 58.4053 113.013 58.4053Z" fill="#FF5601"/>
      <path d="M0.000244141 37.5535V54.351H31.3511C37.3201 54.351 42.158 49.5131 42.158 43.5441V6.01534C40.9332 5.97572 39.6616 5.9541 38.3323 5.9541C17.9865 5.9541 0.000244141 15.9001 0.000244141 37.5535Z" fill="#FF5601"/>
      <path d="M46.2327 43.5332C46.2327 49.5022 51.0706 54.3401 57.0396 54.3401H88.3904V14.4735C71.0993 12.8596 64.1109 7.47418 46.2327 6.21338V43.5368V43.5332Z" fill="#FF5601"/>
      <path d="M98.8636 14.9351C96.5833 14.9351 94.4616 14.8775 92.4695 14.773V54.3443H113.013C124.951 54.3443 134.627 44.6685 134.627 32.7305V0C127.945 8.91209 116.097 14.9351 98.8636 14.9351Z" fill="#FF5601"/>
      <path d="M35.7697 144.068C38.05 144.068 40.1718 144.126 42.1638 144.23V104.659H21.6199C9.68188 104.659 0.00610352 114.335 0.00610352 126.273V159C6.68837 150.088 18.5363 144.065 35.7733 144.065L35.7697 144.068Z" fill="#FF5601"/>
      <path d="M88.3904 115.466C88.3904 109.497 83.5525 104.659 77.5835 104.659H46.2327V144.529C63.5237 146.143 70.5122 151.529 88.3904 152.79V115.466Z" fill="#FF5601"/>
      <path d="M134.627 121.5V104.659H103.276C97.3074 104.659 92.4695 109.497 92.4695 115.466V152.995C93.6943 153.034 94.9659 153.052 96.2951 153.052C116.63 153.052 134.606 143.121 134.627 121.496V121.5Z" fill="#FF5601"/>
    </svg>
  );
}

function GlamaOfficialLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Glama.ai Official Logo">
      <path d="M17.72 10.922c.237-.213.235-.254-.024-.514-.46-.46-.922-.917-1.382-1.377-.241-.241-.479-.487-.72-.728-.102-.101-.156-.193-.011-.303.082-.062.043-.129-.02-.182-.16-.135-.343-.203-.543-.113-.24.107-.422.226-.452.558-.094 1.041-.976 1.685-2.026 1.542-1.029-.14-1.69-1.042-1.72-1.981a.3.3 0 00-.118-.248c-.12-.09-.242-.179-.361-.267-.072.05-.05.108-.036.159.03.108-.012.17-.112.208-.628.238-1.254.483-1.884.714-.326.12-.648.249-.966.39a.89.89 0 00-.403.382c-.172-.093-.183-.227-.153-.371a.695.695 0 01.35-.49c.329-.186.686-.302 1.037-.436.549-.21 1.095-.427 1.645-.637.108-.042.223-.068.34-.103.019-.092-.022-.176-.034-.262-.032-.23.07-.39.298-.425.42-.065.846-.08 1.262-.172.3-.066.597-.14.91-.135.802.013 1.408.353 1.811 1.048.023.038.048.075.08.125.516-.31 1.026-.323 1.525.045.095-.132.157-.27.253-.387.4-.487.926-.745 1.534-.853.21-.037.415.018.614.069.418.107.845.162 1.27.226.18.027.363.067.43.27.072.215.008.415-.203.555-.28.186-.41.435-.43.768-.022.393-.197.732-.434 1.038-.185.24-.385.469-.685.575-.208.074-.415.14-.644.006.001.144.093.214.162.291.146.163.293.325.417.506.22.321.201.614-.064.898-.08.086-.093.143-.02.255.2.306.35.634.383 1.01.027.307-.204.705-.534.84-.134.054-.188.135-.239.265-.236.597-.662.97-1.316 1.054-.463.06-.894-.03-1.286-.277-.182-.114-.35-.156-.547-.044-.22.125-.435.262-.467.534-.092.768-.127 1.541-.105 2.314.006.18.095.332.207.468.11.134.15.28.055.434-.253.41-.125.785.102 1.148.086.137.189.265.3.383.113.122.13.256.095.405-.019.081-.035.17-.079.238-.128.202-.085.398.002.593.44.984.928 1.933 1.802 2.618.017.013.034.03.049.046.064.068.162.14.102.241a.292.292 0 01-.32.134.868.868 0 01-.418-.24c-.71-.668-1.251-1.447-1.554-2.38a8.814 8.814 0 00-.139-.397c-.07-.187-.084-.378.014-.553.078-.14.045-.258-.044-.354-.47-.505-.522-1.13-.536-1.771-.003-.128-.006-.262-.044-.382-.185-.59-.167-1.196-.15-1.8.006-.19-.061-.27-.235-.315-.77-.197-1.482-.518-2.09-1.036a1.43 1.43 0 00-.692-.308c-1.078-.205-2.006-1.133-2.219-2.208-.021-.109-.011-.208.083-.27.114-.074.24-.129.38-.083.058.018.075.077.081.137.107 1.048 1.096 1.814 2.102 1.97.752.115 1.481.042 2.213-.122.474-.107.96-.155 1.44-.22.207-.028.376.055.527.178.276.228.597.355.944.408.334.051.661.025.947-.185.119-.087.219-.19.243-.338-.021-.03-.044-.033-.064-.023-.4.196-.8.132-1.193-.007a3.36 3.36 0 01-1.392-.912.7.7 0 01-.117-.163c-.048-.099-.04-.196.054-.271.094-.075.188-.093.287-.006.305.268.626.509 1.02.634.279.089.557.095.843.027.494-.117.491-.832.215-1.13-.232-.249-.525-.273-.825-.31-.236-.03-.45-.104-.573-.33-.104-.19-.068-.287.134-.361.3-.11.606-.196.933-.178.27.016.468.136.593.377.038.075.076.15.124.219.082.117.154.114.23-.01.063-.105.116-.217.182-.335zm-5.344-3.915c-.046.216.04.367.26.433.171.053.34.107.487.216.106.077.196.146.114.3-.028.052-.017.133-.007.198.028.177.214.31.363.267.172-.05.233-.176.146-.375-.093-.213-.17-.423-.173-.659a.366.366 0 00-.103-.226 1.058 1.058 0 00-.578-.353c-.193-.04-.384-.027-.51.199zm5.594.506c.066-.002.136.015.187-.047.15-.179.009-.591-.221-.629a1.17 1.17 0 00-.334-.002c-.173.023-.226.165-.264.31-.035.136.066.187.16.24.137.079.278.144.472.128zm-.221 4.33c-.173.267-.138.556-.072.84a.26.26 0 00.28.196c.128-.012.165-.137.165-.256-.002-.333-.12-.64-.198-.959-.097.027-.112.11-.175.179zm.985-3.802c-.088-.19-.227-.259-.4-.192-.139.055-.145.174-.12.294.03.157.16.262.289.246.15-.018.24-.139.231-.348z" />
      <path d="M17.747 5.752c-.302-.138-.56-.02-.815.1-.158.074-.294.184-.433.288-.077.057-.168.113-.264.07-.091-.043-.065-.145-.073-.227-.006-.061-.024-.124-.017-.184.072-.606-.3-.931-.764-1.186-.238-.13-.484-.266-.775-.241-.135.011-.246.056-.3.193.06.075.141.075.217.089.407.073.794.185 1.096.498.222.23.319.48.186.791a.339.339 0 00.088.413c.074.069.167.132.19.275a.995.995 0 01-.522-.228c-.082-.068-.149-.153-.226-.226-.107-.1-.155-.199-.095-.354.063-.163-.03-.313-.23-.416-.276-.144-.579-.2-.881-.261-.338-.07-.661-.187-.89-.465-.097-.117-.198-.117-.328-.08-.438.122-.852.31-1.275.472-.703.267-1.383.588-2.042.946-.758.411-1.516.83-2.188 1.376a3.723 3.723 0 00-1.01 1.284c-.07.143-.098.3-.096.457a.518.518 0 01-.132.369c-.406.46-.49.988-.327 1.568.047.168.08.338.02.512-.025.075-.065.133-.143.15-.582.126-1.166.18-1.73-.062-.437-.187-.565-.537-.402-.98.144-.391.397-.713.66-1.027.725-.868 1.563-1.615 2.465-2.298a19.235 19.235 0 012.204-1.447c.92-.515 1.867-.97 2.857-1.339.881-.33 1.765-.652 2.673-.897a14.209 14.209 0 012.337-.447c.558-.054 1.115-.098 1.672.004.171.03.337.081.492.164.356.19.476.487.317.861-.164.388-.435.703-.753.977-.182.157-.371.306-.554.463-.06.052-.118.085-.209.045zm-10.032.31c-.237.206-.286.194-.36-.113a6.627 6.627 0 01-.149-2.1c.035-.436.073-.871.24-1.28.288-.698.685-1.32 1.269-1.813.074-.062.227-.13.162-.238-.08-.132-.204-.004-.292.042-.37.196-.648.492-.867.847-.35.57-.646 1.163-.787 1.825-.054.252-.066.51-.093.764-.03.29-.044.581-.042.872a.642.642 0 01-.149.435c-.197-.23-.272-.494-.305-.772-.074-.625.107-1.207.306-1.786.203-.593.484-1.142.906-1.614.269-.301.615-.48.963-.663.228-.12.454-.244.686-.355.141-.067.293-.116.455-.089.416.07.586.365.494.85-.089.459-.329.854-.546 1.256-.425.788-.867 1.568-1.072 2.452-.077.332-.15.664-.222.997-.025.115-.075.197-.195.248-.138.059-.262.15-.402.235zm3.76-1.923c-.82.348-1.64.66-2.402 1.136-.041-.13-.015-.248.001-.356.042-.282.107-.56.161-.84.02-.107.072-.16.19-.17.204-.02.38-.127.563-.212a11.085 11.085 0 012.508-.843c.265-.053.534-.056.803-.048.037.001.083.009.11.031.144.125.284.253.423.383.032.03.058.07.041.124-.819.188-1.592.519-2.397.795z" />
    </svg>
  );
}

function McpProtocolLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Model Context Protocol Logo">
      <path d="M25 97.8528L92.8822 29.9706C102.255 20.598 117.451 20.598 126.823 29.9706V29.9706C136.196 39.3431 136.196 54.5391 126.823 63.9117L75.5581 115.177" stroke="currentColor" strokeWidth="16" strokeLinecap="round"/>
      <path d="M76.2652 114.47L126.823 63.9117C136.196 54.5391 151.392 54.5391 160.765 63.9117L161.118 64.2652C170.491 73.6378 170.491 88.8338 161.118 98.2063L99.7248 159.6C96.6006 162.724 96.6006 167.789 99.7248 170.913L112.331 183.52" stroke="currentColor" strokeWidth="16" strokeLinecap="round"/>
      <path d="M109.853 46.9411L59.6482 97.1457C50.2756 106.518 50.2756 121.714 59.6482 131.087V131.087C69.0208 140.459 84.2167 140.459 93.5893 131.087L143.794 80.8822" stroke="currentColor" strokeWidth="16" strokeLinecap="round"/>
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="space-y-16 sm:space-y-24 px-4 sm:px-6 lg:px-10 pt-0">
      {/* SECTION 1: HERO SECTION & INTERACTIVE TERMINAL */}
      <section className="relative overflow-hidden border-b border-indigo-200/80 dark:border-indigo-950/80 -mx-4 sm:-mx-6 lg:-mx-10 -mt-0 bg-gradient-to-b from-indigo-50/80 via-slate-50/40 to-transparent dark:from-transparent">
        {/* Premium Animated Background Layers */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <PixelGridWave />
          <NeuralPatterns />
          <div className="absolute inset-0 crt-lines" />
          <div className="absolute -top-48 -left-32 h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-indigo-400/25 to-indigo-300/15 dark:from-indigo-600/25 blur-[120px]" />
          <div className="absolute top-1/4 -right-40 h-[460px] w-[460px] rounded-full bg-gradient-to-tr from-sky-400/25 to-cyan-300/15 dark:from-cyan-500/15 blur-[120px]" />
          <div className="absolute -bottom-24 left-1/4 h-[380px] w-[380px] rounded-full bg-gradient-to-tr from-violet-400/20 to-purple-300/15 dark:from-violet-600/15 blur-[120px]" />
          <div className="absolute inset-0 bg-grid-faint [mask-image:radial-gradient(ellipse_80%_80%_at_50%_35%,black_40%,transparent_95%)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-slate-50 dark:to-black" />
          <div
            className="absolute inset-0 hidden dark:block"
            style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.5) 100%)" }}
          />
        </div>

        <div className="relative z-10 space-y-6 sm:space-y-8 py-10 sm:py-20 lg:py-24 px-3 sm:px-6 lg:px-10">
          {/* Announcement Pill */}
          <div className="animate-fadeInUp">
            <div className="inline-flex max-w-full items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-1.5 rounded-full border border-indigo-300 dark:border-indigo-400/30 bg-indigo-50/90 dark:bg-indigo-500/10 text-[10px] sm:text-[11px] font-mono text-indigo-700 dark:text-indigo-200 uppercase tracking-wider sm:tracking-widest backdrop-blur-sm shadow-sm leading-snug">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 dark:bg-indigo-400 opacity-60"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>
              </span>
              <span className="truncate font-semibold">Visual Multi-Agent Canvas · Native MCP Hub · Live SSE Traces · HITL Escalation</span>
            </div>
          </div>

          {/* Pixel Block Headline */}
          <h1
            className="glitch animate-fadeInUp text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-pixel uppercase tracking-tight leading-tight max-w-5xl text-slate-900 dark:text-slate-100 break-words"
            style={{ animationDelay: "100ms" }}
            data-text="VISUAL MULTI-AGENT ORCHESTRATION STUDIO"
          >
            VISUAL <span className="text-gradient-glow">MULTI-AGENT</span> ORCHESTRATION STUDIO
          </h1>

          {/* Redesigned Subhead Text Design */}
          <div
            className="animate-fadeInUp space-y-3 max-w-3xl font-mono-tech"
            style={{ animationDelay: "200ms" }}
          >
            <p className="text-lg sm:text-2xl text-slate-900 dark:text-slate-100 font-medium leading-snug tracking-tight font-sans">
              Architect, simulate, and deploy{" "}
              <span className="text-gradient-glow font-semibold">deterministic multi-agent graphs</span> with real-time SSE execution, Model Context Protocol (MCP) integrations, and human-in-the-loop governance.
            </p>
            <p className="text-xs sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-mono-tech">
              Wire <span className="text-indigo-700 dark:text-indigo-300 font-semibold">supervisor → researcher → coder → critic loops</span> with{" "}
              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">conditional routers, remote MCP tool discovery</span>, watch nodes pulse in real time, and protect write actions with{" "}
              <span className="text-amber-700 dark:text-amber-300 font-semibold">single-use approval locks</span>.
            </p>
          </div>

          <HeroAuthSection />

          {/* Trust Guarantees Strip */}
          <div className="animate-fadeInUp pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-mono text-slate-600 dark:text-slate-400" style={{ animationDelay: "350ms" }}>
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
              <Check className="h-3.5 w-3.5" /> 100% Deterministic Routing
            </span>
            <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-semibold">
              <Check className="h-3.5 w-3.5" /> Zero Unbounded Hallucinations
            </span>
            <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 font-semibold">
              <Check className="h-3.5 w-3.5" /> Native MCP Client & Server
            </span>
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
              <Check className="h-3.5 w-3.5" /> Idempotent Single-Use Tokens
            </span>
            <span className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400 font-semibold">
              <Check className="h-3.5 w-3.5" /> 12 Free LLM Auto-Failover Models
            </span>
          </div>

          {/* Scroll Hint */}
          <div className="flex justify-center pt-4 animate-float">
            <ChevronDown className="h-5 w-5 text-indigo-500/70 dark:text-indigo-400/50" />
          </div>
        </div>
      </section>

      {/* SECTION 2: SOCIAL PROOF & KEY METRICS */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-center">
        <Reveal delay={0}>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">9</div>
            <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold">Node Types on Visual Canvas</div>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300">
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">LIVE</div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">SSE Execution Traces & Pulses</div>
          </div>
        </Reveal>
        <Reveal delay={160}>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300">
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">100%</div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">Idempotent Approval Locks</div>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">EXPLAINED</div>
            <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold">Auditable Path Decision Rationale</div>
          </div>
        </Reveal>
      </section>

      {/* SECTION 3: THE VISUAL MULTI-AGENT CANVAS (#canvas) */}
      <section id="canvas" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 01. THE VISUAL MULTI-AGENT CANVAS</span>
            <span>REACT FLOW · DRAG-AND-DROP ORCHESTRATOR</span>
          </div>
        </Reveal>

        <Reveal delay={0}>
          <LiveAgentCanvasDemo />
        </Reveal>

        {/* Canvas feature bullets & node types */}
        <Reveal delay={100}>
          <div className="p-5 sm:p-6 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-5 font-mono shadow-sm">
            <div className="text-xs font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 border-b border-slate-200 dark:border-indigo-950/60 pb-3 flex flex-wrap items-center justify-between gap-2 font-semibold">
              <span className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> DESIGN, SIMULATE & EXECUTE ON ONE CANVAS
              </span>
              <span className="text-[10px] text-slate-500 font-mono">10 NODE TYPES SUPPORTED</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-4 rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all duration-300">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">01.</span> Visual Graph Authoring
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Drag agent, supervisor, tool, router, approval, loop, parallel, and subgraph nodes onto an infinite canvas and wire them with typed edges — no code required.
                </p>
              </div>

              <div className="p-4 rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-all duration-300">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">02.</span> Live Pulsing Execution Traces
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Runs stream over SSE — nodes glow green, red, or amber in real time as the graph plans, executes tools, or waits for HITL approvals, with animated edges.
                </p>
              </div>

              <div className="p-4 rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-violet-400 dark:hover:border-violet-500/50 transition-all duration-300">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-violet-600 dark:text-violet-400 font-mono font-bold">03.</span> Conditional Branching & Loops
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Dynamic routers, map-reduce parallel fan-out, and loop counters live directly on the graph — including nested sub-graphs up to 8 levels deep.
                </p>
              </div>

              <div className="p-4 rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-sky-400 dark:hover:border-sky-500/50 transition-all duration-300">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-sky-600 dark:text-sky-400 font-mono font-bold">04.</span> Ghost Preview Before You Run
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Dry-run the interpreter in fast-forward — nodes light up showing exactly the path a run would take, with zero writes and zero token cost.
                </p>
              </div>
            </div>

            {/* Supported & Upcoming Node Badges Deck */}
            <div className="pt-4 border-t border-slate-200 dark:border-indigo-950/60 space-y-3">
              {/* Row 1: Ready in Production */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono uppercase mr-1 font-bold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block shadow-sm" />
                  PRODUCTION NODES:
                </span>
                {canvasNodeTypes.map((n) => (
                  <span
                    key={n.name}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-wider shadow-sm transition-all duration-200 hover:scale-105 ${n.cls}`}
                  >
                    <n.icon className="h-3 w-3" />
                    {n.name}
                  </span>
                ))}
              </div>

              {/* Row 2: Experimental & Coming Soon (Creative Roadmap) */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dashed border-slate-200 dark:border-indigo-950/50">
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono uppercase mr-1 font-bold flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  COMING SOON · LABS:
                </span>
                {upcomingNodeTypes.map((n) => (
                  <div
                    key={n.name}
                    title={n.desc}
                    className={`group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105 cursor-help ${n.cls}`}
                  >
                    <n.icon className="h-3 w-3 opacity-90 group-hover:rotate-12 transition-transform" />
                    <span>{n.name}</span>
                    <span className={`text-[7.5px] px-1 py-0.5 rounded border font-mono font-bold tracking-tight ${n.badgeCls}`}>
                      {n.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* SECTION 4: LIVE RUNTIME INTELLIGENCE (#runtime-intel) */}
      <section id="runtime-intel" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 02. LIVE RUNTIME INTELLIGENCE</span>
            <span>OBSERVABILITY & CONTROL</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          {runtimeIntel.map((f, i) => (
            <Reveal key={f.title} delay={i * 50}>
              <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl transition-all duration-300 h-full flex flex-col shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${f.accent}`}>{f.title.toUpperCase()}</span>
                  <f.icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed flex-1">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SECTION 5: BOUNDED WORKFLOW STEP TYPES MATRIX (#steptypes) */}
      <section id="steptypes" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 03. BOUNDED STEP TYPES MATRIX</span>
            <span>SUPPORTED WORKFLOW NODES</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          {boundedStepTypes.map((step, idx) => (
            <Reveal key={step.name} delay={idx * 50}>
              <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2.5 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl transition-all duration-300 h-full flex flex-col shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] px-2 py-0.5 rounded border font-semibold ${step.badgeColor}`}>
                    {step.badge}
                  </span>
                  <step.icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{step.title}</h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed flex-1">{step.desc}</p>
                <div className="pt-1 text-[10px] text-indigo-700 dark:text-indigo-300 font-mono">
                  <code>{step.name}</code>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SECTION 6: THE GRAPH-FIRST RUNTIME (#runtime) */}
      <section id="runtime" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 04. THE GRAPH-FIRST AGENT RUNTIME</span>
            <span>DETERMINISTIC EXECUTION ENGINE</span>
          </div>
        </Reveal>

        {/* Flow legend */}
        <Reveal delay={60}>
          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-nowrap pb-1">
            <span className="text-indigo-700 dark:text-indigo-300 font-bold">START</span>
            <span className="text-slate-400 dark:text-slate-600"> → </span>
            <span>planner</span>
            <span className="text-slate-400 dark:text-slate-600"> → </span>
            <span>permission</span>
            <span className="text-slate-400 dark:text-slate-600"> → </span>
            <span>tool_selection</span>
            <span className="text-slate-400 dark:text-slate-600"> ⇄ </span>
            <span>tool_execution</span>
            <span className="text-slate-400 dark:text-slate-600"> → </span>
            <span className="text-amber-700 dark:text-amber-300 font-bold">approval?</span>
            <span className="text-slate-400 dark:text-slate-600"> → </span>
            <span>finish</span>
            <span className="text-slate-400 dark:text-slate-600"> → </span>
            <span className="text-emerald-700 dark:text-emerald-300 font-bold">END</span>
          </div>
        </Reveal>

        {/* Node cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 font-mono">
          {runtimeNodes.map((node, i) => (
            <Reveal key={node.tag} delay={i * 60}>
              <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:-translate-y-1 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 h-full flex flex-col shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${node.accent}`}>
                    {node.tag}
                  </span>
                  <node.icon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400/70" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{node.title}</h3>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed flex-1">{node.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Execution trace panel & Decision Explainer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
          <Reveal delay={0}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-3 h-full shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all duration-300">
              <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 border-b border-slate-200 dark:border-indigo-950/60 pb-2 flex items-center gap-1.5 font-semibold">
                <Braces className="h-3.5 w-3.5" /> PERSISTED STEP TRACE & DECISION EXPLAINER
              </div>
              <div className="p-3.5 rounded bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-indigo-950/80 font-mono text-[11px] leading-relaxed overflow-x-auto text-slate-800 dark:text-slate-200">
                <pre className="whitespace-pre">
                  <span className="text-slate-500 dark:text-slate-400">&#123;</span>{"\n"}
                  {"  "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;status&quot;</span><span className="text-slate-500 dark:text-slate-400">: </span><span className="text-emerald-700 dark:text-emerald-400">&quot;COMPLETED&quot;</span><span className="text-slate-500 dark:text-slate-400">,</span>{"\n"}
                  {"  "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;step&quot;</span><span className="text-slate-500 dark:text-slate-400">: </span><span className="text-emerald-700 dark:text-emerald-400">&quot;deterministic_condition&quot;</span><span className="text-slate-500 dark:text-slate-400">,</span>{"\n"}
                  {"  "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;decisionExplanation&quot;</span><span className="text-slate-500 dark:text-slate-400">: </span><span className="text-emerald-700 dark:text-emerald-400">&quot;[DECISION PATH: TRUE_BRANCH] refundAmount (2500) exceeds threshold 1000&quot;</span><span className="text-slate-500 dark:text-slate-400">,</span>{"\n"}
                  {"  "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;recoveredSafeSteps&quot;</span><span className="text-slate-500 dark:text-slate-400">: </span><span className="text-amber-700 dark:text-amber-400">[&quot;step_1_input&quot;, &quot;step_2_extract&quot;]</span><span className="text-slate-500 dark:text-slate-400">,</span>{"\n"}
                  {"  "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;approvalLock&quot;</span><span className="text-slate-500 dark:text-slate-400">: </span><span className="text-emerald-700 dark:text-emerald-400">&quot;SINGLE_USE_TOKEN_CONSUMED&quot;</span>{"\n"}
                  <span className="text-slate-500 dark:text-slate-400">&#123;</span>
                </pre>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-3 h-full shadow-sm">
              <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 border-b border-slate-200 dark:border-indigo-950/60 pb-2 flex items-center gap-1.5 font-semibold">
                <Activity className="h-3.5 w-3.5" /> WHY CONTROLLED AGENTIC WORKFLOWS?
              </div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-400 font-serif space-y-3 leading-relaxed">
                <li>
                  <span className="text-slate-900 dark:text-slate-200 font-bold">1. Deterministic Step Boundaries.</span>{" "}
                  The LLM is bounded to specific extraction, classification, and planning tasks — execution paths and conditions remain fully deterministic.
                </li>
                <li>
                  <span className="text-slate-900 dark:text-slate-200 font-bold">2. Partial Step Recovery & Safe Retries.</span>{" "}
                  If Step 4 fails due to a temporary network hiccup, you recover directly from Step 4 without repeating completed safe steps (Steps 1–3).
                </li>
                <li>
                  <span className="text-slate-900 dark:text-slate-200 font-bold">3. Transparent Decision Explanations.</span>{" "}
                  Every routing choice and condition evaluation generates human-readable audit explanations for governance and compliance.
                </li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 7: DEVELOPER TOOLING & EDITING (#tooling) */}
      <section id="tooling" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 05. DEVELOPER TOOLING & EDITING</span>
            <span>BUILT FOR ENGINEERS</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          {devTooling.map((t, i) => (
            <Reveal key={t.title} delay={i * 50}>
              <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2.5 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl transition-all duration-300 h-full flex flex-col shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] px-2 py-0.5 rounded border font-semibold text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-black/40">
                    {t.title.toUpperCase()}
                  </span>
                  <t.icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed flex-1">{t.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SECTION 8: MCP MARKETPLACE ECOSYSTEM (#ecosystem) */}
      <section id="ecosystem" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span className="flex items-center gap-2">
              <McpProtocolLogo className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              // 06. MCP MARKETPLACE ECOSYSTEM
            </span>
            <span className="text-[10px] sm:text-xs">UNIFIED DISCOVERY FROM 5 REGISTRIES</span>
          </div>
        </Reveal>

        {/* Marketplace Source Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 font-mono">
          {/* Smithery.ai */}
          <Reveal delay={0}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-4 hover:-translate-y-1 hover:border-[#FF5601]/60 dark:hover:border-[#FF5601]/60 hover:shadow-xl hover:shadow-[#FF5601]/10 transition-all duration-300 h-full shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-[#FF5601]/10 dark:bg-[#FF5601]/15 border border-[#FF5601]/30 flex items-center justify-center p-1.5 shadow-sm shrink-0">
                      <SmitheryOfficialLogo className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                        SMITHERY.AI
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">registry.smithery.ai</div>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded border border-[#FF5601]/30 bg-[#FF5601]/10 text-[#FF5601] font-bold">PRIMARY</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-pixel text-[#FF5601]">10,263</span>
                    <span className="text-[10px] text-slate-500 uppercase">MCP Servers</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-pixel text-[#FF5601]">19,126+</span>
                    <span className="text-[10px] text-slate-500 uppercase">Agent Skills</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  The largest MCP registry with full tool schemas, quality scores, activation metrics, and category taxonomy. Every server includes detailed configuration, environment variables, and installation instructions.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {["DATABASES", "BROWSER", "SEARCH", "CLOUD", "DEV", "AI", "COMMUNICATION"].map((tag) => (
                  <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded border border-[#FF5601]/25 dark:border-[#FF5601]/30 text-[#FF5601] font-bold uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Glama.ai + awesome-mcp-servers */}
          <Reveal delay={80}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-4 hover:-translate-y-1 hover:border-sky-400 dark:hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/10 transition-all duration-300 h-full shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/30 flex items-center justify-center p-1.5 shadow-sm shrink-0 text-sky-600 dark:text-sky-400">
                      <GlamaOfficialLogo className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                        GLAMA + AWESOME-MCP
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">glama.ai &middot; punkpeye</div>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded border border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-bold">CURATED</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-pixel text-sky-700 dark:text-sky-300">100K+</span>
                    <span className="text-[10px] text-slate-500 uppercase">MCP Servers</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-pixel text-sky-700 dark:text-sky-300">500+</span>
                    <span className="text-[10px] text-slate-500 uppercase">Agent Skills</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Full Glama.ai directory (100K+ servers) plus awesome-mcp-servers community curation. Features verified, production-ready servers with README documentation, transport protocols, and community ratings.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {["VERIFIED", "COMMUNITY", "PRODUCTION-READY", "DOCUMENTED"].map((tag) => (
                  <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800/50 text-sky-600 dark:text-sky-400 font-bold uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* mcp.so */}
          <Reveal delay={160}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-4 hover:-translate-y-1 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 h-full shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex items-center justify-center p-1.5 shadow-sm shrink-0 text-amber-600 dark:text-amber-400">
                      <McpProtocolLogo className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                        MCP.SO
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">mcp.so &middot; community hub</div>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold">COMMUNITY</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-pixel text-amber-700 dark:text-amber-300">18,500+</span>
                    <span className="text-[10px] text-slate-500 uppercase">MCP Servers</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-pixel text-amber-700 dark:text-amber-300">150+</span>
                    <span className="text-[10px] text-slate-500 uppercase">Agent Skills</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Community-driven discovery platform with curated categories, trending servers, and popularity metrics. Features weekly picks, author profiles, and community-contributed server configurations.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {["TRENDING", "WEEKLY PICKS", "AUTHOR PROFILES", "COMMUNITY"].map((tag) => (
                  <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400 font-bold uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Composio */}
          <Reveal delay={200}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-4 hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 h-full shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center p-1 shadow-sm shrink-0">
                      <img src="https://composio.dev/logos/composio-black.svg" alt="Composio" className="h-6 w-6" data-logo-invert />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                        COMPOSIO
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">composio.dev &middot; managed auth</div>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold">MANAGED</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-pixel text-emerald-700 dark:text-emerald-300">1,000+</span>
                    <span className="text-[10px] text-slate-500 uppercase">Toolkits</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-pixel text-emerald-700 dark:text-emerald-300">100K+</span>
                    <span className="text-[10px] text-slate-500 uppercase">Agent Tools</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Pre-authenticated toolkits with managed OAuth for Gmail, Slack, GitHub, Stripe, Notion, and 1,000+ more. Zero auth setup — connect instantly with one click.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {["MANAGED OAUTH", "1-CLICK AUTH", "SANDBOX", "PARALLEL"].map((tag) => (
                  <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Arcade */}
          <Reveal delay={280}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-4 hover:-translate-y-1 hover:border-rose-400 dark:hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-500/10 transition-all duration-300 h-full shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30 flex items-center justify-center p-1 shadow-sm shrink-0">
                      <img src="https://www.arcade.dev/favicon.svg" alt="Arcade" className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                        ARCADE
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">arcade.dev &middot; MCP runtime</div>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold">ENTERPRISE</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-pixel text-rose-700 dark:text-rose-300">7,500+</span>
                    <span className="text-[10px] text-slate-500 uppercase">Agent Tools</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-pixel text-rose-700 dark:text-rose-300">81</span>
                    <span className="text-[10px] text-slate-500 uppercase">MCP Servers</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Enterprise MCP runtime with agent-optimized tools, per-action authorization, governance, and audit logs. Self-hosted or cloud deployment.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {["AGENT AUTH", "GOVERNANCE", "AUDIT LOGS", "SELF-HOST"].map((tag) => (
                  <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 font-bold uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Combined Stats & Capabilities */}
        <Reveal delay={200}>
          <div className="p-5 sm:p-6 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-4 font-mono shadow-sm">
            <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 border-b border-slate-200 dark:border-indigo-950/60 pb-3 flex flex-wrap items-center justify-between gap-2 font-semibold">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> UNIFIED MARKETPLACE CAPABILITIES
              </span>
              <span className="text-[10px] text-slate-500 font-mono">ACROSS ALL 5 REGISTRIES</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-4 rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all duration-300">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">01.</span> Auto-Quality Scoring
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Every server is scored on 6 dimensions — Schema Quality, Latency, Uptime, Documentation, Maintenance, Community — and graded A+ to F.
                </p>
              </div>

              <div className="p-4 rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-all duration-300">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">02.</span> 1-Click Install
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Mount any server or skill with a single click. Environment variables, transport config, and tool schemas are auto-detected and prefilled.
                </p>
              </div>

              <div className="p-4 rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-violet-400 dark:hover:border-violet-500/50 transition-all duration-300">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-violet-600 dark:text-violet-400 font-mono font-bold">03.</span> Server Composition
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Chain multiple MCP servers into "mega-tools" — combine Database + Search + Browser into a single reusable workflow composition.
                </p>
              </div>

              <div className="p-4 rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-sky-400 dark:hover:border-sky-500/50 transition-all duration-300">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-sky-600 dark:text-sky-400 font-mono font-bold">04.</span> Cross-Registry Search
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Search across all 136,500+ servers, toolkits, and tools simultaneously with unified filters for category, transport, auth type, and source.
                </p>
              </div>
            </div>

            {/* Source Aggregation Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-200 dark:border-indigo-950/60">
              <div className="text-center p-3 rounded bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/30">
                <div className="text-xl font-pixel text-violet-700 dark:text-violet-300">136,500+</div>
                <div className="text-[9px] text-violet-600 dark:text-violet-400 font-bold uppercase tracking-wider">Total MCP Servers</div>
              </div>
              <div className="text-center p-3 rounded bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-800/30">
                <div className="text-xl font-pixel text-sky-700 dark:text-sky-300">19,476+</div>
                <div className="text-[9px] text-sky-600 dark:text-sky-400 font-bold uppercase tracking-wider">Total Agent Skills</div>
              </div>
              <div className="text-center p-3 rounded bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30">
                <div className="text-xl font-pixel text-amber-700 dark:text-amber-300">5</div>
                <div className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Unified Registries</div>
              </div>
              <div className="text-center p-3 rounded bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30">
                <div className="text-xl font-pixel text-emerald-700 dark:text-emerald-300">LIVE</div>
                <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Real-Time Sync</div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* SECTION 9: CORE SAAS PILLARS (#features) */}
      <section id="features" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 07. CORE PLATFORM CAPABILITIES</span>
            <span>ENTERPRISE GUARANTEES</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono">
          {/* Pillar 1 */}
          <Reveal delay={0}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 h-full shadow-sm">
              <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-xs">
                <span className="font-pixel text-sm">01. BOUNDED STEP LIFECYCLE</span>
                <Workflow className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">8 Supported Step Types</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                Connect structured inputs, doc search, AI extraction, classification, deterministic conditions, HITL approvals, mock actions, and final report generators.
              </p>
            </div>
          </Reveal>

          {/* Pillar 2 */}
          <Reveal delay={80}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 h-full shadow-sm">
              <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-xs">
                <span className="font-pixel text-sm">02. PATH DECISION EXPLAINER</span>
                <GitBranch className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Auditable Branching Rationale</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                Every condition evaluation and classification node outputs an explicit decision reason explaining why a branch was taken or rejected.
              </p>
            </div>
          </Reveal>

          {/* Pillar 3 */}
          <Reveal delay={160}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 h-full shadow-sm">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs">
                <span className="font-pixel text-sm">03. SAFE STEP RECOVERY</span>
                <RefreshCw className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Partial Retry & Checkpoint Recovery</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                Recover failed workflow executions without repeating completed safe steps. The engine skips idempotent steps and resumes from the failure point.
              </p>
            </div>
          </Reveal>

          {/* Pillar 4 */}
          <Reveal delay={240}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-amber-400 dark:hover:border-amber-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 h-full shadow-sm">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs">
                <span className="font-pixel text-sm">04. HUMAN-IN-THE-LOOP (HITL)</span>
                <CheckSquare className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Single-Use Idempotency Approval Locks</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                Write actions automatically pause execution into a pending queue. Single-use tokens guarantee an approved action can never execute twice.
              </p>
            </div>
          </Reveal>

          {/* Pillar 5 */}
          <Reveal delay={320}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 h-full shadow-sm">
              <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-xs">
                <span className="font-pixel text-sm">05. VERSIONING & DIFF ENGINE</span>
                <GitCompare className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Draft & Published Version Control</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                Publish drafts into immutable numeric versions (v1, v2, v3). Replay previous runs or test earlier versions with sample inputs seamlessly.
              </p>
            </div>
          </Reveal>

          {/* Pillar 6 */}
          <Reveal delay={400}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-cyan-400 dark:hover:border-cyan-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 h-full shadow-sm">
              <div className="flex items-center justify-between text-cyan-700 dark:text-cyan-400 text-xs">
                <span className="font-pixel text-sm">06. LLM AUTO-FAILOVER</span>
                <RefreshCw className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Multi-Provider Router with Circuit Breakers</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                12 free models across Groq and OpenRouter are tried in order with adaptive cooldowns (429 → 60s, 5xx → 30s, 404 → 10min, bad key → vendor park).
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 9: SECURITY & GUARDRAILS (#guardrails) */}
      <section id="guardrails" className="p-5 sm:p-8 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-[#0a0a0a]/90 space-y-6 font-mono shadow-md">
        <Reveal>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950 pb-4 text-xs">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-pixel text-sm">07. ENTERPRISE SECURITY & GOVERNANCE</span>
            </div>
            <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">[ ZERO TRUST RUNTIME ]</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <Reveal delay={0}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Single-Use Idempotency Tokens
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Every approved write action generates a single-use token, enforced atomically in the database — replays and concurrent duplicates are blocked.
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Multi-Tenant Isolation
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Strict PostgreSQL tenant boundaries isolate skills, versions, executions, and approval records per user account.
              </p>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Hard Execution Step Limits
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Enforces maximum step boundaries (e.g. 10 steps) to prevent infinite loops, runaway API costs, and resource leaks.
              </p>
            </div>
          </Reveal>

          <Reveal delay={300}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-cyan-400 dark:hover:border-cyan-500/50 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> LLM Circuit Breakers
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                A single model failure never fails a run — the router parks it in an adaptive cooldown and transparently moves on to the next.
              </p>
            </div>
          </Reveal>

          <Reveal delay={400}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Atomic Database Writes
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Skill creation, draft rotation, publish, and execution persistence commit in single transactions — a crash can never orphan data.
              </p>
            </div>
          </Reveal>

          <Reveal delay={500}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Full Audit Trails
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Every mutation writes a structured log and an audit row (SKILL_PUBLISHED, APPROVAL_GRANTED, RECOVERY_STARTED, …) traced back to the acting user.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 10: FREQUENTLY ASKED QUESTIONS (#faq) */}
      <section id="faq" className="space-y-6 pt-4 font-mono">
        <Reveal>
          <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 09. FREQUENTLY ASKED QUESTIONS</span>
            <span>FAQ & DETAILS</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 text-xs">
          {faqExtra.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> {f.q}
                </h4>
                <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">{f.a}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SECTION 11: BOTTOM CTA & FOOTER */}
      <section className="text-center space-y-6 pt-6 border-t border-slate-200 dark:border-indigo-950/80 font-mono">
        <Reveal delay={0}>
          <div className="text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest font-semibold">
            READY TO ORCHESTRATE MULTI-AGENT WORKFLOWS AT SCALE?
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="text-2xl sm:text-4xl font-pixel text-pixel-glow uppercase">
            ENTER AGENT STUDIO TODAY
          </h2>
        </Reveal>

        <Reveal delay={200}>
          <div className="flex justify-center gap-4 pt-2">
            <FooterAuthCTA />
          </div>
        </Reveal>

        <footer className="pt-10 sm:pt-12 text-xs text-slate-600 dark:text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-indigo-950/60">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-pixel text-pixel-glow tracking-wide">AGENT STUDIO</span>
            <span>© 2026. All Systems Operational.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-slate-600 dark:text-slate-400 text-[11px] sm:text-xs">
            <a href="#canvas" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Canvas</a>
            <a href="#runtime-intel" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Runtime Intel</a>
            <a href="#steptypes" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Step Types</a>
            <a href="#runtime" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Runtime</a>
            <a href="#tooling" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Tooling</a>
            <a href="#ecosystem" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Ecosystem</a>
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Features</a>
            <a href="#guardrails" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Guardrails</a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">FAQ</a>
            <Link href="/dashboard" className="hover:text-indigo-600 dark:hover:text-indigo-300 font-bold text-indigo-700 dark:text-indigo-400 transition-colors">App</Link>
          </div>
        </footer>
      </section>

      {/* Floating Bottom-Right Portfolio Circle Trigger (Visible on Scroll) */}
      <FooterPortfolioWidget />
    </div>
  );
}
