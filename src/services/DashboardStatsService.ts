import { prisma } from "@/lib/prisma";
import { a2aClientService } from "@/services/A2AClientService";
import {
  DashboardStatsDTO,
  TimeRangeFilter,
  SystemHealthDTO,
  TelemetryMetricsDTO,
  LiveExecutionItemDTO,
  AgentGraphCardDTO,
  PinnedSkillDTO,
  ToolLeaderboardItemDTO,
  RagInsightsDTO,
} from "@/types/dashboard";
import { ExecutionDTO } from "@/types/execution";
import { ApprovalRequestDTO } from "@/types/approval";

export class DashboardStatsService {
  async getDashboardStats(userId: string, timeRange: TimeRangeFilter = "7d"): Promise<DashboardStatsDTO> {
    if (!userId) {
      return this.getEmptyStats(timeRange);
    }

    const rangeDate = this.getDateForRange(timeRange);

    const [
      // System Health
      mcpServersTotal,
      mcpServersConnected,
      openApiIntegrationsCount,
      ragDocumentsCount,
      ragChunksCount,
      vaultSecretsCount,
      toolDefs,
      // Skills & Graphs
      userSkills,
      // Executions
      rangeExecutions,
      liveExecutionsRaw,
      allExecutionsCount,
      providerGroups,
      // Tool Calls
      rangeToolCalls,
      // Approvals
      pendingApprovalsRaw,
      // Audit Logs
      recentAuditLogs,
      // RAG Documents
      recentDocumentsRaw,
      collectionGroups,
    ] = await Promise.all([
      prisma.mcpServer.count({ where: { userId } }),
      prisma.mcpServer.count({ where: { userId, status: "CONNECTED" } }),
      prisma.openApiIntegration.count({ where: { userId } }),
      prisma.document.count({ where: { userId } }),
      prisma.documentChunk.count({ where: { document: { userId } } }),
      prisma.vaultEntry.count({ where: { userId } }),
      prisma.toolDefinition.findMany({}),

      prisma.skill.findMany({
        where: { userId },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 2,
          },
        },
        orderBy: { updatedAt: "desc" },
      }),

      prisma.execution.findMany({
        where: {
          userId,
          ...(rangeDate ? { startedAt: { gte: rangeDate } } : {}),
        },
        include: {
          steps: { orderBy: { stepNumber: "asc" } },
          toolCalls: { orderBy: { executedAt: "asc" } },
        },
        orderBy: { startedAt: "desc" },
        take: 100,
      }),

      prisma.execution.findMany({
        where: {
          userId,
          status: { in: ["RUNNING", "PAUSED_FOR_APPROVAL", "PENDING"] },
        },
        include: {
          steps: { orderBy: { stepNumber: "desc" }, take: 1 },
          toolCalls: { orderBy: { executedAt: "desc" }, take: 1 },
        },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),

      prisma.execution.count({ where: { userId } }),

      prisma.execution.groupBy({
        by: ["provider"],
        where: {
          userId,
          provider: { not: null },
          ...(rangeDate ? { startedAt: { gte: rangeDate } } : {}),
        },
        _count: { _all: true },
        orderBy: { _count: { provider: "desc" } },
        take: 5,
      }),

      prisma.toolCall.findMany({
        where: {
          execution: {
            userId,
            ...(rangeDate ? { startedAt: { gte: rangeDate } } : {}),
          },
        },
        select: {
          toolName: true,
          status: true,
          durationMs: true,
        },
      }),

      prisma.approvalRequest.findMany({
        where: { userId, status: "PENDING" },
        orderBy: { requestedAt: "desc" },
        take: 10,
      }),

      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { timestamp: "desc" },
        take: 6,
      }),

