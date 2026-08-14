import { IExecutionService } from "./interfaces/IExecutionService";
import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { IAuditLogRepository } from "@/repositories/interfaces/IAuditLogRepository";
import { IApprovalRepository } from "@/repositories/interfaces/IApprovalRepository";
import { IApprovalHistoryRepository } from "@/repositories/interfaces/IApprovalHistoryRepository";
import { IExecutionLogRepository } from "@/repositories/interfaces/IExecutionLogRepository";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { ApprovalHistoryRepository } from "@/repositories/ApprovalHistoryRepository";
import { ExecutionLogRepository } from "@/repositories/ExecutionLogRepository";
import { ApprovalEngine } from "@/modules/approval";
import { ExecutionDTO, StartExecutionInput } from "@/types/execution";
import { LLMProvider, getLLMProvider } from "@/providers/llm";
import { ExecutionPlan, ToolCallRecord } from "@/modules/execution/state/agentState";
import { ExecutionEngine, EngineRunResult } from "@/modules/execution/executor/executionEngine";
import { CancellationManager } from "@/modules/execution/executor/cancellation";
import { createToolRegistry } from "@/modules/tools";
import { PermissionChecker } from "@/modules/execution/tool-registry/permissionChecker";
import { PlannerService } from "@/modules/execution/planner/plannerService";
import {
  validateSkillForExecution,
  validateVersionForExecution,
  validateUserInput,
} from "@/modules/execution/executor/validation";
import { InvalidSkillError } from "@/modules/execution/executor/errors";
import { logger } from "@/lib/logger";

export interface ExecutionServiceDeps {
  /** Injected LLM (router) — defaults to the env-configured failover router. */
  llm?: LLMProvider;
  /** Injected engine (tests) — defaults to a graph-first ExecutionEngine. */
  engine?: ExecutionEngine;
  cancellations?: CancellationManager;
  /** Persists HITL approval requests created when runs pause. */
  approvalRepo?: IApprovalRepository;
  /** Approval engine for HITL lifecycle management. */
  approvalEngine?: ApprovalEngine;
  /** Persists structured execution logs (observability). */
  logRepo?: IExecutionLogRepository;
}

export class ExecutionService implements IExecutionService {
  private cancellations: CancellationManager;
  private engine: ExecutionEngine;
  private approvalEngine: ApprovalEngine;

  constructor(
    private executionRepo: IExecutionRepository,
    private skillRepo: ISkillRepository,
    private auditRepo: IAuditLogRepository,
    deps: ExecutionServiceDeps = {}
  ) {
    this.cancellations = deps.cancellations ?? new CancellationManager();
    const llm = deps.llm ?? getLLMProvider();
    const approvalRepo = deps.approvalRepo ?? new ApprovalRepository();
    const historyRepo = new ApprovalHistoryRepository();

    this.approvalEngine =
      deps.approvalEngine ?? new ApprovalEngine(approvalRepo, historyRepo, this.executionRepo);

    this.engine =
      deps.engine ??
      new ExecutionEngine({
        // Registry pre-loaded with the built-in tools (calculator, document
        // search, record lookup, mock task creator). New tools self-register
        // here via the tools module — zero runtime changes.
        toolRegistry: createToolRegistry(),
        permissionChecker: new PermissionChecker(),
        planner: new PlannerService(llm),
        executionRepo: this.executionRepo,
        approvalRepo,
        logRepo: deps.logRepo ?? new ExecutionLogRepository(),
      });
  }

  async getExecution(id: string): Promise<ExecutionDTO | null> {
    return this.executionRepo.findById(id);
  }

  async getExecutionForUser(id: string, userId: string): Promise<ExecutionDTO | null> {
    return this.executionRepo.findByIdForUser(id, userId);
  }

  async getUserExecutions(userId: string): Promise<ExecutionDTO[]> {
    return this.executionRepo.findByUserId(userId);
  }

