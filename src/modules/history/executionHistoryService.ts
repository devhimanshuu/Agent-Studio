import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { IAuditLogRepository } from "@/repositories/interfaces/IAuditLogRepository";
import { IExecutionLogRepository } from "@/repositories/interfaces/IExecutionLogRepository";
import { IApprovalRepository } from "@/repositories/interfaces/IApprovalRepository";
import { IApprovalHistoryRepository } from "@/repositories/interfaces/IApprovalHistoryRepository";
import { ExecutionDTO, ExecutionLogDTO, ExecutionQuery, StartExecutionInput } from "@/types/execution";
import { ExecutionService } from "@/services/ExecutionService";
import { logger } from "@/lib/logger";
import { buildExecutionTimeline } from "@/modules/timeline";
import { TimelineEvent } from "@/types/observability";
import { ApprovalRequestDTO } from "@/types/approval";

/** Full detail payload for the execution trace page + JSON export. */
export interface ExecutionDetail {
  execution: ExecutionDTO;
  logs: ExecutionLogDTO[];
  timeline: TimelineEvent[];
  approvals: ApprovalRequestDTO[];
}

/**
 * Execution history + replay. Wraps the execution service so a replay reuses
 * the original skill version + input and creates a NEW execution linked to the
 * previous one (historical records are never modified).
 */
export class ExecutionHistoryService {
  constructor(
    private executionRepo: IExecutionRepository,
    private skillRepo: ISkillRepository,
    private auditRepo: IAuditLogRepository,
    private executionService: ExecutionService,
    private logRepo?: IExecutionLogRepository,
    private approvalRepo?: IApprovalRepository,
    private approvalHistoryRepo?: IApprovalHistoryRepository
  ) {}

  /**
   * Assembles everything the trace page / export needs: the execution row, its
   * structured logs, approval requests + history, and the unified timeline.
   */
  async getDetail(executionId: string, userId: string): Promise<ExecutionDetail | null> {
    const execution = await this.executionRepo.findByIdForUser(executionId, userId);
    if (!execution) return null;

    const [logs, approvals, approvalHistory] = await Promise.all([
      this.logRepo?.findByExecutionId(executionId) ?? [],
      this.approvalRepo?.findByExecutionId(executionId) ?? [],
      this.approvalHistoryRepo?.findByExecutionId(executionId) ?? [],
    ]);

    execution.logs = logs;
    const timeline = buildExecutionTimeline(execution, approvals, approvalHistory);
    return { execution, logs, timeline, approvals };
  }

  /** JSON export payload — the full trace plus export metadata. */
  async exportExecution(executionId: string, userId: string): Promise<{
    exportedAt: string;
    execution: ExecutionDTO;
    logs: ExecutionLogDTO[];
    timeline: TimelineEvent[];
    approvals: ApprovalRequestDTO[];
  } | null> {
    const detail = await this.getDetail(executionId, userId);
    if (!detail) return null;
    return {
      exportedAt: new Date().toISOString(),
      ...detail,
    };
  }

  async list(userId: string, query: ExecutionQuery): Promise<ExecutionDTO[]> {
    return this.executionRepo.listForUser(userId, query);
  }

  /**
   * Replay a previous execution. Reuses its skill version and input, creates a
   * brand-new execution row, and links it back via replayedFromExecutionId.
   * The original execution is never touched.
   */
  async replay(executionId: string, userId: string): Promise<ExecutionDTO> {
    const original = await this.executionRepo.findByIdForUser(executionId, userId);
    if (!original) throw new Error("Execution not found or you do not have access to it");

    // Graph runs persist their node outputs in plannerOutput.state.results.
    // Deterministic replay reuses those recorded LLM outputs so the rerun
    // follows the exact same path without spending tokens on the LLM.
    const planner = original.plannerOutput as Record<string, unknown> | null;
    const state = planner?.graph === true ? (planner.state as { results?: Record<string, unknown> } | undefined) : undefined;
    const replayOutputs = state?.results ?? undefined;

    const started = await this.executionService.startExecution({
      userId,
      skillVersionId: original.skillVersionId,
      inputData: original.inputData,
      ...(replayOutputs ? { replayOutputs } : {}),
    } as StartExecutionInput);

    // Link the new execution back to the original.
    const linked = await this.executionRepo.setReplayedFrom(started.id, executionId);
    await this.auditRepo.log({
      userId,
      executionId: started.id,
      action: "EXECUTION_REPLAYED",
      details: { fromExecutionId: executionId, skillVersionId: original.skillVersionId },
    });
    logger.info({ executionId: started.id, from: executionId, userId }, "Execution replayed");

    return linked;
  }

  /** The execution that a run was replayed from (for the detail UI). */
  async getReplayedFrom(executionId: string, userId: string): Promise<ExecutionDTO | null> {
    const execution = await this.executionRepo.findByIdForUser(executionId, userId);
    if (!execution?.replayedFromExecutionId) return null;
    return this.executionRepo.findByIdForUser(execution.replayedFromExecutionId, userId);
  }
}
