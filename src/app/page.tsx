import React from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckSquare,
  GitCompare,
  Terminal,
  ArrowRight,
  Lock,
  Wrench,
  Shield,
  ShieldCheck,
  UserCheck,
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
} from "lucide-react";
import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { LiveExecutionTerminal } from "@/components/landing/LiveExecutionTerminal";
import { PixelGridWave } from "@/components/landing/PixelGridWave";
import { NeuralPatterns } from "@/components/landing/NeuralPatterns";
import { FooterPortfolioWidget } from "@/components/landing/FooterPortfolioWidget";
import { Reveal } from "@/components/Reveal";

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
    desc: "Every planned tool must exist, be enabled, and be listed in the skill's allowedTools — anything else is rejected before it can run.",
  },
  {
    tag: "SELECTION NODE",
    accent: "text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-black/40",
    icon: GitBranch,
    title: "Step Routing",
    desc: "The graph routes step-by-step via conditional edges: approve, execute, or finish — the plan is walked deterministically.",
  },
  {
    tag: "EXECUTION NODE",
    accent: "text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-black/40",
    icon: Wrench,
    title: "Tool Execution",
    desc: "Each step runs through the tool registry with retry handling. Tool calls and their outputs are persisted for full auditability.",
  },
  {
    tag: "REVIEW NODE",
    accent: "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-black/40",
    icon: Shield,
    title: "HITL Pause",
    desc: "Write actions flagged for human review park the run in PAUSED_FOR_APPROVAL. A single-use idempotency key guarantees the response happens once.",
  },
  {
    tag: "FINISH NODE",
    accent: "text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-black/40",
    icon: Flag,
    title: "Output Assembly",
    desc: "Collected step results are assembled into the final output and persisted alongside the full node timeline.",
  },
];

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
              <span className="truncate">GRAPH-FIRST RUNTIME · LLM AUTO-FAILOVER · HITL LOCK</span>
            </div>
          </div>

          {/* Pixel Block Headline */}
          <h1
            className="glitch animate-fadeInUp text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-pixel uppercase tracking-tight leading-tight max-w-5xl text-slate-900 dark:text-slate-100 break-words"
            style={{ animationDelay: "100ms" }}
            data-text="DYNAMIC AI SKILLS PLATFORM"
          >
            DYNAMIC <span className="text-gradient-glow">AI SKILLS</span> PLATFORM
          </h1>

          {/* Redesigned Subhead Text Design */}
          <div
            className="animate-fadeInUp space-y-3 max-w-3xl font-mono-tech"
            style={{ animationDelay: "300ms" }}
          >
            <p className="text-lg sm:text-2xl text-slate-900 dark:text-slate-100 font-medium leading-snug tracking-tight font-sans">
              Build, validate, version, and execute{" "}
              <span className="text-gradient-glow font-semibold">dynamic AI skills</span> on a{" "}
              <span className="text-slate-800 dark:text-slate-200 border-b border-indigo-400/40 dark:border-indigo-500/30 pb-0.5">graph-first agent runtime</span>.
            </p>
            <p className="text-xs sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-mono-tech">
              Every tool call is restricted to{" "}
              <span className="text-slate-800 dark:text-slate-200 border-b border-indigo-400/40 dark:border-indigo-500/30 pb-0.5">authorized schemas</span>, write actions require explicit{" "}
              <span className="text-indigo-700 dark:text-indigo-300 font-medium border-b border-indigo-400/50 pb-0.5">Human-in-the-Loop approval</span> protected by{" "}
              <span className="text-slate-800 dark:text-slate-200 border-b border-indigo-400/40 dark:border-indigo-500/30 pb-0.5">single-use idempotency tokens</span>, and every AI call{" "}
              <span className="text-emerald-700 dark:text-emerald-300 border-b border-emerald-400/50 pb-0.5 font-medium">auto-fails over across 12 free models</span>.
            </p>
          </div>

          {/* Dynamic Auth Status Indicator */}
          <div className="animate-fadeInUp font-mono text-xs" style={{ animationDelay: "350ms" }}>
            <SignedIn>
              <div className="inline-flex max-w-full items-center gap-2 px-3 py-1.5 rounded border border-emerald-400/40 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 shadow-sm text-[11px]">
                <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">AUTHENTICATED · WORKSPACE ACCESS GRANTED</span>
              </div>
            </SignedIn>
          </div>

          {/* CTAs */}
          <div className="animate-fadeInUp flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2 font-mono text-xs" style={{ animationDelay: "400ms" }}>
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded border border-indigo-500 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 transition-all text-sm cursor-pointer w-full sm:w-auto">
                  [ GET STARTED FREE ] <ArrowRight className="h-4 w-4" />
                </button>
              </SignUpButton>

              <SignInButton mode="modal">
                <button className="px-5 py-3.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-white dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/60 shadow-sm transition-all text-sm cursor-pointer w-full sm:w-auto text-center">
                  [ SIGN IN ]
                </button>
              </SignInButton>
            </SignedOut>

            <a
              href="https://github.com/devhimanshuu/Agent-Studio"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-white dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/60 shadow-sm transition-all text-xs w-full sm:w-auto"
            >
              <Terminal className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              [ VIEW ON GITHUB ]
            </a>
          </div>

          {/* Interactive Live Agent Execution Terminal Widget */}
          <div className="animate-fadeInUp pt-6" style={{ animationDelay: "500ms" }}>
            <div className="text-xs font-mono text-indigo-700 dark:text-indigo-400/80 mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 uppercase font-semibold">
              <span>// INTERACTIVE PLATFORM SIMULATOR</span>
              <span className="text-indigo-700 dark:text-indigo-300">TRY RUNNING A SKILL BELOW</span>
            </div>
            <LiveExecutionTerminal />
          </div>

          {/* Scroll Hint */}
          <div className="flex justify-center pt-2 animate-float">
            <ChevronDown className="h-5 w-5 text-indigo-500/70 dark:text-indigo-400/50" />
          </div>
        </div>
      </section>

      {/* SECTION 2: SOCIAL PROOF & KEY METRICS */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-center">
        <Reveal delay={0}>
          <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">12</div>
            <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold">LLM Models · Auto-Failover Roster</div>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300">
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">ZERO</div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">Unauthorized Tool Leaks</div>
          </div>
        </Reveal>
        <Reveal delay={160}>
          <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300">
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">100%</div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">Single-Use Token Enforcement</div>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">TRACED</div>
            <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold">Every Execution · Node Timeline</div>
          </div>
        </Reveal>
      </section>

      {/* SECTION 3: THE GRAPH-FIRST RUNTIME (#runtime) */}
      <section id="runtime" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 01. THE GRAPH-FIRST AGENT RUNTIME</span>
            <span>LANGGRAPH EXECUTION ENGINE</span>
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

        {/* Execution trace panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
          <Reveal delay={0}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-3 h-full shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all duration-300">
              <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 border-b border-slate-200 dark:border-indigo-950/60 pb-2 flex items-center gap-1.5 font-semibold">
                <Braces className="h-3.5 w-3.5" /> PERSISTED EXECUTION TRACE
              </div>
              <div className="p-3.5 rounded bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-indigo-950/80 font-mono text-[11px] leading-relaxed overflow-x-auto text-slate-800 dark:text-slate-200">
                <pre className="whitespace-pre">
                  <span className="text-slate-500 dark:text-slate-400">&#123;</span>{"\n"}
                  {"  "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;status&quot;</span><span className="text-slate-500 dark:text-slate-400">: </span><span className="text-emerald-700 dark:text-emerald-400">&quot;COMPLETED&quot;</span><span className="text-slate-500 dark:text-slate-400">,</span>{"\n"}
                  {"  "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;provider&quot;</span><span className="text-slate-500 dark:text-slate-400">: </span><span className="text-emerald-700 dark:text-emerald-400">&quot;groq/llama-3.3-70b-versatile&quot;</span><span className="text-slate-500 dark:text-slate-400">,</span>{"\n"}
                  {"  "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;durationMs&quot;</span><span className="text-slate-500 dark:text-slate-400">: </span><span className="text-amber-700 dark:text-amber-400">1842</span><span className="text-slate-500 dark:text-slate-400">,</span>{"\n"}
                  {"  "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;maxSteps&quot;</span><span className="text-slate-500 dark:text-slate-400">: </span><span className="text-amber-700 dark:text-amber-400">10</span><span className="text-slate-500 dark:text-slate-400">,</span>{"\n"}
                  {"  "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;plannerOutput&quot;</span><span className="text-slate-500 dark:text-slate-400">: &#123;</span>{"\n"}
                  {"    "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;reasoning&quot;</span><span className="text-slate-500 dark:text-slate-400">: </span><span className="text-emerald-700 dark:text-emerald-400">&quot;Resolve the refund first…&quot;</span><span className="text-slate-500 dark:text-slate-400">,</span>{"\n"}
                  {"    "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;requiredTools&quot;</span><span className="text-slate-500 dark:text-slate-400">: [</span><span className="text-emerald-700 dark:text-emerald-400">&quot;calculator&quot;</span><span className="text-slate-500 dark:text-slate-400">],</span>{"\n"}
                  {"    "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;steps&quot;</span><span className="text-slate-500 dark:text-slate-400">: </span><span className="text-amber-700 dark:text-amber-400">3</span>{"\n"}
                  {"  "}<span className="text-slate-500 dark:text-slate-400">&#125;,</span>{"\n"}
                  {"  "}<span className="text-indigo-700 dark:text-indigo-300 font-semibold">&quot;nodeTimeline&quot;</span><span className="text-slate-500 dark:text-slate-400">: [</span>{"\n"}
                  {"    "}<span className="text-emerald-700 dark:text-emerald-400">&quot;planner → permission → tool_selection&quot;</span><span className="text-slate-500 dark:text-slate-400">,</span>{"\n"}
                  {"    "}<span className="text-emerald-700 dark:text-emerald-400">&quot;→ tool_execution → finish&quot;</span>{"\n"}
                  {"  "}<span className="text-slate-500 dark:text-slate-400">]</span>{"\n"}
                  <span className="text-slate-500 dark:text-slate-400">&#125;</span>
                </pre>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-3 h-full shadow-sm">
              <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 border-b border-slate-200 dark:border-indigo-950/60 pb-2 flex items-center gap-1.5 font-semibold">
                <Activity className="h-3.5 w-3.5" /> WHY GRAPH-FIRST?
              </div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-400 font-serif space-y-3 leading-relaxed">
                <li>
                  <span className="text-slate-900 dark:text-slate-200 font-bold">The LLM is a node dependency, not the system.</span>{" "}
                  The runtime walks a deterministic LangGraph — the same plan executes identically with any provider.
                </li>
                <li>
                  <span className="text-slate-900 dark:text-slate-200 font-bold">Every step is persisted.</span>{" "}
                  Planner output, provider used, duration, node timeline, and tool calls survive the run for replay and audit.
                </li>
                <li>
                  <span className="text-slate-900 dark:text-slate-200 font-bold">Failure is handled like any node.</span>{" "}
                  Provider failures, timeouts, unauthorized tools, and step-limit breaches all resolve to explicit terminal states.
                </li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 4: CORE SAAS PILLARS (#features) */}
      <section id="features" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 02. CORE SAAS CAPABILITIES</span>
            <span>ENTERPRISE GUARANTEES</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono">
          {/* Pillar 1 */}
          <Reveal delay={0}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 h-full shadow-sm">
              <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-xs">
                <span className="font-pixel text-sm">01. USER-DEFINED SKILLS</span>
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Schema-Validated Skill Definitions</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                Define custom agent skills with strict JSON Schema inputs and outputs, instructions, few-shot examples, and maximum execution step boundaries.
              </p>
            </div>
          </Reveal>

          {/* Pillar 2 */}
          <Reveal delay={80}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 h-full shadow-sm">
              <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-xs">
                <span className="font-pixel text-sm">02. GRAPH-FIRST RUNTIME</span>
                <GitBranch className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">LangGraph Execution Engine</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                Skills execute deterministically through independent nodes — planner, permission, selection, execution, approval, finish — each writing to strongly typed state.
              </p>
            </div>
          </Reveal>

          {/* Pillar 3 */}
          <Reveal delay={160}>
            <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 h-full shadow-sm">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs">
                <span className="font-pixel text-sm">03. BOUNDED SYSTEM TOOLS</span>
                <Wrench className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Strict Tool Authorization</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
                Agents operate strictly within allowed tools. Unpermitted tool requests are intercepted and rejected at the permission node before execution.
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
                Write actions automatically pause agent execution into a pending state. Approval consumes a single-use token — enforced atomically, so a key can never respond twice.
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
                Publish drafts into immutable numeric versions (v1, v2, v3). Editing a published skill auto-rotates a fresh draft — published versions never change.
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
                12 free models across Groq and OpenRouter are tried in order. Failures trigger adaptive cooldowns (429 → 60s, 5xx → 30s, 404 → 10min, bad key → vendor park).
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 5: BOUNDED TOOL SUITE BREAKDOWN (#tools) */}
      <section id="tools" className="space-y-6 pt-4 font-mono">
        <Reveal>
          <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 03. BOUNDED SYSTEM TOOL MATRIX</span>
            <span>PRE-BUILT SANDBOXED TOOLS</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <Reveal delay={0}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/90 space-y-2 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/40 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <div className="text-indigo-700 dark:text-indigo-400 font-bold flex items-center justify-between">
                <span>calculator</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-semibold">READ</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif">Safely evaluates mathematical expressions and formulas.</p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/90 space-y-2 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/40 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <div className="text-indigo-700 dark:text-indigo-400 font-bold flex items-center justify-between">
                <span>document_search</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-semibold">READ</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif">Mock vector and text query search over internal knowledge base.</p>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/90 space-y-2 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/40 hover:shadow-md transition-all duration-300 h-full shadow-sm">
              <div className="text-indigo-700 dark:text-indigo-400 font-bold flex items-center justify-between">
                <span>record_lookup</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-semibold">READ</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif">Queries structured customer data records and database entities.</p>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="p-5 rounded border border-amber-300 dark:border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/20 space-y-2 hover:-translate-y-1 hover:border-amber-400/60 hover:shadow-md hover:shadow-amber-500/10 transition-all duration-300 h-full shadow-sm">
              <div className="text-amber-800 dark:text-amber-300 font-bold flex items-center justify-between">
                <span>mock_task_creator</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-950 text-amber-900 dark:text-amber-400 font-bold">WRITE</span>
              </div>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 font-serif">Creates tasks & tickets. Requires HITL human approval before execution.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 6: SECURITY & GUARDRAILS (#guardrails) */}
      <section id="guardrails" className="p-5 sm:p-8 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-[#0a0a0a]/90 space-y-6 font-mono shadow-md">
        <Reveal>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950 pb-4 text-xs">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-pixel text-sm">04. ENTERPRISE SECURITY GUARDRAILS</span>
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
                Every mutation writes a structured log and an audit row (SKILL_PUBLISHED, APPROVAL_GRANTED, …) traced back to the acting user.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 7: FREQUENTLY ASKED QUESTIONS (#faq) */}
      <section id="faq" className="space-y-6 pt-4 font-mono">
        <Reveal>
          <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 05. FREQUENTLY ASKED QUESTIONS</span>
            <span>FAQ & DETAILS</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 text-xs">
          <Reveal delay={0}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> How does Human-in-the-Loop (HITL) approval work?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                When an agent executes a tool specified in <code className="text-indigo-700 dark:text-indigo-300 font-semibold">actionsRequiringApproval</code>, execution pauses in a pending state. Users review the payload and approve or reject it.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> What prevents duplicate write execution?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Every approved write action carries a single-use idempotency key, enforced atomically. Once consumed, replaying the same key — even concurrently — is rejected.
              </p>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Can agents call unauthorized tools?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                No. Tool availability is restricted to the exact <code className="text-indigo-700 dark:text-indigo-300 font-semibold">allowedTools</code> list defined in the skill schema. Unpermitted tool calls are rejected at the permission node.
              </p>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> What happens when an LLM provider goes down?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Nothing breaks. The router parks the failed model in a cooldown and transparently retries the next of 12 configured models across Groq and OpenRouter.
              </p>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Can I trace how an execution ran?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Every run persists its planner output, serving provider, duration, node-by-node timeline, and tool calls — inspectable in the execution trace view.
              </p>
            </div>
          </Reveal>

          <Reveal delay={400}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> How does skill version control work?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Skills start as a Draft. Publishing creates an immutable numeric version (v1, v2), and editing a published skill auto-rotates a fresh draft so published versions never change.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 8: BOTTOM CTA & FOOTER */}
      <section className="text-center space-y-6 pt-6 border-t border-slate-200 dark:border-indigo-950/80 font-mono">
        <Reveal delay={0}>
          <div className="text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest font-semibold">
            READY TO DEPLOY REUSABLE AI SKILLS AT SCALE?
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="text-2xl sm:text-4xl font-pixel text-pixel-glow uppercase">
            ENTER AGENT STUDIO TODAY
          </h2>
        </Reveal>

        <Reveal delay={200}>
          <div className="flex justify-center gap-4 pt-2">
            <SignUpButton mode="modal">
              <button className="px-6 py-3.5 rounded border border-indigo-500 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 transition-all text-sm cursor-pointer">
                [ GET STARTED FREE ]
              </button>
            </SignUpButton>
          </div>
        </Reveal>

        <footer className="pt-12 text-xs text-slate-600 dark:text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-indigo-950/60">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-pixel text-pixel-glow tracking-wide">AGENT STUDIO</span>
            <span>© 2026. All Systems Operational.</span>
          </div>
          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
            <a href="#runtime" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">[ Runtime ]</a>
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">[ Features ]</a>
            <a href="#tools" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">[ Tools ]</a>
            <a href="#guardrails" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">[ Guardrails ]</a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">[ FAQ ]</a>
            <Link href="/dashboard" className="hover:text-indigo-600 dark:hover:text-indigo-300 font-bold text-indigo-700 dark:text-indigo-400 transition-colors">[ App ]</Link>
          </div>
        </footer>
      </section>

      {/* Floating Bottom-Right Portfolio Circle Trigger (Visible on Scroll) */}
      <FooterPortfolioWidget />
    </div>
  );
}