  /**
   * Loads the skill + version, validates, creates the execution row, runs the
   * graph-first engine, and persists the terminal state.
   */
  async startExecution(input: StartExecutionInput): Promise<ExecutionDTO> {
    const version = await this.skillRepo.findVersionById(input.skillVersionId);
    if (!version) throw new InvalidSkillError("Skill version not found");
    const skill = await this.skillRepo.findByIdForUser(version.skillId, input.userId);
    if (!skill) throw new InvalidSkillError("Skill not found or you do not have access to it");

    validateSkillForExecution(skill);
    validateVersionForExecution(version);
    validateUserInput(input.inputData, version);

    const execution = await this.executionRepo.create(input, version.maxExecutionSteps || 10, skill.name);
    await this.auditRepo.log({
      userId: input.userId,
      executionId: execution.id,
      action: "EXECUTION_STARTED",
      details: { skillId: skill.id, skillVersionId: version.id, skillName: skill.name },
    });

    const signal = this.cancellations.create(execution.id);
    let result: EngineRunResult;
    try {
      result = await this.engine.run({
        executionId: execution.id,
        skill,
        version,
        userInput: input.inputData,
        signal,
      });
    } finally {
      // Always release the abort controller, even if the engine threw.
      this.cancellations.dispose(execution.id);
    }

    // Persist the terminal state produced by the graph.
    if (result.status === "COMPLETED") {
      await this.executionRepo.setFinalOutput(execution.id, result.finalOutput ?? {});
    } else if (result.status === "PAUSED_FOR_APPROVAL") {
      await this.executionRepo.updateStatus(execution.id, "PAUSED_FOR_APPROVAL");
    }

    await this.auditRepo.log({
      userId: input.userId,
      executionId: execution.id,
      action:
        result.status === "COMPLETED"
          ? "EXECUTION_COMPLETED"
          : result.status === "CANCELLED"
            ? "EXECUTION_CANCELLED"
            : "EXECUTION_FAILED",
      details: { status: result.status },
    });

    const final = await this.executionRepo.findById(execution.id);
    return final ?? execution;
  }

  async cancelExecution(id: string, userId?: string): Promise<ExecutionDTO> {
    const execution = await this.executionRepo.findById(id);
    if (!execution) throw new Error("Execution not found");

    // Only cancellable while active — never relabel a terminal execution.
    const cancellable =
      execution.status === "PENDING" ||
      execution.status === "RUNNING" ||
      execution.status === "PAUSED_FOR_APPROVAL";
    if (!cancellable) return execution;

    // Abort any in-flight graph run, then persist the terminal state.
    this.cancellations.cancel(id);
    const updated = await this.executionRepo.updateStatus(id, "CANCELLED", "User requested cancellation");
    await this.auditRepo.log({
      // Record the actor — previously the audit row was written with a null
      // userId, making cancellation the only mutation that couldn't be traced
      // back to a user.
      userId,
      executionId: id,
      action: "EXECUTION_CANCELLED",
      details: { reason: "User request" },
    });
    return updated;
  }

  async cancelExecutionForUser(id: string, userId: string): Promise<ExecutionDTO> {
    const execution = await this.executionRepo.findByIdForUser(id, userId);
    if (!execution) throw new Error("Execution not found or you do not have access to it");
    logger.info({ executionId: id, userId }, "Cancelling execution");
    return this.cancelExecution(id, userId);
  }

  async resumeExecution(executionId: string, userId: string): Promise<ExecutionDTO> {
    const execution = await this.executionRepo.findByIdForUser(executionId, userId);
    if (!execution) throw new Error("Execution not found or you do not have access to it");

    if (execution.status === "RUNNING") {
      throw new Error("Execution is already running");
    }

    // Mark status as RUNNING in database before launching graph run to prevent double-resumes
    await this.executionRepo.updateStatus(executionId, "RUNNING");

    // Load the skill and version that were used for this execution.
    const version = await this.skillRepo.findVersionById(execution.skillVersionId);
    if (!version) throw new Error("Skill version not found");

    const skill = await this.skillRepo.findByIdForUser(version.skillId, userId);
    if (!skill) throw new Error("Skill not found or you do not have access to it");

    // Phase 6 contract: resume EXACTLY where the run paused — restore state
    // from the database, do NOT restart the graph. Reusing the persisted plan
    // means no second LLM call and no re-execution of already-done steps.
    const plan = execution.plannerOutput as unknown as ExecutionPlan | null;
    if (!plan) {
      throw new Error("No plan available to resume this execution");
    }

    // Steps already completed before the pause = successful persisted tool
    // calls (every plan step produces exactly one tool call, incl. `none`
    // pass-throughs). The next unexecuted step index is therefore the count.
    const executedCalls = (execution.toolCalls ?? []).filter((c) => c.status === "SUCCESS");
    const currentStep = executedCalls.length;

    // Rebuild results + tool call records from the persisted trace so the
    // finish node assembles the complete output (not just the resumed tail).
    const results: Record<string, unknown> = {};
    const toolCalls: ToolCallRecord[] = [];
    for (let i = 0; i < executedCalls.length; i += 1) {
      const call = executedCalls[i];
      const step = plan.steps[i];
      const output = call.outputResult ?? call.inputArgs;
      results[`step_${step?.stepNumber ?? i + 1}`] = output;
      toolCalls.push({
        stepNumber: step?.stepNumber ?? i + 1,
        toolName: call.toolName,
        action: call.action,
        input: call.inputArgs,
        output,
        status: "SUCCESS",
        requiresApproval: false,
        durationMs: call.durationMs ?? undefined,
      });
    }

    // Bind cancellation manager signal so user-requested cancellation can abort the resumed run
    const signal = this.cancellations.create(executionId);

    // Continue the graph from the restored state, asynchronously — the caller
    // polls the execution detail page for completion.
    this.engine.run({
      executionId,
      skill,
      version,
      userInput: execution.inputData,
      signal,
      resume: {
        plan,
        currentStep,
        results,
        toolCalls,
        providerUsed: execution.provider ?? null,
        persistedStepCount: execution.stepCount,
      },
    })
      .then(async (result) => {
        if (result.status === "COMPLETED") {
          await this.executionRepo.setFinalOutput(executionId, result.finalOutput ?? {});
          await this.auditRepo.log({
            userId,
            executionId,
            action: "EXECUTION_COMPLETED",
            details: { resumed: true },
          });
        } else if (result.status === "PAUSED_FOR_APPROVAL") {
          // The resumed run paused again at a later step — persist the pause.
          await this.executionRepo.updateStatus(executionId, "PAUSED_FOR_APPROVAL");
        }
        logger.info({ executionId, status: result.status }, "Resumed execution finished");
      })
      .catch(async (err) => {
        logger.error({ executionId, err }, "Resume execution failed catastrophically");
        await this.executionRepo.updateStatus(
          executionId,
          "FAILED",
          err instanceof Error ? err.message : "Resume error occurred"
        ).catch(() => {});
      })
      .finally(() => {
        this.cancellations.dispose(executionId);
      });

    return (await this.executionRepo.findById(executionId)) ?? execution;
  }

