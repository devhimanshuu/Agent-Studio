import React from "react";
import Link from "next/link";
import {
  Check,
  GitCompare,
  Lock,
  ShieldCheck,
  Database,
  Zap,
  HelpCircle,
  ChevronDown,
  RefreshCw,
  Braces,
  Activity,
  Search,
  Workflow,
  Cpu,
  Layers,
  Boxes,
  Eye,
  Gauge,
  TimerReset,
  Wallet,
  MousePointerClick,
  LayoutTemplate,
  Palette,
  Link2,
  Network,
  Globe,
  Package,
  Sparkles,
  HardDrive,
  FileCheck,
  BrainCircuit,
  Terminal,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Reveal } from "@/components/Reveal";

import {
  N8nOfficialLogo,
  DifyOfficialLogo,
  SmitheryOfficialLogo,
} from "@/components/common/BrandLogos";
import { canvasNodeCategories } from "@/components/landing/data/canvasNodes";

// Lazy-loaded client components for fast initial server rendering
const LiveAgentCanvasDemo = dynamic(() => import("@/components/landing/LiveAgentCanvasDemo").then((m) => m.LiveAgentCanvasDemo));
const PixelGridWave = dynamic(() => import("@/components/landing/PixelGridWave").then((m) => m.PixelGridWave));
const NeuralPatterns = dynamic(() => import("@/components/landing/NeuralPatterns").then((m) => m.NeuralPatterns));
const FooterPortfolioWidget = dynamic(() => import("@/components/landing/FooterPortfolioWidget").then((m) => m.FooterPortfolioWidget));
const HeroAuthSection = dynamic(() => import("@/components/landing/HeroAuthSection").then((m) => m.HeroAuthSection));
const FooterAuthCTA = dynamic(() => import("@/components/landing/HeroAuthSection").then((m) => m.FooterAuthCTA));

// ────────────── Open Source Flagship Pillars ──────────────
const openSourcePillars = [
  {
    title: "SearXNG Metasearch",
    badge: "100% FREE SEARCH",
    icon: Search,
    color: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/30",
    desc: "Privacy-first metasearch querying Google, Bing, Reddit, DuckDuckGo and ArXiv concurrently with zero API keys or rate-limit paywalls.",
    useCase: "Autonomous research, live news monitoring, fact-checking, CVE vulnerability discovery.",
  },
  {
    title: "Crawl4AI Web Scraper",
    badge: "AI-NATIVE MARKDOWN",
    icon: Sparkles,
    color: "text-teal-600 dark:text-teal-400 border-teal-500/30 bg-teal-50/70 dark:bg-teal-950/30",
    desc: "Blazing fast open-source crawler that extracts clean, structured markdown with noise/ad removal and token-efficient formatting.",
    useCase: "Deep web extraction, documentation ingestion, competitive pricing intelligence.",
  },
  {
    title: "IBM Docling Parser",
    badge: "PDF & TABLE OCR",
    icon: FileCheck,
    color: "text-sky-600 dark:text-sky-400 border-sky-500/30 bg-sky-50/70 dark:bg-sky-950/30",
    desc: "Enterprise document parsing engine by IBM Research that turns complex research PDFs, multi-column papers, and tables into markdown.",
    useCase: "Scientific paper analysis, financial report extraction, compliance PDF audits.",
  },
  {
    title: "Gotenberg PDF Exporter",
    badge: "STATELESS PDF ENGINE",
    icon: HardDrive,
    color: "text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-50/70 dark:bg-blue-950/30",
    desc: "Stateless microservice that renders agent-generated Markdown, HTML, and LaTeX into publication-ready PDF documents on demand.",
    useCase: "Executive memos, automated client invoices, weekly research dossiers.",
  },
  {
    title: "Qdrant Vector Memory",
    badge: "OPEN-SOURCE RAG",
    icon: BrainCircuit,
    color: "text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-50/70 dark:bg-purple-950/30",
    desc: "High-performance vector similarity search engine powering long-term conversational memory and semantic knowledge retrieval.",
    useCase: "Episodic agent memory, large knowledge base lookup, contextual grounded reasoning.",
  },
  {
    title: "PocketBase & NocoDB",
    badge: "OPEN STATE DB",
    icon: Database,
    color: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/30",
    desc: "PocketBase provides single-file SQLite state persistence; NocoDB provides smart relational Airtable-style spreadsheet APIs.",
    useCase: "Execution checkpoint logs, lead database sync, structured audit registers.",
  },
];