      prisma.document.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: {
          id: true,
          title: true,
          collection: true,
          chunkCount: true,
          updatedAt: true,
        },
      }),

      prisma.document.groupBy({
        by: ["collection"],
        where: { userId },
        _count: { _all: true },
        _sum: { chunkCount: true },
        orderBy: { _count: { collection: "desc" } },
        take: 5,
      }),
    ]);

    // 1. System Health
    const a2aPresets = a2aClientService.listPresets();
    const systemHealth: SystemHealthDTO = {
      mcpServersTotal,
      mcpServersConnected,
      openApiIntegrationsCount,
      ragDocumentsCount,
      ragChunksCount,
      vaultSecretsCount,
      permittedToolsCount: toolDefs.length,
      a2aAgentsCount: a2aPresets.length,
    };

    // 2. Telemetry & Metrics
    const statusCounts: Record<string, number> = {
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
      PAUSED_FOR_APPROVAL: 0,
      RUNNING: 0,
      STEP_LIMIT_EXCEEDED: 0,
    };

    let totalDurationMs = 0;
    let durationCount = 0;

    for (const exec of rangeExecutions) {
      statusCounts[exec.status] = (statusCounts[exec.status] ?? 0) + 1;
      if (exec.durationMs != null && exec.durationMs > 0) {
        totalDurationMs += exec.durationMs;
        durationCount++;
      }
    }

    const totalRangeExecs = rangeExecutions.length;
    const completedCount = statusCounts["COMPLETED"] ?? 0;
    const failedCount = (statusCounts["FAILED"] ?? 0) + (statusCounts["STEP_LIMIT_EXCEEDED"] ?? 0);
    const terminalCount = completedCount + failedCount;
    const successRate = terminalCount > 0 ? Math.round((completedCount / terminalCount) * 100) : 100;
    const avgDurationMs = durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0;

    const providerBreakdown = providerGroups.map((p) => ({
      provider: p.provider || "Standard",
      count: p._count._all,
    }));

    const telemetry: TelemetryMetricsDTO = {
      totalExecutions: totalRangeExecs > 0 ? totalRangeExecs : allExecutionsCount,
      completed: completedCount,
      failed: failedCount,
      cancelled: statusCounts["CANCELLED"] ?? 0,
      paused: statusCounts["PAUSED_FOR_APPROVAL"] ?? 0,
      running: statusCounts["RUNNING"] ?? 0,
      successRate,
      failureRate: 100 - successRate,
      avgDurationMs,
      statusBreakdown: statusCounts,
      providerBreakdown,
    };

    // 3. Live / In-flight executions
    const liveExecutions: LiveExecutionItemDTO[] = liveExecutionsRaw.map((e) => {
      const latestTool = e.toolCalls[0];
      return {
        id: e.id,
        skillName: e.skillName || "Agent Workflow",
        status: e.status,
        provider: e.provider,
        startedAt: e.startedAt.toISOString(),
        stepCount: e.stepCount,
        maxSteps: e.maxSteps,
        currentToolName: latestTool?.toolName,
        currentAction: latestTool?.action,
      };
    });

    // 4. Skills, Canvas Graphs, Pinned Skills
    const activeSkills = userSkills.filter((s) => s.status !== "ARCHIVED");
    const publishedSkills = userSkills.filter((s) => s.status === "PUBLISHED");

    const agentGraphs: AgentGraphCardDTO[] = [];
    const pinnedSkills: PinnedSkillDTO[] = [];

    for (const skill of activeSkills) {
      const version = skill.versions[0];
      if (!version) continue;

      const graph = version.graphDefinition as { nodes?: unknown[]; edges?: unknown[] } | null;
      if (graph && Array.isArray(graph.nodes) && graph.nodes.length > 0) {
        const nodeTypes = new Set<string>();
        for (const n of graph.nodes as { type?: string }[]) {
          if (n.type) nodeTypes.add(n.type);
        }
        agentGraphs.push({
          id: skill.id,
          name: skill.name,
          purpose: skill.purpose,
          versionNumber: version.versionNumber,
          nodeCount: graph.nodes.length,
          edgeCount: Array.isArray(graph.edges) ? graph.edges.length : 0,
          nodeTypes: Array.from(nodeTypes),
          updatedAt: skill.updatedAt.toISOString(),
        });
      }

      if (pinnedSkills.length < 4) {
        pinnedSkills.push({
          id: skill.id,
          name: skill.name,
          purpose: skill.purpose,
          versionId: version.id,
          versionNumber: version.versionNumber,
          inputSchema: (version.inputSchema as Record<string, unknown>) ?? {},
          examples: (version.examples as { input: Record<string, unknown>; output?: Record<string, unknown> }[]) ?? [],
          allowedTools: (version.allowedTools as string[]) ?? [],
        });
      }
    }

    // 5. Tool Leaderboard
    const toolStatsMap = new Map<
      string,
      { count: number; durationSum: number; durationCount: number; errorCount: number }
    >();

    for (const tc of rangeToolCalls) {
      const existing = toolStatsMap.get(tc.toolName) ?? {
        count: 0,
        durationSum: 0,
        durationCount: 0,
        errorCount: 0,
      };
      existing.count++;
      if (tc.durationMs != null && tc.durationMs > 0) {
        existing.durationSum += tc.durationMs;
        existing.durationCount++;
      }
      if (tc.status === "ERROR" || tc.status === "BLOCKED" || tc.status === "REJECTED") {
        existing.errorCount++;
      }
      toolStatsMap.set(tc.toolName, existing);
    }

    const toolDefMap = new Map(toolDefs.map((t) => [t.name, t]));

    const toolLeaderboard: ToolLeaderboardItemDTO[] = Array.from(toolStatsMap.entries())
      .map(([name, stats]) => {
        const def = toolDefMap.get(name);
        const avgDuration = stats.durationCount > 0 ? Math.round(stats.durationSum / stats.durationCount) : 0;
        const errorRate = stats.count > 0 ? Math.round((stats.errorCount / stats.count) * 100) : 0;
        return {
          toolName: name,
          displayName: def?.displayName || name,
          category: def?.category || "COMPUTE",
          type: (def?.type as "READ" | "WRITE") || "READ",
          callCount: stats.count,
          avgDurationMs: avgDuration,
          errorCount: stats.errorCount,
          errorRate,
        };
      })
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 6);

    // Fallback if no tool calls yet: list top system tool definitions
    if (toolLeaderboard.length === 0 && toolDefs.length > 0) {
      for (const def of toolDefs.slice(0, 5)) {
        toolLeaderboard.push({
          toolName: def.name,
          displayName: def.displayName,
          category: def.category || "SYSTEM",
          type: def.type as "READ" | "WRITE",
          callCount: 0,
          avgDurationMs: 0,
          errorCount: 0,
          errorRate: 0,
        });
      }
    }

    // 6. RAG Insights
    const topCollections = collectionGroups.map((cg) => ({
      collection: cg.collection || "default",
      documentCount: cg._count._all,
      chunkCount: cg._sum.chunkCount ?? 0,
    }));

    const ragInsights: RagInsightsDTO = {
      totalCollections: collectionGroups.length,
      totalDocuments: ragDocumentsCount,
      totalChunks: ragChunksCount,
      topCollections,
      recentDocuments: recentDocumentsRaw.map((d) => ({
        id: d.id,
        title: d.title,
        collection: d.collection,
        chunkCount: d.chunkCount,
        updatedAt: d.updatedAt.toISOString(),
      })),
    };

    // 7. Pending Approvals
    const pendingApprovals: ApprovalRequestDTO[] = pendingApprovalsRaw.map((a) => ({
      id: a.id,
      executionId: a.executionId,
      userId: a.userId,
      skillName: a.skillName,
      plannerReason: a.plannerReason,
      toolName: a.toolName,
      action: a.action,
      inputPayload: a.inputPayload as Record<string, unknown>,
      status: a.status,
      idempotencyKey: a.idempotencyKey,
      requestedAt: a.requestedAt,
      respondedAt: a.respondedAt,
      rejectionReason: a.rejectionReason,
    }));

    // 8. Recent Executions (mapped to ExecutionDTO)
    const recentExecutions: ExecutionDTO[] = rangeExecutions.slice(0, 6).map((e) => ({
      id: e.id,
      userId: e.userId,
      skillVersionId: e.skillVersionId,
      skillName: e.skillName,
      replayedFromExecutionId: e.replayedFromExecutionId,
      status: e.status,
      inputData: e.inputData as Record<string, unknown>,
      finalOutput: e.finalOutput as Record<string, unknown> | null,
      plannerOutput: e.plannerOutput as Record<string, unknown> | null,
      provider: e.provider,
      durationMs: e.durationMs,
      stepCount: e.stepCount,
      maxSteps: e.maxSteps,
      errorMessage: e.errorMessage,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      steps: (e.steps || []).map((s) => ({
        id: s.id,
        executionId: s.executionId,
        stepNumber: s.stepNumber,
        nodeName: s.nodeName,
        stateSnapshot: s.stateSnapshot as Record<string, unknown>,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
      toolCalls: (e.toolCalls || []).map((t) => ({
        id: t.id,
        executionId: t.executionId,
        stepId: t.stepId,
        toolName: t.toolName,
        action: t.action,
        inputArgs: t.inputArgs as Record<string, unknown>,
        outputResult: t.outputResult as Record<string, unknown> | null,
        status: t.status as "SUCCESS" | "ERROR" | "BLOCKED" | "REJECTED",
        errorMessage: t.errorMessage,
        durationMs: t.durationMs,
        executedAt: t.executedAt,
      })),
    }));

    // 9. Recent Activity
    const recentActivity = recentAuditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      details: (a.details as Record<string, unknown>) ?? {},
      timestamp: a.timestamp.toISOString(),
    }));

    return {
      timeRange,
      systemHealth,
      telemetry,
      liveExecutions,
      agentGraphs,
      pinnedSkills,
      toolLeaderboard,
      ragInsights,
      pendingApprovals,
      recentExecutions,
      recentActivity,
      totalSkillsCount: activeSkills.length,
      publishedSkillsCount: publishedSkills.length,
    };
  }

  private getDateForRange(range: TimeRangeFilter): Date | null {
    const now = new Date();
    if (range === "24h") {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    if (range === "7d") {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    if (range === "30d") {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    return null; // "all"
  }

  private getEmptyStats(timeRange: TimeRangeFilter): DashboardStatsDTO {
    return {
      timeRange,
      systemHealth: {
        mcpServersTotal: 0,
        mcpServersConnected: 0,
        openApiIntegrationsCount: 0,
        ragDocumentsCount: 0,
        ragChunksCount: 0,
        vaultSecretsCount: 0,
        permittedToolsCount: 0,
        a2aAgentsCount: 0,
      },
      telemetry: {
        totalExecutions: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        paused: 0,
        running: 0,
        successRate: 100,
        failureRate: 0,
        avgDurationMs: 0,
        statusBreakdown: {},
        providerBreakdown: [],
      },
      liveExecutions: [],
      agentGraphs: [],
      pinnedSkills: [],
      toolLeaderboard: [],
      ragInsights: {
        totalCollections: 0,
        totalDocuments: 0,
        totalChunks: 0,
        topCollections: [],
        recentDocuments: [],
      },
      pendingApprovals: [],
      recentExecutions: [],
      recentActivity: [],
      totalSkillsCount: 0,
      publishedSkillsCount: 0,
    };
  }
}
