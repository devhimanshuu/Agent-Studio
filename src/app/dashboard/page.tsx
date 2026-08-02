import React from "react";
import Link from "next/link";
import { Sparkles, Play, CheckSquare, Shield, ArrowUpRight, Plus } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Reveal } from "@/components/Reveal";

export default function DashboardPage() {
  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-950/80 pb-6">
        <Reveal delay={0}>
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">
            SYSTEM DASHBOARD
          </h1>
        </Reveal>

        <Reveal delay={100}>
          <Link
            href="/skills"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all text-xs font-mono"
          >
            <Plus className="h-4 w-4" />
            CREATE NEW SKILL
          </Link>
        </Reveal>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <Reveal delay={0}>
          <div className="p-5 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-2 hover:border-indigo-500/50 transition-all h-full">
            <div className="flex items-center justify-between text-indigo-400 text-xs tracking-wider uppercase">
              <span>ACTIVE SKILLS</span>
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-3xl font-pixel text-slate-100">00</div>
            <p className="text-[11px] text-slate-400">Draft & Published Skills</p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="p-5 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-2 hover:border-emerald-500/50 transition-all h-full">
            <div className="flex items-center justify-between text-emerald-400 text-xs tracking-wider uppercase">
              <span>TOTAL EXECUTIONS</span>
              <Play className="h-4 w-4" />
            </div>
            <div className="text-3xl font-pixel text-slate-100">00</div>
            <p className="text-[11px] text-slate-400">Agent Step Runs</p>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="p-5 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-2 hover:border-amber-500/50 transition-all h-full">
            <div className="flex items-center justify-between text-amber-400 text-xs tracking-wider uppercase">
              <span>PENDING APPROVALS</span>
              <CheckSquare className="h-4 w-4" />
            </div>
            <div className="text-3xl font-pixel text-slate-100">00</div>
            <p className="text-[11px] text-slate-400">Requires Human Review</p>
          </div>
        </Reveal>

        <Reveal delay={240}>
          <div className="p-5 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-2 hover:border-indigo-500/50 transition-all h-full">
            <div className="flex items-center justify-between text-indigo-300 text-xs tracking-wider uppercase">
              <span>PERMITTED TOOLS</span>
              <Shield className="h-4 w-4" />
            </div>
            <div className="text-3xl font-pixel text-slate-100">04</div>
            <p className="text-[11px] text-slate-400">System Tool Definitions</p>
          </div>
        </Reveal>
      </div>

      {/* Section Divider with Monospace Tag */}
      <div className="border-t border-indigo-950/80 pt-6">
        <Reveal delay={0}>
          <div className="text-xs font-mono text-indigo-400/80 uppercase tracking-widest mb-6">
            // RECENT ACTIVITY & APPROVAL QUEUE
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skills Overview */}
          <Reveal delay={0}>
            <div className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-4 h-full">
              <div className="flex items-center justify-between font-mono">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  RECENT SKILLS
                </h3>
              <Link href="/skills" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                [ VIEW ALL ] <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <EmptyState
              title="No skills defined yet"
              description="Create your first reusable AI Skill with input/output JSON schemas and permitted tools."
              action={
                <Link
                  href="/skills"
                  className="px-3 py-1.5 rounded border border-indigo-500/40 bg-indigo-950/40 text-xs font-mono text-indigo-300 hover:border-indigo-400 transition-colors"
                >
                  [ GET STARTED ]
                </Link>
              }
            />
            </div>
          </Reveal>

          {/* Pending Approvals Queue */}
          <Reveal delay={100}>
            <div className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-4 h-full">
              <div className="flex items-center justify-between font-mono">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-amber-400" />
                  PENDING WRITE APPROVALS
                </h3>
              <Link href="/approvals" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                [ VIEW QUEUE ] <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
              <EmptyState
                title="No pending write approval requests"
                description="When an agent requests a write action requiring human review, it will appear here."
              />
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