// ────────────── Comparison Matrix ──────────────
const comparisonRows = [
  {
    feature: "Multi-Agent Supervisor & Critic Loops",
    studio: "Native Visual Canvas (Drag-and-Drop)",
    n8n: "Linear DAG only (No multi-agent loops)",
    dify: "Limited multi-agent (Primarily single agent)",
    langflow: "Complex low-level code nodes",
  },
  {
    feature: "Zero-Key Open-Source Tools Built-in",
    studio: "SearXNG, Crawl4AI, Docling, Gotenberg, Qdrant",
    n8n: "Requires paid external API keys",
    dify: "Limited built-in tools",
    langflow: "Manual Python wrapper coding required",
  },
  {
    feature: "Template Ecosystem Compatibility",
    studio: "11.6k+ n8n + 290+ Dify + 136k+ MCP",
    n8n: "n8n only",
    dify: "Dify only",
    langflow: "Langflow only",
  },
  {
    feature: "Model Context Protocol (MCP) Hub",
    studio: "Full Client & Server (136k+ servers)",
    n8n: "Community node add-ons only",
    dify: "No native MCP protocol support",
    langflow: "Custom tool scripts only",
  },
  {
    feature: "HITL Write Locks & Idempotency",
    studio: "Single-Use Database Tokens & Explainer",
    n8n: "Generic webhook wait (No idempotency lock)",
    dify: "Basic user input pause",
    langflow: "No native human approval lock",
  },
  {
    feature: "Real-Time Observability & Heatmaps",
    studio: "Live SSE Glow + Latency Heatmap + Replay",
    n8n: "Static step logs after completion",
    dify: "Basic streaming logs",
    langflow: "Text console output",
  },
  {
    feature: "Free LLM Auto-Failover Router",
    studio: "28+ Free Models across 8 Tiers with Auto-Routing",
    n8n: "Single API key failure terminates run",
    dify: "Manual fallback provider config",
    langflow: "Manual exception handling in Python",
  },
];

// ────────────── LLM Engine Numerical Breakdown ──────────────
const llmEngineMetrics = [
  {
    value: "28+",
    label: "FREE PRODUCTION MODELS",
    detail: "Zero-cost multi-provider catalog with automated circuit-breaker failover",
    badge: "100% FREE",
    accent: "text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/30",
  },
  {
    value: "512K",
    label: "MAX CONTEXT TOKENS",
    detail: "Deep document ingestion and long-chain execution traces per prompt",
    badge: "LONG CONTEXT",
    accent: "text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-50/70 dark:bg-purple-950/30",
  },
  {
    value: "750 t/s",
    label: "PEAK GENERATION SPEED",
    detail: "Ultra-fast streaming for real-time agent loops & supervisor routing decisions",
    badge: "LIGHTNING FAST",
    accent: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/30",
  },
  {
    value: "8",
    label: "SPECIALIZED AI DOMAINS",
    detail: "Reasoning, code, vision OCR, embeddings, TTS, audio & safety guardrails",
    badge: "FULL SPECTRUM",
    accent: "text-sky-600 dark:text-sky-400 border-sky-500/30 bg-sky-50/70 dark:bg-sky-950/30",
  },
  {
    value: "< 300ms",
    label: "SUB-SECOND TTFT LATENCY",
    detail: "Near-zero initial turn delay for interactive, responsive agent loops",
    badge: "LOW LATENCY",
    accent: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/30",
  },
  {
    value: "$0.00",
    label: "TOKEN EXPENSE PER CALL",
    detail: "Automatic fallback to free tiers with zero subscription or billing risk",
    badge: "$0 FOREVER",
    accent: "text-teal-600 dark:text-teal-400 border-teal-500/30 bg-teal-50/70 dark:bg-teal-950/30",
  },
];

