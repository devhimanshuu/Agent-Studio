"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  Network,
  Play,
  TrendingUp,
  TrendingDown,
  Timer,
  Shield,
  ArrowUpRight,
} from "lucide-react";
import { TelemetryMetricsDTO } from "@/types/dashboard";

interface TelemetryMetricsGridProps {
  telemetry: TelemetryMetricsDTO;
  activeSkillsCount: number;
  publishedSkillsCount: number;
  agentGraphsCount: number;
  pendingApprovalsCount: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function TelemetryMetricsGrid({
  telemetry,
  activeSkillsCount,
  publishedSkillsCount,
  agentGraphsCount,
  pendingApprovalsCount,
}: TelemetryMetricsGridProps) {
  const avgSec = (telemetry.avgDurationMs / 1000).toFixed(2);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 font-mono">
      {/* 1. Active Skills */}
      <Link
        href="/dashboard/skills"
        className="group p-5 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:border-indigo-400 dark:hover:border-indigo-500/50 shadow-sm hover:shadow-xl transition-all h-full"
      >
        <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-xs tracking-wider uppercase font-semibold">
          <span>ACTIVE SKILLS</span>
          <div className="flex items-center gap-1">
            <Sparkles className="h-4 w-4" />
            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="text-3xl font-pixel text-slate-900 dark:text-slate-100">
          {pad(activeSkillsCount)}
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
          {pad(publishedSkillsCount)} Published & Immutable
        </p>
      </Link>

      {/* 2. Multi-Agent Graphs */}
      <Link
        href="/dashboard/canvas"
        className="group p-5 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:border-violet-400 dark:hover:border-violet-500/50 shadow-sm hover:shadow-xl transition-all h-full"
      >
        <div className="flex items-center justify-between text-violet-700 dark:text-violet-400 text-xs tracking-wider uppercase font-semibold">
          <span>AGENT CANVASES</span>
          <div className="flex items-center gap-1">
            <Network className="h-4 w-4" />
            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="text-3xl font-pixel text-slate-900 dark:text-slate-100">
          {pad(agentGraphsCount)}
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
          Visual Multi-Agent Graphs
        </p>
      </Link>

      {/* 3. Total Executions */}
      <Link
        href="/dashboard/executions"
        className="group p-5 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:border-emerald-400 dark:hover:border-emerald-500/50 shadow-sm hover:shadow-xl transition-all h-full"
      >
        <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs tracking-wider uppercase font-semibold">
          <span>EXECUTIONS</span>
          <div className="flex items-center gap-1">
            <Play className="h-4 w-4" />
            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="text-3xl font-pixel text-slate-900 dark:text-slate-100">
          {pad(telemetry.totalExecutions)}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium pt-0.5">
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{telemetry.completed} OK</span>
          <span>·</span>
          <span className={telemetry.failed > 0 ? "text-red-500 font-semibold" : "text-slate-400"}>
            {telemetry.failed} Fail
          </span>
        </div>
      </Link>

      {/* 4. Success Rate */}
      <div className="p-5 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:border-cyan-400 dark:hover:border-cyan-500/50 shadow-sm hover:shadow-xl transition-all h-full">
        <div className="flex items-center justify-between text-cyan-700 dark:text-cyan-400 text-xs tracking-wider uppercase font-semibold">
          <span>SUCCESS RATE</span>
          {telemetry.successRate >= 80 ? (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </div>
        <div className="text-3xl font-pixel text-slate-900 dark:text-slate-100">
          {telemetry.successRate}%
        </div>
        <div className="w-full bg-slate-200 dark:bg-indigo-950 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              telemetry.successRate >= 90
                ? "bg-emerald-500"
                : telemetry.successRate >= 70
                ? "bg-amber-500"
                : "bg-red-500"
            }`}
            style={{ width: `${Math.min(Math.max(telemetry.successRate, 5), 100)}%` }}
          />
        </div>
      </div>

      {/* 5. Avg Latency */}
      <div className="p-5 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-2 hover:border-indigo-400 dark:hover:border-indigo-500/50 shadow-sm hover:shadow-xl transition-all h-full">
        <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-xs tracking-wider uppercase font-semibold">
          <span>AVG LATENCY</span>
          <Timer className="h-4 w-4" />
        </div>
        <div className="text-3xl font-pixel text-slate-900 dark:text-slate-100">
          {avgSec}s
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
          Wall-Clock Run Duration
        </p>
      </div>

      {/* 6. Human Review Queue */}
      <Link
        href="/dashboard/review"
        className={`group p-5 rounded-lg border space-y-2 shadow-sm hover:shadow-xl transition-all h-full ${
          pendingApprovalsCount > 0
            ? "border-amber-400/80 dark:border-amber-500/50 bg-amber-50/50 dark:bg-[#0a0a0a]/80 hover:border-amber-400"
            : "border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 hover:border-indigo-400"
        }`}
      >
        <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs tracking-wider uppercase font-semibold">
          <span>REVIEW QUEUE</span>
          <div className="flex items-center gap-1">
            <Shield className="h-4 w-4" />
            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="text-3xl font-pixel text-slate-900 dark:text-slate-100">
          {pad(pendingApprovalsCount)}
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
          {pendingApprovalsCount > 0 ? "Requires Human Approval" : "Queue is Clear"}
        </p>
      </Link>
    </div>
  );
}