  async retryFailedExecution(executionId: string, userId: string): Promise<ExecutionDTO> {
    const execution = await this.executionRepo.findByIdForUser(executionId, userId);
    if (!execution) throw new Error("Execution not found or you do not have access to it");

    if (execution.status === "RUNNING") {
      throw new Error("Execution is already running");
    }

    const version = await this.skillRepo.findVersionById(execution.skillVersionId);
    if (!version) throw new Error("Skill version not found");

    const skill = await this.skillRepo.findByIdForUser(version.skillId, userId);
    if (!skill) throw new Error("Skill not found or you do not have access to it");

    const plan = execution.plannerOutput as unknown as ExecutionPlan | null;
    if (!plan) {
      throw new Error("No plan available to recover this execution");
    }

    // Mark status as RUNNING
    await this.executionRepo.updateStatus(executionId, "RUNNING");

    await this.auditRepo.log({
      userId,
      executionId,
      action: "EXECUTION_RECOVERY_STARTED",
      details: { recoveredFromStatus: execution.status, skillName: skill.name },
    });

    const executedCalls = (execution.toolCalls ?? []).filter((c) => c.status === "SUCCESS");
    const currentStep = executedCalls.length;

    const results: Record<string, unknown> = {};
    const toolCalls: ToolCallRecord[] = [];
    for (let i = 0; i < executedCalls.length; i += 1) {
      const call = executedCalls[i];
      const step = plan.steps[i];
      const output = call.outputResult ?? call.inputArgs;
      results[`step_${step?.stepNumber ?? i + 1}`] = output;
      toolCalls.push({
        stepNumber: step?.stepNumber ?? i + 1,
        toolName: call.toolName,
        action: call.action,
        input: call.inputArgs,
        output,
        status: "SUCCESS",
        requiresApproval: false,
        durationMs: call.durationMs ?? undefined,
      });
    }

    const signal = this.cancellations.create(executionId);

    this.engine
      .run({
        executionId,
        skill,
        version,
        userInput: execution.inputData,
        signal,
        resume: {
          plan,
          currentStep,
          results,
          toolCalls,
          providerUsed: execution.provider ?? null,
          persistedStepCount: execution.stepCount,
        },
      })
      .then(async (result) => {
        if (result.status === "COMPLETED") {
          await this.executionRepo.setFinalOutput(executionId, result.finalOutput ?? {});
          await this.auditRepo.log({
            userId,
            executionId,
            action: "EXECUTION_COMPLETED",
            details: { recovered: true, skippedSafeSteps: currentStep },
          });
        } else if (result.status === "PAUSED_FOR_APPROVAL") {
          await this.executionRepo.updateStatus(executionId, "PAUSED_FOR_APPROVAL");
        }
        logger.info({ executionId, status: result.status, skippedSafeSteps: currentStep }, "Recovered execution finished");
      })
      .catch(async (err) => {
        logger.error({ executionId, err }, "Recovery execution failed");
        await this.executionRepo
          .updateStatus(
            executionId,
            "FAILED",
            err instanceof Error ? err.message : "Recovery error occurred"
          )
          .catch(() => {});
      })
      .finally(() => {
        this.cancellations.dispose(executionId);
      });

    return (await this.executionRepo.findById(executionId)) ?? execution;
  }
}