const modelCategoryCounts = [
  { category: "REASONING & SUPERVISOR", count: "6 MODELS", specs: "Up to 262k context · Multi-step logic & self-reflection loops", color: "text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-500/30 bg-purple-50/60 dark:bg-purple-950/20" },
  { category: "CODE SYNTHESIS & SCRIPTING", count: "4 MODELS", specs: "256k context · TypeScript, Python, JSON schema & SQL", color: "text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-950/20" },
  { category: "HIGH-THROUGHPUT DISPATCH", count: "5 MODELS", specs: "Up to 750 t/s · Ultra-fast edge routing & triage turns", color: "text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20" },
  { category: "VISION & MULTIMODAL OCR", count: "3 MODELS", specs: "128k context · UI screenshots, diagrams, papers & charts", color: "text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-500/30 bg-sky-50/60 dark:bg-sky-950/20" },
  { category: "VECTOR EMBEDDING & MEMORY", count: "4 MODELS", specs: "Dense semantic embeddings for Qdrant long-term memory", color: "text-teal-600 dark:text-teal-400 border-teal-300 dark:border-teal-500/30 bg-teal-50/60 dark:bg-teal-950/20" },
  { category: "VOICE, AUDIO & SPEECH AI", count: "3 MODELS", specs: "Streaming STT transcription & natural neural TTS synthesis", color: "text-pink-600 dark:text-pink-400 border-pink-300 dark:border-pink-500/30 bg-pink-50/60 dark:bg-pink-950/20" },
  { category: "CONTENT SAFETY & GUARDRAILS", count: "2 MODELS", specs: "Sub-260ms policy enforcement & output validation gates", color: "text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20" },
  { category: "DYNAMIC AUTO-FREE ROUTER", count: "1 DYNAMIC", specs: "openrouter/free dynamically routes to the healthiest capacity", color: "text-cyan-600 dark:text-cyan-400 border-cyan-300 dark:border-cyan-500/30 bg-cyan-50/60 dark:bg-cyan-950/20" },
];

// ────────────── Developer Tooling ──────────────
const devTooling = [
  {
    icon: Network,
    title: "136,500+ MCP Servers & Skills",
    desc: "Connect remote SSE and stdio Model Context Protocol servers (GitHub, Postgres, Slack, Brave) or expose Agent Studio workflows as MCP tools to Cursor & Claude.",
  },
  {
    icon: Workflow,
    title: "11,600+ n8n Workflow Library",
    desc: "Browse and import community n8n workflows directly into visual Agent Studio graphs with automatic node and parameter translation.",
  },
  {
    icon: Sparkles,
    title: "290+ Dify.ai AI Blueprints",
    desc: "Import Dify.ai DSL YAML and workflow templates directly into multi-agent canvas graphs with 1-click execution.",
  },
  {
    icon: Globe,
    title: "2,500+ OpenAPI & REST Tool Hub",
    desc: "Browse public APIs (Google, Stripe, Azure, AWS, GitHub) from APIs.guru, install 1-click free tool packs, or import any Swagger/OpenAPI URL.",
  },
  {
    icon: LayoutTemplate,
    title: "Auto-Layout & Snap Grid",
    desc: "One click runs layered BFS auto-layout over any hand-built graph, with snap-to-grid guides so complex multi-agent designs stay immaculate.",
  },
  {
    icon: Braces,
    title: "Monaco Prompt Editor & AI Optimizer",
    desc: "Monaco prompt editor with {{ results.node.field }} autocomplete, live token-count feedback, and 1-click AI prompt prompt engineering.",
  },
  {
    icon: GitCompare,
    title: "Visual Version Diffing",
    desc: "Side-by-side visual diff of two graph versions — nodes added/removed, edges rerouted — with instant one-click rollback.",
  },
  {
    icon: Boxes,
    title: "Sub-Graphs & Macros",
    desc: "Collapse any complex agent branch into a reusable component node with typed inputs and outputs — nest graphs up to 8 levels deep.",
  },
  {
    icon: Palette,
    title: "Persisted Canvas Themes",
    desc: "Neon/cyberpunk default, graphite minimal, and high-contrast themes — persisted per user with full responsive dark-mode support.",
  },
  {
    icon: Link2,
    title: "Shareable Read-Only Snapshots",
    desc: "Render any graph and its live trace as an embeddable, read-only snapshot link — perfect for documentation, PR reviews, or Slack.",
  },
  {
    icon: Terminal,
    title: "Deterministic Step Replay",
    desc: "Persist every step response and replay past executions with exact recorded outputs for non-LLM nodes to quickly debug logic branches.",
  },
  {
    icon: Eye,
    title: "Ghost-Mode Dry-Run Preview",
    desc: "Run the interpreter in fast-forward dry-run against live state — nodes illuminate showing exactly what would happen with zero token spend.",
  },
];

