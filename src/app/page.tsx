import React from "react";
import Link from "next/link";
import { Sparkles, CheckSquare, GitCompare, Terminal, ArrowRight, Lock, Wrench, ShieldCheck, UserCheck, Database, Zap, HelpCircle, ChevronDown } from "lucide-react";
import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { LiveExecutionTerminal } from "@/components/landing/LiveExecutionTerminal";
import { PixelGridWave } from "@/components/landing/PixelGridWave";
import { Reveal } from "@/components/Reveal";

export default function LandingPage() {
  return (
    <div className="space-y-16 sm:space-y-24 px-4 sm:px-6 lg:px-10 py-8">
      {/* SECTION 1: HERO SECTION & INTERACTIVE TERMINAL */}
      <section className="relative overflow-hidden border-b border-indigo-950/80 -mx-4 sm:-mx-6 lg:-mx-10">
        {/* Premium Animated Background Layers */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <PixelGridWave />
          <div className="absolute inset-0 crt-lines" />
          <div className="absolute -top-48 -left-32 h-[520px] w-[520px] rounded-full bg-indigo-600/25 blur-[130px]" />
          <div className="absolute top-1/4 -right-40 h-[460px] w-[460px] rounded-full bg-cyan-500/15 blur-[130px]" />
          <div className="absolute -bottom-24 left-1/4 h-[380px] w-[380px] rounded-full bg-violet-600/15 blur-[120px]" />
          <div className="absolute inset-0 bg-grid-faint [mask-image:radial-gradient(ellipse_60%_60%_at_50%_35%,black_20%,transparent_80%)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-black" />
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.5) 100%)" }}
          />
        </div>

        <div className="relative z-10 space-y-8 py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10">
          {/* Announcement Pill */}
          <div className="animate-fadeInUp">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 text-[11px] font-mono text-indigo-200 uppercase tracking-widest backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400"></span>
              </span>
              DEFINE · VALIDATE · VERSION · EXECUTE
            </div>
          </div>

          {/* Pixel Block Headline */}
          <h1
            className="glitch animate-fadeInUp text-4xl sm:text-6xl lg:text-7xl font-pixel uppercase tracking-tight leading-tight max-w-5xl"
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
            <p className="text-xl sm:text-2xl text-slate-100 font-medium leading-snug tracking-tight font-sans">
              Build, validate, version, and execute{" "}
              <span className="text-gradient-glow font-semibold">dynamic AI skills</span> safely.
            </p>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-mono-tech">
              Every tool call is restricted to{" "}
              <span className="text-slate-200 border-b border-indigo-500/30 pb-0.5">authorized schemas</span>, and any write action requires explicit{" "}
              <span className="text-indigo-300 font-medium border-b border-indigo-400/40 pb-0.5">Human-in-the-Loop approval</span> protected by{" "}
              <span className="text-slate-200 border-b border-indigo-500/30 pb-0.5">single-use idempotency tokens</span>.
            </p>
          </div>

        {/* Dynamic Auth Status Indicator */}
        <div className="animate-fadeInUp font-mono text-xs" style={{ animationDelay: "350ms" }}>
          <SignedIn>
            <div className="inline-flex max-w-full items-center gap-2 px-3 py-1.5 rounded border border-emerald-500/30 bg-emerald-950/20 text-emerald-300">
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <span>AUTHENTICATED · WORKSPACE ACCESS GRANTED</span>
            </div>
          </SignedIn>
        </div>

        {/* CTAs */}
        <div className="animate-fadeInUp flex flex-wrap items-center gap-4 pt-2 font-mono text-xs" style={{ animationDelay: "400ms" }}>
          <SignedOut>
            <SignUpButton mode="modal">
              <button className="inline-flex items-center gap-2 px-6 py-3.5 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 transition-all text-sm">
                [ GET STARTED FREE ] <ArrowRight className="h-4 w-4" />
              </button>
            </SignUpButton>

            <SignInButton mode="modal">
              <button className="px-5 py-3.5 rounded border border-indigo-500/40 bg-indigo-950/40 text-indigo-200 hover:border-indigo-400 hover:text-white transition-all text-sm">
                [ SIGN IN ]
              </button>
            </SignInButton>
          </SignedOut>

          <a
            href="https://github.com/devhimanshuu/Agent-Studio"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-3.5 rounded border border-indigo-500/40 bg-indigo-950/40 text-indigo-300 hover:border-indigo-400 hover:text-white transition-all text-xs"
          >
            <Terminal className="h-4 w-4 text-indigo-400" />
            [ VIEW ON GITHUB ]
          </a>
        </div>

        {/* Interactive Live Agent Execution Terminal Widget */}
        <div className="animate-fadeInUp pt-6" style={{ animationDelay: "500ms" }}>
          <div className="text-xs font-mono text-indigo-400/80 mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 uppercase">
            <span>// INTERACTIVE PLATFORM SIMULATOR</span>
            <span className="text-indigo-300">TRY RUNNING A SKILL BELOW</span>
          </div>
          <LiveExecutionTerminal />
        </div>

        {/* Scroll Hint */}
        <div className="flex justify-center pt-2 animate-float">
          <ChevronDown className="h-5 w-5 text-indigo-400/50" />
        </div>
        </div>
      </section>

      {/* SECTION 2: SOCIAL PROOF & KEY METRICS */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-center">
        <Reveal delay={0}>
          <div className="p-4 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-1 h-full">
            <div className="text-2xl font-pixel text-slate-100">99.99%</div>
            <div className="text-[11px] text-indigo-400">HITL Approval Reliability</div>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="p-4 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-1 h-full">
            <div className="text-2xl font-pixel text-slate-100">ZERO</div>
            <div className="text-[11px] text-emerald-400">Unauthorized Tool Leaks</div>
          </div>
        </Reveal>
        <Reveal delay={160}>
          <div className="p-4 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-1 h-full">
            <div className="text-2xl font-pixel text-slate-100">100%</div>
            <div className="text-[11px] text-amber-400">Single-Use Token Security</div>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="p-4 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-1 h-full">
            <div className="text-2xl font-pixel text-slate-100">SAAS READY</div>
            <div className="text-[11px] text-indigo-300">Multi-Tenant PostgreSQL</div>
          </div>
        </Reveal>
      </section>

      {/* SECTION 3: 4 CORE SAAS PILLARS (#features) */}
      <section id="features" className="space-y-8 pt-4">
        <Reveal>
          <div className="flex items-center justify-between text-xs font-mono text-indigo-400/80 uppercase tracking-widest border-b border-indigo-950/80 pb-3">
            <span>// 01. CORE SAAS CAPABILITIES</span>
            <span>ENTERPRISE GUARANTEES</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6 font-mono">
          {/* Pillar 1 */}
          <Reveal delay={0}>
            <div className="p-6 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-3 hover:border-indigo-500/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 h-full">
              <div className="flex items-center justify-between text-indigo-400 text-xs">
                <span className="font-pixel text-sm">01. USER-DEFINED SKILLS</span>
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">Schema-Validated Skill Definitions</h3>
              <p className="text-xs text-slate-400 font-serif leading-relaxed">
                Define custom agent skills with strict JSON Schema inputs and outputs, instructions, few-shot examples, and maximum execution step boundaries.
              </p>
            </div>
          </Reveal>

          {/* Pillar 2 */}
          <Reveal delay={80}>
            <div className="p-6 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-3 hover:border-indigo-500/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 h-full">
              <div className="flex items-center justify-between text-indigo-400 text-xs">
                <span className="font-pixel text-sm">02. BOUNDED SYSTEM TOOLS</span>
                <Wrench className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">Strict Tool Authorization</h3>
              <p className="text-xs text-slate-400 font-serif leading-relaxed">
                Agents operate strictly within allowed tools. Unpermitted tool requests are intercepted and rejected at the execution graph level.
              </p>
            </div>
          </Reveal>

          {/* Pillar 3 */}
          <Reveal delay={160}>
            <div className="p-6 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-3 hover:border-amber-500/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 h-full">
              <div className="flex items-center justify-between text-amber-400 text-xs">
                <span className="font-pixel text-sm">03. HUMAN-IN-THE-LOOP (HITL)</span>
                <CheckSquare className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">Single-Use Idempotency Approval Locks</h3>
              <p className="text-xs text-slate-400 font-serif leading-relaxed">
                Write actions automatically pause agent execution into a pending state. Approval triggers a single-use token preventing duplicate writes.
              </p>
            </div>
          </Reveal>

          {/* Pillar 4 */}
          <Reveal delay={240}>
            <div className="p-6 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-3 hover:border-emerald-500/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 h-full">
              <div className="flex items-center justify-between text-emerald-400 text-xs">
                <span className="font-pixel text-sm">04. VERSIONING & DIFF ENGINE</span>
                <GitCompare className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">Draft & Published Version Control</h3>
              <p className="text-xs text-slate-400 font-serif leading-relaxed">
                Publish drafts into immutable numeric versions (v1, v2, v3). Compare versions side-by-side with full diff inspection and rerun support.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 4: BOUNDED TOOL SUITE BREAKDOWN (#tools) */}
      <section id="tools" className="space-y-6 pt-4 font-mono">
        <Reveal>
          <div className="flex items-center justify-between text-xs text-indigo-400/80 uppercase tracking-widest border-b border-indigo-950/80 pb-3">
            <span>// 02. BOUNDED SYSTEM TOOL MATRIX</span>
            <span>PRE-BUILT SANDBOXED TOOLS</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <Reveal delay={0}>
            <div className="p-5 rounded border border-indigo-900/40 bg-[#0a0a0a]/90 space-y-2 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-md hover:shadow-indigo-500/10 transition-all duration-300 h-full">
              <div className="text-indigo-400 font-bold flex items-center justify-between">
                <span>calculator</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300">READ</span>
              </div>
              <p className="text-[11px] text-slate-400 font-serif">Safely evaluates mathematical expressions and formulas.</p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="p-5 rounded border border-indigo-900/40 bg-[#0a0a0a]/90 space-y-2 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-md hover:shadow-indigo-500/10 transition-all duration-300 h-full">
              <div className="text-indigo-400 font-bold flex items-center justify-between">
                <span>document_search</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300">READ</span>
              </div>
              <p className="text-[11px] text-slate-400 font-serif">Mock vector and text query search over internal knowledge base.</p>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="p-5 rounded border border-indigo-900/40 bg-[#0a0a0a]/90 space-y-2 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-md hover:shadow-indigo-500/10 transition-all duration-300 h-full">
              <div className="text-indigo-400 font-bold flex items-center justify-between">
                <span>record_lookup</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300">READ</span>
              </div>
              <p className="text-[11px] text-slate-400 font-serif">Queries structured customer data records and database entities.</p>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="p-5 rounded border border-amber-500/40 bg-amber-950/20 space-y-2 hover:-translate-y-1 hover:border-amber-400/60 hover:shadow-md hover:shadow-amber-500/10 transition-all duration-300 h-full">
              <div className="text-amber-300 font-bold flex items-center justify-between">
                <span>mock_task_creator</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 font-bold">WRITE</span>
              </div>
              <p className="text-[11px] text-amber-200/80 font-serif">Creates tasks & tickets. Requires HITL human approval before execution.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 5: SECURITY & GUARDRAILS (#guardrails) */}
      <section id="guardrails" className="p-5 sm:p-8 rounded border border-indigo-900/50 bg-[#0a0a0a]/90 space-y-6 font-mono">
        <Reveal>
          <div className="flex items-center justify-between border-b border-indigo-950 pb-4 text-xs">
            <div className="flex items-center gap-2 text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-pixel text-sm">03. ENTERPRISE SECURITY GUARDRAILS</span>
            </div>
            <span className="text-emerald-400 text-[10px]">[ ZERO TRUST RUNTIME ]</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <Reveal delay={0}>
            <div className="space-y-2">
              <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-400" /> Single-Use Idempotency Tokens
              </h4>
              <p className="text-slate-400 font-serif leading-relaxed text-[11px]">
                Every approved write action generates a single-use token. Retries or duplicate submissions are automatically blocked.
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="space-y-2">
              <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
                <Database className="h-4 w-4 text-indigo-400" /> Multi-Tenant Isolation
              </h4>
              <p className="text-slate-400 font-serif leading-relaxed text-[11px]">
                Strict PostgreSQL tenant boundaries isolate skills, versions, executions, and approval records per user account.
              </p>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="space-y-2">
              <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-emerald-400" /> Hard Execution Step Limits
              </h4>
              <p className="text-slate-400 font-serif leading-relaxed text-[11px]">
                Enforces maximum step boundaries (e.g. 10 steps) to prevent infinite loops, runaway API costs, and resource leaks.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 6: FREQUENTLY ASKED QUESTIONS (#faq) */}
      <section id="faq" className="space-y-6 pt-4 font-mono">
        <Reveal>
          <div className="flex items-center justify-between text-xs text-indigo-400/80 uppercase tracking-widest border-b border-indigo-950/80 pb-3">
            <span>// 04. FREQUENTLY ASKED QUESTIONS</span>
            <span>FAQ & DETAILS</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6 text-xs">
          <Reveal delay={0}>
            <div className="p-5 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-2 h-full">
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-400" /> How does Human-in-the-Loop (HITL) approval work?
              </h4>
              <p className="text-slate-400 font-serif leading-relaxed text-[11px]">
                When an agent executes a tool specified in <code className="text-indigo-300">actionsRequiringApproval</code>, execution pauses in a pending state. Users review the payload and approve or reject it in the UI.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="p-5 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-2 h-full">
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-400" /> What prevents duplicate write execution?
              </h4>
              <p className="text-slate-400 font-serif leading-relaxed text-[11px]">
                Every approved write action generates a single-use idempotency key. Once consumed by the execution engine, the key is invalidated forever.
              </p>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="p-5 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-2 h-full">
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-400" /> Can agents call unauthorized tools?
              </h4>
              <p className="text-slate-400 font-serif leading-relaxed text-[11px]">
                No. Tool availability is restricted to the exact <code className="text-indigo-300">allowedTools</code> list defined in the skill schema. Unpermitted tool calls are rejected automatically.
              </p>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="p-5 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-2 h-full">
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-400" /> How does skill version control work?
              </h4>
              <p className="text-slate-400 font-serif leading-relaxed text-[11px]">
                Skills start as a Draft. Publishing creates an immutable numeric version (v1, v2). You can compare version diffs side-by-side and rerun previous versions anytime.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 7: BOTTOM CTA & FOOTER */}
      <section className="text-center space-y-6 pt-6 border-t border-indigo-950/80 font-mono">
        <Reveal delay={0}>
          <div className="text-xs text-indigo-400/80 uppercase tracking-widest">
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
            <button className="px-6 py-3.5 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 transition-all text-sm">
              [ GET STARTED FREE ]
            </button>
          </SignUpButton>
          </div>
        </Reveal>

        <footer className="pt-12 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-indigo-950/60">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-pixel text-pixel-glow tracking-wide">AGENT STUDIO</span>
            <span>© 2026. All Systems Operational.</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <a href="#features" className="hover:text-indigo-300">Features</a>
            <a href="#tools" className="hover:text-indigo-300">Tools</a>
            <a href="#guardrails" className="hover:text-indigo-300">Guardrails</a>
            <a href="#faq" className="hover:text-indigo-300">FAQ</a>
            <Link href="/dashboard" className="hover:text-indigo-300 font-bold text-indigo-400">[ App ]</Link>
          </div>
        </footer>
      </section>
    </div>
  );
}
