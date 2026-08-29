"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { DashboardStatsDTO, TimeRangeFilter } from "@/types/dashboard";
import { dashboardApi } from "@/lib/api/dashboard";
import { Reveal } from "@/components/Reveal";
import { SystemHealthStrip } from "./SystemHealthStrip";
import { LiveExecutionTracker } from "./LiveExecutionTracker";
import { QuickActionHub } from "./QuickActionHub";
import { QuickRunSkillModal } from "./QuickRunSkillModal";
import { TelemetryMetricsGrid } from "./TelemetryMetricsGrid";
import { PinnedSkillsLaunchpad } from "./PinnedSkillsLaunchpad";
import { MultiAgentCanvasShowcase } from "./MultiAgentCanvasShowcase";
import { KnowledgeBaseCard } from "./KnowledgeBaseCard";
import { ToolPerformanceLeaderboard } from "./ToolPerformanceLeaderboard";
import { EnhancedApprovalQueue } from "./EnhancedApprovalQueue";
import { RecentExecutionsCard, SystemAuditActivityCard } from "./RecentExecutionsAndActivity";

interface DashboardClientViewProps {
  initialStats: DashboardStatsDTO;
}

export function DashboardClientView({ initialStats }: DashboardClientViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>(initialStats.timeRange || "7d");
  const [quickRunModalOpen, setQuickRunModalOpen] = useState(false);
  const [selectedSkillForRun, setSelectedSkillForRun] = useState<string | undefined>(undefined);

  const {
    data: stats,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["dashboardStats", timeRange],
    queryFn: () => dashboardApi.getStats(timeRange),
    initialData: initialStats,
    refetchInterval: 12000, // 12-second live pulse auto-refresh
  });

  const handleOpenQuickRun = (skillId?: string) => {
    setSelectedSkillForRun(skillId);
    setQuickRunModalOpen(true);
  };

  const ranges: { id: TimeRangeFilter; label: string }[] = [
    { id: "24h", label: "24H" },
    { id: "7d", label: "7D" },
    { id: "30d", label: "30D" },
    { id: "all", label: "ALL" },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 w-full max-w-[1600px] mx-auto pb-12">
      {/* 1. Header with Controls & Action Hub */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-5">
        <Reveal delay={0}>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">
                MISSION CONTROL DASHBOARD
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                LIVE OPS
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              Real-time multi-agent orchestration, telemetry, RAG knowledge & tool reliability.
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Time Range Filter Bar */}
            <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-white/80 dark:bg-black/50 p-1 text-xs font-mono shadow-sm">
              {ranges.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setTimeRange(r.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    timeRange === r.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={() => refetch()}
              title="Refresh telemetry"
              disabled={isRefetching}
              className="p-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-white/80 dark:bg-black/50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 transition-all cursor-pointer shadow-sm"
            >
              <RotateCw className={`h-4 w-4 ${isRefetching ? "animate-spin text-indigo-500" : ""}`} />
            </button>

            {/* Quick Action Hub */}
            <QuickActionHub onOpenQuickRun={() => handleOpenQuickRun()} />
          </div>
        </Reveal>
      </div>

      {/* 2. System Health & Integration Strip */}
      <Reveal delay={100}>
        <SystemHealthStrip health={stats.systemHealth} />
      </Reveal>

      {/* 3. Live Active In-flight Executions Monitor */}
      <Reveal delay={150}>
        <LiveExecutionTracker liveExecutions={stats.liveExecutions} />
      </Reveal>

      {/* 4. High-Level Telemetry & Operational Metrics */}
      <Reveal delay={200}>
        <TelemetryMetricsGrid
          telemetry={stats.telemetry}
          activeSkillsCount={stats.totalSkillsCount}
          publishedSkillsCount={stats.publishedSkillsCount}
          agentGraphsCount={stats.agentGraphs.length}
          pendingApprovalsCount={stats.pendingApprovals.length}
        />
      </Reveal>

      {/* 5. Pinned Skills & 1-Click Launchpad */}
      <Reveal delay={250}>
        <PinnedSkillsLaunchpad
          skills={stats.pinnedSkills}
          onQuickRun={(skillId) => handleOpenQuickRun(skillId)}
        />
      </Reveal>

      {/* 6. Multi-Agent Canvas Architectures Showcase */}
      <Reveal delay={300}>
        <MultiAgentCanvasShowcase agentGraphs={stats.agentGraphs} />
      </Reveal>

      {/* 7. Knowledge Base (RAG) & Tool Performance Leaderboard */}
      <Reveal delay={350}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <KnowledgeBaseCard insights={stats.ragInsights} />
          <ToolPerformanceLeaderboard tools={stats.toolLeaderboard} />
        </div>
      </Reveal>

      {/* 8. Human Review Queue, Recent Executions & System Audit (Equal 3-Column Grid) */}
      <Reveal delay={400}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <EnhancedApprovalQueue approvals={stats.pendingApprovals} />
          <RecentExecutionsCard executions={stats.recentExecutions} />
          <SystemAuditActivityCard activity={stats.recentActivity} />
        </div>
      </Reveal>

      {/* 9. Interactive Quick Run Modal */}
      <QuickRunSkillModal
        isOpen={quickRunModalOpen}
        onClose={() => setQuickRunModalOpen(false)}
        skills={stats.pinnedSkills}
        initialSkillId={selectedSkillForRun}
      />
    </div>
  );
}