// ────────────── FAQ Items ──────────────
const faqItems = [
  {
    q: "How does the Open-Source & Zero-Key Stack work?",
    a: "Agent Studio embeds native connectors for SearXNG (privacy metasearch), Crawl4AI (LLM-friendly scraper), IBM Docling (PDF/table parser), Gotenberg (PDF exporter), Qdrant (vector database), and PocketBase/NocoDB (SQLite & Airtable). These tools can run against public instances with zero API keys or against your self-hosted Docker containers with zero subscription costs.",
  },
  {
    q: "How do n8n and Dify.ai workflow imports work?",
    a: "Agent Studio includes universal converters in /lib/converters that translate n8n JSON nodes and Dify DSL YAML workflows into native Agent Studio visual graph nodes. You can browse over 11,600 n8n workflows and 290 Dify blueprints in our Unified Marketplace and launch them with 1 click.",
  },
  {
    q: "How does Model Context Protocol (MCP) integration work?",
    a: "Agent Studio is a full dual-mode MCP Client and MCP Server. As a client, it searches 136,500+ MCP servers across Smithery, Glama, Composio, Arcade, and mcp.so and mounts them into agent graphs. As a server, external IDEs like Cursor and Claude Desktop can call your published workflows via /api/mcp/sse.",
  },
  {
    q: "What makes Agent Studio different from Langflow, Flowise, or n8n?",
    a: "Unlike traditional ETL tools that only execute linear DAGs, Agent Studio is designed specifically for autonomous Multi-Agent orchestration — supporting supervisor loops, critic reflection, map-reduce fan-out, human-in-the-loop idempotency tokens, and real-time SSE execution telemetry.",
  },
  {
    q: "How does the 28+ Free Model Failover Router protect my runs?",
    a: "Every LLM step routes through a resilient circuit-breaker router supporting 28+ free models across OpenRouter and Groq spanning 8 specialization domains. With context windows up to 512k tokens and speeds up to 750 t/s, if any model hits a rate limit (429) or outage (5xx), the router seamlessly quarantines it and falls over to the next healthy model with $0 token expense.",
  },
  {
    q: "How do Human-in-the-Loop (HITL) write locks guarantee safety?",
    a: "Whenever an agent reaches an approval node (e.g. before spending money, modifying a database, or sending emails), the execution is paused in PAUSED_FOR_APPROVAL. An atomic single-use cryptographic token is generated in PostgreSQL — guaranteeing the action cannot be dispatched twice.",
  },
];

