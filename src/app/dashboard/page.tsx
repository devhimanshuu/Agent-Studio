import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Sparkles, Play, Shield, ArrowUpRight, Plus, ScrollText, Gauge } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Reveal } from "@/components/Reveal";
import { SkillRepository } from "@/repositories/SkillRepository";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { ToolDefinitionRepository } from "@/repositories/ToolDefinitionRepository";
import { StatusBadge } from "@/components/skills/StatusBadge";
import { ExecutionStatusBadge } from "@/components/executions/ExecutionStatusBadge";

const pad = (n: number) => String(n).padStart(2, "0");

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default async function DashboardPage() {
  const { userId } = await auth();

  const skillRepo = new SkillRepository();
  const executionRepo = new ExecutionRepository();
  const approvalRepo = new ApprovalRepository();
  const auditRepo = new AuditLogRepository();
  const toolRepo = new ToolDefinitionRepository();

  const [skillResult, executions, pendingApprovals, toolCount, auditLogs, toolUsage] = userId
    ? await Promise.all([
        skillRepo.list(userId, {}),
        executionRepo.findByUserId(userId),
        approvalRepo.findPendingByUserId(userId),
        toolRepo.count(),
        auditRepo.findByUserId(userId),
        executionRepo.countToolCallsByTool(userId),
      ])
    : [{ items: [], total: 0 }, [], [], 0, [], {} as Record<string, number>];

  const activeSkills = skillResult.items.filter((s) => s.status !== "ARCHIVED");
  const publishedSkills = skillResult.items.filter((s) => s.status === "PUBLISHED");
  const recentSkills = [...activeSkills]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 5);
  const recentExecutions = [...executions].slice(0, 5);

  // Most-used tool: highest usage count across the user's executions.
  const mostUsedTool = Object.entries(toolUsage).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const mostUsedToolCount = mostUsedTool !== "—" ? (toolUsage[mostUsedTool] ?? 0) : 0;

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
            href="/dashboard/skills"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all text-xs font-mono"
          >
            <Plus className="h-4 w-4" />
            CREATE NEW SKILL
          </Link>
        </Reveal>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 font-mono">
        <Reveal delay={0}>
          <div className="p-5 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-2 hover:border-indigo-500/50 transition-all h-full">
            <div className="flex items-center justify-between text-indigo-400 text-xs tracking-wider uppercase">
              <span>ACTIVE SKILLS</span>
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-3xl font-pixel text-slate-100">{pad(activeSkills.length)}</div>
            <p className="text-[11px] text-slate-400">Draft & Published Skills</p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <Link
            href="/dashboard/skills"
            className="block p-5 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-2 hover:border-indigo-500/50 transition-all h-full"
          >
            <div className="flex items-center justify-between text-indigo-300 text-xs tracking-wider uppercase">
              <span>PUBLISHED</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
            <div className="text-3xl font-pixel text-slate-100">{pad(publishedSkills.length)}</div>
            <p className="text-[11px] text-slate-400">Immutable Released Versions</p>
          </Link>
        </Reveal>

        <Reveal delay={160}>
          <Link
            href="/dashboard/executions"
            className="group block p-5 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-2 hover:border-emerald-500/50 transition-all h-full"
          >
            <div className="flex items-center justify-between text-emerald-400 text-xs tracking-wider uppercase">
              <span>EXECUTIONS</span>
              <div className="flex items-center gap-1.5">
                <Play className="h-4 w-4" />
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
            </div>
            <div className="text-3xl font-pixel text-slate-100">{pad(executions.length)}</div>
            <p className="text-[11px] text-slate-400">Agent Step Runs</p>
          </Link>
        </Reveal>

        <Reveal delay={240}>
          <Link
            href="/dashboard/review"
            className="block p-5 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-2 hover:border-amber-500/50 hover:bg-[#0d0d0d]/80 transition-all h-full group"
          >
            <div className="flex items-center justify-between text-amber-400 text-xs tracking-wider uppercase">
              <span>REVIEW QUEUE</span>
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
            </div>
            <div className="text-3xl font-pixel text-slate-100">{pad(pendingApprovals.length)}</div>
            <p className="text-[11px] text-slate-400">Requires Human Review</p>
          </Link>
        </Reveal>

        <Reveal delay={320}>
          <Link
            href="/dashboard/tools"
            className="block p-5 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-2 hover:border-indigo-500/50 hover:bg-[#0d0d0d]/80 transition-all h-full group"
          >
            <div className="flex items-center justify-between text-indigo-300 text-xs tracking-wider uppercase">
              <span>PERMITTED TOOLS</span>
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
            </div>
            <div className="text-3xl font-pixel text-slate-100">{pad(toolCount)}</div>
            <p className="text-[11px] text-slate-400">System Tool Definitions</p>
          </Link>
        </Reveal>

        <Reveal delay={400}>
          <Link
            href="/dashboard/tools"
            className="block p-5 rounded border border-indigo-900/50 bg-[#0a0a0a]/80 space-y-2 hover:border-cyan-500/50 hover:bg-[#0d0d0d]/80 transition-all h-full group"
          >
            <div className="flex items-center justify-between text-cyan-400 text-xs tracking-wider uppercase">
              <span>MOST USED TOOL</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </div>
            <div className="text-lg font-pixel text-slate-100 truncate" title={mostUsedTool}>
              {mostUsedTool.toUpperCase()}
            </div>
            <p className="text-[11px] text-slate-400">{pad(mostUsedToolCount)} Invocations</p>
          </Link>
        </Reveal>
      </div>

      {/* Section Divider with Monospace Tag */}
      <div className="border-t border-indigo-950/80 pt-6">
        <Reveal delay={0}>
          <div className="text-xs font-mono text-indigo-400/80 uppercase tracking-widest mb-6">
            // RECENT EXECUTIONS · RECENT ACTIVITY & REVIEW QUEUE
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Executions */}
          <Reveal delay={0}>
            <div className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-4 h-full">
              <div className="flex items-center justify-between font-mono">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Play className="h-4 w-4 text-emerald-400" />
                  RECENT EXECUTIONS
                </h3>
                <Link href="/dashboard/executions" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  [ VIEW ALL ] <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {recentExecutions.length === 0 ? (
                <EmptyState
                  title="No executions yet"
                  description="Run a published skill to see its execution trace and timeline here."
                  action={
                    <Link
                      href="/dashboard/skills"
                      className="px-3 py-1.5 rounded border border-indigo-500/40 bg-indigo-950/40 text-xs font-mono text-indigo-300 hover:border-indigo-400 transition-colors"
                    >
                      [ BROWSE SKILLS ]
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-indigo-950/60">
                  {recentExecutions.map((e) => (
                    <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-mono text-slate-200 truncate">
                          {e.skillName ?? "Unknown skill"}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {e.provider ?? "—"} · {formatTime(e.startedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <ExecutionStatusBadge status={e.status} />
                        <Link
                          href={`/dashboard/executions/${e.id}`}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                        >
                          [ TRACE ] <ArrowUpRight className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>

          {/* Recent Activity */}
          <Reveal delay={100}>
            <div className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-4 h-full">
              <div className="flex items-center justify-between font-mono">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-indigo-400" />
                  RECENT ACTIVITY
                </h3>
                <Link href="/dashboard/audit" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  [ FULL AUDIT ] <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {auditLogs.length === 0 ? (
                <EmptyState
                  title="No activity recorded"
                  description="Skill edits, publishes, executions, and approvals will appear here as an audit trail."
                />
              ) : (
                <ul className="divide-y divide-indigo-950/60">
                  {auditLogs.slice(0, 5).map((a) => (
                    <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-mono text-slate-200 truncate">{a.action}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {formatDate(a.timestamp)} · {formatTime(a.timestamp)}
                        </div>
                      </div>
                      <Gauge className="h-3.5 w-3.5 text-indigo-500/60 shrink-0" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>

          {/* Recent Skills */}
          <Reveal delay={0}>
            <div className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-4 h-full">
              <div className="flex items-center justify-between font-mono">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  RECENT SKILLS
                </h3>
                <Link href="/dashboard/skills" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  [ VIEW ALL ] <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {recentSkills.length === 0 ? (
                <EmptyState
                  title="No skills defined yet"
                  description="Create your first reusable AI Skill with input/output JSON schemas and permitted tools."
                  action={
                    <Link
                      href="/dashboard/skills/new"
                      className="px-3 py-1.5 rounded border border-indigo-500/40 bg-indigo-950/40 text-xs font-mono text-indigo-300 hover:border-indigo-400 transition-colors"
                    >
                      [ CREATE SKILL ]
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-indigo-950/60">
                  {recentSkills.map((s) => (
                    <li key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-mono text-slate-200 truncate">{s.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          v{s.currentDraft?.versionNumber ?? s.publishedVersion?.versionNumber ?? 1}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <StatusBadge status={s.status} />
                        <Link
                          href={`/dashboard/skills/${s.id}`}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                        >
                          [ OPEN ] <ArrowUpRight className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>

          {/* Pending Approvals Queue */}
          <Reveal delay={100}>
            <div className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-4 h-full">
              <div className="flex items-center justify-between font-mono">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-400" />
                  HUMAN REVIEW QUEUE
                </h3>
                <Link href="/dashboard/review" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  [ VIEW QUEUE ] <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {pendingApprovals.length === 0 ? (
                <EmptyState
                  title="No pending review requests"
                  description="When an agent requests a write action requiring human review, it will appear here."
                />
              ) : (
                <ul className="divide-y divide-indigo-950/60">
                  {pendingApprovals.map((a) => (
                    <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-mono text-slate-200 truncate">
                          {a.toolName} · {a.action}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          REQUESTED {formatDate(a.requestedAt)}
                        </div>
                      </div>
                      <Link
                        href="/dashboard/review"
                        className="text-[10px] text-amber-400 hover:text-amber-300 shrink-0"
                      >
                        [ REVIEW ]
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
