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
  FileText,
  Search,
  SlidersHorizontal,
  Workflow,
  Cpu,
  Layers,
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
              <span className="truncate">CONTROLLED AGENTIC WORKFLOWS · 8 STEP TYPES · SAFE RECOVERY · HITL LOCK</span>
            </div>
          </div>

          {/* Pixel Block Headline */}
          <h1
            className="glitch animate-fadeInUp text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-pixel uppercase tracking-tight leading-tight max-w-5xl text-slate-900 dark:text-slate-100 break-words"
            style={{ animationDelay: "100ms" }}
            data-text="CONTROLLED AGENTIC WORKFLOWS"
          >
            CONTROLLED <span className="text-gradient-glow">AGENTIC WORKFLOW</span> PLATFORM
          </h1>

          {/* Redesigned Subhead Text Design */}
          <div
            className="animate-fadeInUp space-y-3 max-w-3xl font-mono-tech"
            style={{ animationDelay: "300ms" }}
          >
            <p className="text-lg sm:text-2xl text-slate-900 dark:text-slate-100 font-medium leading-snug tracking-tight font-sans">
              Define, validate, and execute{" "}
              <span className="text-gradient-glow font-semibold">bounded business workflows</span> on a{" "}
              <span className="text-slate-800 dark:text-slate-200 border-b border-indigo-400/40 dark:border-indigo-500/30 pb-0.5">graph-first agent runtime</span>.
            </p>
            <p className="text-xs sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-mono-tech">
              Execute <span className="text-indigo-700 dark:text-indigo-300 font-medium">8 supported step types</span> with{" "}
              <span className="text-emerald-700 dark:text-emerald-300 font-medium border-b border-emerald-400/40 pb-0.5">execution path decision explainers</span>, recover failed runs via{" "}
              <span className="text-amber-700 dark:text-amber-300 font-medium border-b border-amber-400/40 pb-0.5">step-level safe retry</span> without repeating completed steps, and protect write actions with{" "}
              <span className="text-slate-800 dark:text-slate-200 border-b border-indigo-400/40 dark:border-indigo-500/30 pb-0.5">single-use idempotency approval tokens</span>.
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
              <span>// INTERACTIVE WORKFLOW SIMULATOR</span>
              <span className="text-indigo-700 dark:text-indigo-300">TRY RUNNING A BOUNDED WORKFLOW BELOW</span>
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
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">8</div>
            <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold">Bounded Step Types · Full Lifecycle</div>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300">
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">100%</div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">Safe Step Recovery & Continuity</div>
          </div>
        </Reveal>
        <Reveal delay={160}>
          <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300">
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">100%</div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">Idempotent Single-Use Tokens</div>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-1 h-full shadow-sm hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
            <div className="text-2xl font-pixel text-slate-900 dark:text-slate-100">EXPLAINED</div>
            <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold">Auditable Path Decision Rationale</div>
          </div>
        </Reveal>
      </section>

      {/* SECTION 3: BOUNDED WORKFLOW STEP TYPES MATRIX (#steptypes) */}
      <section id="steptypes" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 01. BOUNDED STEP TYPES MATRIX</span>
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

      {/* SECTION 4: THE GRAPH-FIRST RUNTIME (#runtime) */}
      <section id="runtime" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 02. THE GRAPH-FIRST AGENT RUNTIME</span>
            <span>LANGGRAPH DETERMINISTIC ENGINE</span>
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

      {/* SECTION 5: CORE SAAS PILLARS (#features) */}
      <section id="features" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest border-b border-slate-200 dark:border-indigo-950/80 pb-3 font-semibold">
            <span>// 03. CORE PLATFORM CAPABILITIES</span>
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

      {/* SECTION 6: SECURITY & GUARDRAILS (#guardrails) */}
      <section id="guardrails" className="p-5 sm:p-8 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-[#0a0a0a]/90 space-y-6 font-mono shadow-md">
        <Reveal>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950 pb-4 text-xs">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-pixel text-sm">04. ENTERPRISE SECURITY & GOVERNANCE</span>
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
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> How does Step-Level Safe Recovery work?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                When an execution fails or is paused, the platform saves the full state of completed steps. Retrying recovers previous safe results and resumes directly at the failed step without re-executing completed read/compute steps.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> What is the Path Decision Explainer?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Whenever a deterministic condition or AI classification step evaluates, it generates an explicit explanation detailing why branch A or B was chosen (e.g. &quot;amount &gt; $500 evaluated to TRUE&quot;).
              </p>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> How does Human-in-the-Loop (HITL) approval work?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                When an agent executes an action specified in <code className="text-indigo-700 dark:text-indigo-300 font-semibold">actionsRequiringApproval</code>, execution pauses. Approving issues an atomic single-use idempotency token that prevents duplicate execution.
              </p>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Can I rerun older workflow versions with new input?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Yes. Every version is immutable and can be replayed or re-executed with custom input parameters at any time. Previous run records remain permanently intact.
              </p>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> What happens when an LLM provider goes down?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Nothing breaks. The router parks the failed model in an adaptive cooldown and transparently retries the next model across Groq and OpenRouter.
              </p>
            </div>
          </Reveal>

          <Reveal delay={400}>
            <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-2 h-full hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Can I trace how an execution ran?
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-serif leading-relaxed text-[11px]">
                Every run persists its planner output, serving provider, duration, node-by-node timeline, tool calls, and path decision rationales — inspectable in the execution trace view.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 8: BOTTOM CTA & FOOTER */}
      <section className="text-center space-y-6 pt-6 border-t border-slate-200 dark:border-indigo-950/80 font-mono">
        <Reveal delay={0}>
          <div className="text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest font-semibold">
            READY TO DEPLOY BOUNDED AGENTIC WORKFLOWS AT SCALE?
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
            <a href="#steptypes" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">[ Step Types ]</a>
            <a href="#runtime" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">[ Runtime ]</a>
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">[ Features ]</a>
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

