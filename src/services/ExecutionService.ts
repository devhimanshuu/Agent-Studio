import { IExecutionService } from "./interfaces/IExecutionService";
import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { IAuditLogRepository } from "@/repositories/interfaces/IAuditLogRepository";
import { ExecutionDTO, StartExecutionInput } from "@/types/execution";
import { LLMProvider, getLLMProvider } from "@/providers/llm";
import { ExecutionEngine, EngineRunResult } from "@/modules/execution/executor/executionEngine";
import { CancellationManager } from "@/modules/execution/executor/cancellation";
import { ToolRegistry } from "@/modules/execution/tool-registry/toolRegistry";
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
}

export class ExecutionService implements IExecutionService {
  private cancellations: CancellationManager;
  private engine: ExecutionEngine;

  constructor(
    private executionRepo: IExecutionRepository,
    private skillRepo: ISkillRepository,
    private auditRepo: IAuditLogRepository,
    deps: ExecutionServiceDeps = {}
  ) {
    this.cancellations = deps.cancellations ?? new CancellationManager();
    const llm = deps.llm ?? getLLMProvider();
    this.engine =
      deps.engine ??
      new ExecutionEngine({
        toolRegistry: new ToolRegistry(),
        permissionChecker: new PermissionChecker(),
        planner: new PlannerService(llm),
        executionRepo: this.executionRepo,
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

    const execution = await this.executionRepo.create(input, version.maxExecutionSteps || 10);
    await this.auditRepo.log({
      userId: input.userId,
      executionId: execution.id,
      action: "EXECUTION_STARTED",
      details: { skillId: skill.id, skillVersionId: version.id },
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
}