export default function LandingPage() {
  return (
    <div className="space-y-16 sm:space-y-24 px-4 sm:px-6 lg:px-10 pt-0">
      {/* SECTION 1: HERO SECTION & INTERACTIVE TERMINAL */}
      <section className="relative overflow-hidden border-b border-indigo-200/80 dark:border-indigo-950/80 -mx-4 sm:-mx-6 lg:-mx-10 -mt-0 bg-gradient-to-b from-indigo-50/80 via-slate-50/40 to-transparent dark:from-transparent">
        {/* Animated Background Layers */}
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
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 dark:bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
              </span>
              <span className="truncate font-semibold">
                Open-Source AI Stack · 11.6k+ n8n & 290+ Dify Workflows · 136k+ MCP Tools · 28+ Visual Nodes
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1
            className="glitch animate-fadeInUp text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-pixel uppercase tracking-tight leading-tight max-w-5xl text-slate-900 dark:text-slate-100 break-words"
            style={{ animationDelay: "100ms" }}
            data-text="VISUAL MULTI-AGENT ORCHESTRATION STUDIO"
          >
            VISUAL <span className="text-gradient-glow">MULTI-AGENT ORCHESTRATION </span>STUDIO
          </h1>

          {/* Subhead */}
          <div
            className="animate-fadeInUp space-y-3 max-w-3xl font-mono-tech"
            style={{ animationDelay: "200ms" }}
          >
            <p className="text-lg sm:text-2xl text-slate-900 dark:text-slate-100 font-medium leading-snug tracking-tight font-sans">
              Architect, simulate, and deploy{" "}
              <span className="text-gradient-glow font-semibold">autonomous multi-agent graphs</span> powered by 100% free open-source microservices, Model Context Protocol (MCP) toolkits, and human-in-the-loop governance.
            </p>
            <p className="text-xs sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-mono-tech">
              Wire <span className="text-indigo-700 dark:text-indigo-300 font-semibold">Supervisor → Specialist → Critic loops</span> with{" "}
              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">SearXNG, Crawl4AI, IBM Docling, Qdrant & Gotenberg</span>, import 11,600+ n8n workflows, watch runs pulse in real time, and protect sensitive actions with{" "}
              <span className="text-amber-700 dark:text-amber-300 font-semibold">single-use approval locks</span>.
            </p>
          </div>

          <HeroAuthSection />

          {/* Trust Guarantees Strip */}
          <div className="animate-fadeInUp pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-mono text-slate-600 dark:text-slate-400" style={{ animationDelay: "350ms" }}>
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
              <Check className="h-3.5 w-3.5" /> 100% Zero-Key Public APIs
            </span>
            <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-semibold">
              <Check className="h-3.5 w-3.5" /> Open-Source Self-Hostable
            </span>
            <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 font-semibold">
              <Check className="h-3.5 w-3.5" /> 11.6k+ n8n & 290+ Dify Library
            </span>
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
              <Check className="h-3.5 w-3.5" /> Idempotent Single-Use Tokens
            </span>
            <span className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400 font-semibold">
              <Check className="h-3.5 w-3.5" /> 28+ Free LLM Models (OpenRouter & Groq)
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
            <div className="text-2xl sm:text-3xl font-pixel text-slate-900 dark:text-slate-100">28+</div>
            <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold">Native Canvas Node Types</div>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300">
            <div className="text-2xl sm:text-3xl font-pixel text-slate-900 dark:text-slate-100">148K+</div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">MCP, n8n & Dify Ecosystem Tools</div>
          </div>
        </Reveal>
        <Reveal delay={160}>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300">
            <div className="text-2xl sm:text-3xl font-pixel text-slate-900 dark:text-slate-100">100%</div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">Zero-Key Free & Self-Hosted Stack</div>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-cyan-400 dark:hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300">
            <div className="text-2xl sm:text-3xl font-pixel text-slate-900 dark:text-slate-100">28+ FREE</div>
            <div className="text-[11px] text-cyan-700 dark:text-cyan-300 font-semibold">Multi-Provider LLM Models (512k Ctx)</div>
          </div>
        </Reveal>
      </section>

      {/* SECTION 3: THE VISUAL MULTI-AGENT CANVAS (#canvas) */}
      <section id="canvas" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 01. THE VISUAL MULTI-AGENT CANVAS</span>
            <span>REACT FLOW · MULTI-AGENT ORCHESTRATOR</span>
          </div>
        </Reveal>

        <Reveal delay={0}>
          <LiveAgentCanvasDemo />
        </Reveal>

        {/* Canvas feature bullets & node types */}
        <Reveal delay={100}>
          <div className="p-5 sm:p-6 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-6 font-mono shadow-sm">
            <div className="text-xs font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 border-b border-slate-200 dark:border-indigo-950/60 pb-3 flex flex-wrap items-center justify-between gap-2 font-semibold">
              <span className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> DESIGN, SIMULATE & EXECUTE ON ONE CANVAS
              </span>
              <span className="text-[10px] text-slate-500 font-mono">28+ PRODUCTION NODE TYPES</span>
            </div>

            {/* Category Groups */}
            <div className="space-y-4">
              {canvasNodeCategories.map((cat) => (
                <div key={cat.category} className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    {cat.category}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {cat.nodes.map((n) => (
                      <div
                        key={n.name}
                        className={`p-2.5 rounded border text-xs flex items-start gap-2.5 transition-all duration-200 hover:scale-[1.02] shadow-sm ${n.cls}`}
                      >
                        <n.icon className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-[11px] truncate">{n.name}</span>
                            <span className="text-[7.5px] px-1 py-0.2 rounded border uppercase font-mono font-bold tracking-tight opacity-90 shrink-0">
                              {n.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
                            {n.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* SECTION 4: THE OPEN SOURCE & ZERO-KEY AI STACK (#opensource) */}
      <section id="opensource" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-emerald-700 dark:text-emerald-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-emerald-950/80 pb-3 font-semibold">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              // 02. THE OPEN-SOURCE & ZERO-KEY AI STACK
            </span>
            <span className="text-[10px] sm:text-xs">SELF-HOSTABLE · ZERO SUBSCRIPTIONS</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono">
          {openSourcePillars.map((p, idx) => (
            <Reveal key={p.title} delay={idx * 60}>
              <div className="p-6 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-4 hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 h-full flex flex-col justify-between shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg border ${p.color}`}>
                        <p.icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{p.title}</h3>
                    </div>
                    <span className="text-[8px] px-2 py-0.5 rounded border font-mono font-bold tracking-tight text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40">
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                    {p.desc}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-indigo-950/60 text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">Best For: </span>
                  {p.useCase}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SECTION 5: UNIFIED WORKFLOW MARKETPLACE (#marketplace) */}
      <section id="marketplace" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              // 03. UNIFIED MARKETPLACE & TEMPLATE HUB
            </span>
            <span className="text-[10px] sm:text-xs">11.6K+ N8N · 290+ DIFY · 136K+ MCP</span>
          </div>
        </Reveal>

        {/* 3 Core Marketplace Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
          {/* n8n Workflows */}
          <Reveal delay={0}>
            <div className="p-6 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-4 hover:-translate-y-1 hover:border-[#EA4B71] hover:shadow-xl transition-all duration-300 h-full shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-[#EA4B71]/10 border border-[#EA4B71]/30 flex items-center justify-center p-1.5 shadow-sm shrink-0">
                      <N8nOfficialLogo className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                        n8n Community Library
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">api.n8n.io &middot; 1-click import</div>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded border border-[#EA4B71]/30 bg-[#EA4B71]/10 text-[#EA4B71] font-bold">11,600+ FLOWS</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Direct live access to the entire n8n template registry. Search by apps, triggers, and automations. Agent Studio automatically parses n8n JSON nodes and wires them onto the visual multi-agent canvas.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {["SALESFORCE", "HUBSPOT", "STRIPE", "POSTGRES", "NOTION", "AIRTABLE"].map((tag) => (
                  <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded border border-[#EA4B71]/25 text-[#EA4B71] font-bold uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Dify.ai Blueprints */}
          <Reveal delay={80}>
            <div className="p-6 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-4 hover:-translate-y-1 hover:border-[#155EEF] hover:shadow-xl transition-all duration-300 h-full shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-[#155EEF]/10 border border-[#155EEF]/30 flex items-center justify-center p-1.5 shadow-sm shrink-0">
                      <DifyOfficialLogo className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                        Dify.ai Workflows
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">marketplace.dify.ai &middot; DSL converter</div>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded border border-[#155EEF]/30 bg-[#155EEF]/10 text-[#155EEF] font-bold">290+ BLUEPRINTS</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Import multi-step LLM chains, agent loops, and RAG knowledge pipelines created for Dify.ai. Our universal converter translates Dify DSL YAML files into Agent Studio graphs with live execution.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {["RAG PIPELINES", "CHATBOTS", "CODE GEN", "TRANSLATION", "INTEL"].map((tag) => (
                  <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded border border-[#155EEF]/25 text-[#155EEF] font-bold uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Model Context Protocol */}
          <Reveal delay={160}>
            <div className="p-6 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-4 hover:-translate-y-1 hover:border-[#FF5601] hover:shadow-xl transition-all duration-300 h-full shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-[#FF5601]/10 border border-[#FF5601]/30 flex items-center justify-center p-1 shadow-sm">
                      <SmitheryOfficialLogo className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">MCP Multi-Registry Hub</div>
                      <div className="text-[9px] text-slate-500 font-mono">5 registries &middot; SSE & stdio</div>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded border border-[#FF5601]/30 bg-[#FF5601]/10 text-[#FF5601] font-bold">136,500+ SERVERS</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                  Unified discovery across Smithery.ai, Glama.ai, Composio, Arcade, and mcp.so. Mount remote MCP tools, inspect parameter schemas, and connect Cursor/Claude as clients.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {["SMITHERY", "GLAMA", "COMPOSIO", "ARCADE", "MCP.SO"].map((tag) => (
                  <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded border border-[#FF5601]/25 text-[#FF5601] font-bold uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 6: MULTI-PROVIDER FREE LLM ENGINE (#models) */}
      <section id="models" className="space-y-8 pt-4 font-mono">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-cyan-700 dark:text-cyan-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
              // 04. MULTI-PROVIDER FREE LLM ENGINE
            </span>
            <span className="text-[10px] sm:text-xs">28+ FREE MODELS · 512K CONTEXT · 750 T/S · 8 SPECIALIZATIONS</span>
          </div>
        </Reveal>

        {/* 6 Core Metric Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {llmEngineMetrics.map((m, idx) => (
            <Reveal key={m.label} delay={idx * 50}>
              <div className="p-5 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:-translate-y-1 hover:border-cyan-400 dark:hover:border-cyan-500/50 hover:shadow-xl transition-all duration-300 h-full flex flex-col justify-between shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl sm:text-3xl font-pixel text-slate-900 dark:text-slate-100">{m.value}</span>
                    <span className={`text-[8px] px-2 py-0.5 rounded border font-mono font-bold tracking-tight ${m.accent}`}>
                      {m.badge}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    {m.label}
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed pt-1 border-t border-slate-100 dark:border-indigo-950/50">
                  {m.detail}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* 8 Specialization Domains Matrix */}
        <Reveal delay={100}>
          <div className="p-5 sm:p-6 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-indigo-950/60 pb-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                NUMERICAL BREAKDOWN BY CAPABILITY DOMAIN
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                ● AUTOMATIC CIRCUIT-BREAKER COOLDOWN (30S TRANSIENT · 60S 429)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {modelCategoryCounts.map((cat) => (
                <div
                  key={cat.category}
                  className={`p-3 rounded border space-y-1.5 shadow-2xs transition-all ${cat.color}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold tracking-wide truncate">{cat.category}</span>
                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 shrink-0">
                      {cat.count}
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-600 dark:text-slate-400 font-sans leading-tight">
                    {cat.specs}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* SECTION 7: COMPETITIVE COMPARISON MATRIX (#comparison) */}
      <section id="comparison" className="space-y-6 pt-4 font-mono">
        <Reveal>
          <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 05. ARCHITECTURAL COMPARISON</span>
            <span>AGENT STUDIO VS INDUSTRY ALTERNATIVES</span>
          </div>
        </Reveal>

        <Reveal delay={0}>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/90 dark:bg-[#0a0a0a]/90 shadow-md">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-black/50 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="p-3.5 font-bold">Capabilities & Architecture</th>
                  <th className="p-3.5 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40">Agent Studio</th>
                  <th className="p-3.5 font-bold">n8n</th>
                  <th className="p-3.5 font-bold">Dify.ai</th>
                  <th className="p-3.5 font-bold">Langflow / Flowise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-indigo-950/60">
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="hover:bg-slate-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-900 dark:text-slate-100">{row.feature}</td>
                    <td className="p-3.5 font-bold text-emerald-700 dark:text-emerald-400 bg-indigo-50/40 dark:bg-indigo-950/20">{row.studio}</td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400">{row.n8n}</td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400">{row.dify}</td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400">{row.langflow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* SECTION 8: LIVE RUNTIME INTELLIGENCE & OBSERVABILITY (#runtime-intel) */}
      <section id="runtime-intel" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 06. LIVE RUNTIME OBSERVABILITY & CONTROLS</span>
            <span>SSE PULSES · HEATMAPS · STEP REPLAY</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          <Reveal delay={0}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:-translate-y-1 hover:border-sky-400 dark:hover:border-sky-500/50 hover:shadow-xl transition-all duration-300 h-full flex flex-col shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-black/40">GHOST PREVIEW</span>
                <Eye className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Zero-Token Dry Run</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed flex-1">
                Run the interpreter in fast-forward against live state — nodes light up showing exactly what path a run would take without writing anything or spending tokens.
              </p>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:-translate-y-1 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-xl transition-all duration-300 h-full flex flex-col shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-black/40">LATENCY HEATMAP</span>
                <Gauge className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Per-Node Cost Metrics</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed flex-1">
                Per-node latency, token, and dollar costs rendered straight onto the canvas. Toggle heatmap mode to spot slow or expensive branches at a glance.
              </p>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:-translate-y-1 hover:border-violet-400 dark:hover:border-violet-500/50 hover:shadow-xl transition-all duration-300 h-full flex flex-col shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-black/40">TIME SCRUBBER</span>
                <TimerReset className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">1×–8× Speed Playback</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed flex-1">
                A timeline scrubber replays any past execution — nodes glow and dim in sync with adjustable playback speed so you can debug divergent paths.
              </p>
            </div>
          </Reveal>

          <Reveal delay={180}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-xl transition-all duration-300 h-full flex flex-col shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-black/40">BUDGET CAPS</span>
                <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Hard Cost Limits</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed flex-1">
                Set max cost, token, and step caps per node. The interpreter stops runaway agents before unexpected bills occur.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 9: DEVELOPER TOOLING & EDITING (#tooling) */}
      <section id="tooling" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 07. DEVELOPER TOOLING & GRAPH EDITING</span>
            <span>ENGINEERED FOR POWER USERS</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          {devTooling.map((t, i) => (
            <Reveal key={t.title} delay={i * 40}>
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

      {/* SECTION 10: SECURITY & ENTERPRISE GOVERNANCE (#guardrails) */}
      <section id="guardrails" className="p-5 sm:p-8 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-[#0a0a0a]/90 space-y-6 font-mono shadow-md">
        <Reveal>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950 pb-4 text-xs">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-pixel text-sm">08. ENTERPRISE SECURITY & GOVERNANCE</span>
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
                Strict PostgreSQL tenant boundaries isolate skills, versions, graph executions, and approval records per user account.
              </p>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Hard Execution Limits
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Enforces maximum step boundaries and loop cycles to prevent infinite loops, runaway costs, and resource exhaustion.
              </p>
            </div>
          </Reveal>

          <Reveal delay={300}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-cyan-400 dark:hover:border-cyan-500/50 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> Circuit-Breaker Failover
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                A single model failure never stops a run — the router parks the failing provider in adaptive cooldown and transparently moves to the next healthy model.
              </p>
            </div>
          </Reveal>

          <Reveal delay={400}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Atomic Commit Transactions
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Skill creation, draft rotation, publish, and execution traces commit in atomic transactions — a crash can never orphan data.
              </p>
            </div>
          </Reveal>

          <Reveal delay={500}>
            <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-black/40 space-y-2 hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Full Audit Trails
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Every mutation writes a structured log and audit row (SKILL_PUBLISHED, APPROVAL_GRANTED, RECOVERY_STARTED) traced back to the acting user.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 11: FREQUENTLY ASKED QUESTIONS (#faq) */}
      <section id="faq" className="space-y-6 pt-4 font-mono">
        <Reveal>
          <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 09. FREQUENTLY ASKED QUESTIONS</span>
            <span>ARCHITECTURE & FAQ</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 text-xs">
          {faqItems.map((f, i) => (
            <Reveal key={f.q} delay={i * 50}>
              <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" /> {f.q}
                </h4>
                <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">{f.a}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SECTION 12: BOTTOM CTA & FOOTER */}
      <section className="text-center space-y-6 pt-6 border-t border-slate-200 dark:border-indigo-950/80 font-mono">
        <Reveal delay={0}>
          <div className="text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest font-semibold">
            READY TO BUILD AUTONOMOUS MULTI-AGENT WORKFLOWS?
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="text-2xl sm:text-4xl font-pixel text-pixel-glow uppercase">
            LAUNCH AGENT STUDIO TODAY
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
            <a href="#opensource" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Open Source</a>
            <a href="#marketplace" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Marketplace</a>
            <a href="#models" className="hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors">Models</a>
            <a href="#comparison" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Comparison</a>
            <a href="#runtime-intel" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Runtime Intel</a>
            <a href="#tooling" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Tooling</a>
            <a href="#guardrails" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">Guardrails</a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">FAQ</a>
            <Link href="/dashboard" className="hover:text-indigo-600 dark:hover:text-indigo-300 font-bold text-indigo-700 dark:text-indigo-400 transition-colors">Dashboard</Link>
          </div>
        </footer>
      </section>

      {/* Floating Bottom-Right Portfolio Widget */}
      <FooterPortfolioWidget />
    </div>
  );
}
