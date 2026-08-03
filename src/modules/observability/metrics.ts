import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { ObservabilityMetrics } from "@/types/observability";

/**
 * Computes the observability widgets (dashboard + /dashboard/history).
 * Aggregates executions + tool calls scoped to the owning user.
 */
export class MetricsService {
  constructor(private executionRepo: IExecutionRepository) {}

  async getMetrics(userId: string): Promise<ObservabilityMetrics> {
    const [exec, toolCounts, approvals] = await Promise.all([
      this.executionRepo.getMetrics(userId),
      this.executionRepo.countToolCallsByTool(userId),
      this.executionRepo.getApprovalSummary(userId),
    ]);

    const completedOrFailed = exec.completed + exec.failed;
    const successRate = completedOrFailed > 0 ? Math.round((exec.completed / completedOrFailed) * 100) : 100;

    const mostUsedTools = Object.entries(toolCounts)
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const executionsByStatus: Record<string, number> = {
      COMPLETED: exec.completed,
      FAILED: exec.failed,
      CANCELLED: exec.cancelled,
      PAUSED_FOR_APPROVAL: exec.paused,
      // total minus known terminal states gives RUNNING + PENDING + STEP_LIMIT_EXCEEDED
      OTHER: exec.total - exec.completed - exec.failed - exec.cancelled - exec.paused,
    };

    return {
      totalExecutions: exec.total,
      successRate,
      failureRate: 100 - successRate,
      avgExecutionTimeMs: exec.avgDurationMs,
      mostUsedSkills: exec.mostUsedSkills,
      mostUsedTools,
      approvalCount: approvals.total,
      pendingApprovalCount: approvals.pending,
      executionsByStatus,
    };
  }
}
