import { Logger, logger as defaultLogger } from "@/lib/logger";
import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { IApprovalRepository } from "@/repositories/interfaces/IApprovalRepository";
import { IExecutionLogRepository } from "@/repositories/interfaces/IExecutionLogRepository";
import { ExecutionStatus } from "@/types/execution";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { createInitialAgentState, ExecutionPlan, AgentState, ToolCallRecord } from "../state/agentState";
import { createExecutionGraph } from "../graph/buildExecutionGraph";
import { ToolRegistry } from "@/modules/tools";
import { PermissionChecker } from "../tool-registry/permissionChecker";
import { PlannerService } from "../planner/plannerService";
import { ExecutionRuntime } from "./runtime";
import {
  ExecutionCancelledError,
  ExecutionError,
  ExecutionTimeoutError,
  StepLimitExceededError,
  UnauthorizedToolError,
  errorMessage,
} from "./errors";

export interface ExecutionEngineDeps {
  toolRegistry: ToolRegistry;
  permissionChecker: PermissionChecker;
  planner: PlannerService;
  executionRepo: IExecutionRepository;
  /** Persists HITL approval requests created when the graph pauses. */
  approvalRepo: IApprovalRepository;
  /** Persists structured execution logs (observability). */
  logRepo: IExecutionLogRepository;
  logger?: Logger;
  /** Wall-clock limit for the whole graph run. Default 120s. */
  timeoutMs?: number;
}

export interface EngineRunInput {
  executionId: string;
  skill: SkillDTO;
  version: SkillVersionDTO;
  userInput: Record<string, unknown>;
  signal?: AbortSignal;
  /**
   * Resume a previously paused run: restore the plan + progress from the
   * persisted execution instead of replanning from scratch. The graph then
   * continues from the exact step that needed approval — it does NOT restart.
   */
  resume?: {
    /** The plan persisted when the run originally paused. */
    plan: ExecutionPlan;
    /** Index of the next plan step to execute (0-based). */
    currentStep: number;
    /** Outputs already produced before the pause (keyed `step_<n>`). */
    results: Record<string, unknown>;
    /** Tool calls recorded before the pause. */
    toolCalls: ToolCallRecord[];
    /** Provider/model that served the original plan. */
    providerUsed: string | null;
    /** Highest node-step number already persisted (continue numbering). */
    persistedStepCount: number;
  };
}

export interface EngineRunResult {
  status: ExecutionStatus;
  finalOutput: Record<string, unknown> | null;
  providerUsed: string | null;
  plan: ExecutionPlan | null;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Graph-first execution engine. The LangGraph is the orchestrator; the LLM is
 * injected as a dependency and consulted only by the planner node. The engine
 * handles the cross-cutting concerns: timeout, cancellation, error mapping,
 * and persistence.
 */
export class ExecutionEngine {
  private readonly graph = createExecutionGraph();

  constructor(private deps: ExecutionEngineDeps) {}

  async run(input: EngineRunInput): Promise<EngineRunResult> {
    const logger = this.deps.logger ?? defaultLogger;
    const startedAt = Date.now();
    const { executionId, skill, version, userInput } = input;

    const runtime: ExecutionRuntime = {
      executionId,
      logger,
      toolRegistry: this.deps.toolRegistry,
      permissionChecker: this.deps.permissionChecker,
      planner: this.deps.planner,
      executionRepo: this.deps.executionRepo,
      approvalRepo: this.deps.approvalRepo,
      logRepo: this.deps.logRepo,
      signal: input.signal,
      stepCounter: 0,
    };

    logger.info({ executionId, skillId: skill.id, versionNumber: version.versionNumber }, "Execution Started");
    await this.deps.logRepo.log({
      executionId,
      event: "EXECUTION_STARTED",
      level: "INFO",
      status: "RUNNING",
      metadata: { skillId: skill.id, versionNumber: version.versionNumber },
    });

    const initialState = createInitialAgentState({ executionId, skill, version, userInput });
    if (input.resume) {
      // Restore the paused run's plan + progress so the graph continues from
      // the exact step that needed approval (Phase 6: restore state from the
      // database, do NOT restart the graph). The planner node is skipped for
      // restored runs (see plannerNode), and the node-step counter resumes.
      initialState.plan = input.resume.plan;
      initialState.currentStep = input.resume.currentStep;
      initialState.results = input.resume.results;
      initialState.toolCalls = input.resume.toolCalls;
      initialState.providerUsed = input.resume.providerUsed;
      runtime.stepCounter = input.resume.persistedStepCount;
    }

    try {
      const finalState: AgentState = await withTimeout(
        this.graph.invoke(initialState, { configurable: { runtime } }),
        this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        input.signal
      );

      const status = finalState.executionStatus;
      const durationMs = Date.now() - startedAt;
      await this.deps.executionRepo.setRuntimeDetails(executionId, {
        provider: finalState.providerUsed ?? undefined,
        plannerOutput: (finalState.plan as unknown as Record<string, unknown>) ?? undefined,
        durationMs,
      });
      await this.deps.logRepo.log({
        executionId,
        event: "EXECUTION_FINISHED",
        level: status === "COMPLETED" ? "INFO" : "WARN",
        status,
        durationMs,
        metadata: { provider: finalState.providerUsed },
      });
      logger.info({ executionId, status }, "Execution Finished");

      return {
        status,
        finalOutput: finalState.finalOutput,
        providerUsed: finalState.providerUsed,
        plan: finalState.plan,
      };
    } catch (error) {
      return this.handleFailure(executionId, error, startedAt, logger);
    }
  }

  private async handleFailure(
    executionId: string,
    error: unknown,
    startedAt: number,
    logger: Logger
  ): Promise<EngineRunResult> {
    const message = errorMessage(error);
    const durationMs = Date.now() - startedAt;

    let status: ExecutionStatus = "FAILED";
    if (error instanceof ExecutionTimeoutError) status = "CANCELLED";
    else if (error instanceof ExecutionCancelledError) status = "CANCELLED";
    else if (error instanceof StepLimitExceededError) status = "STEP_LIMIT_EXCEEDED";

    // A user-initiated cancellation already carries a meaningful message
    // ("User requested cancellation" written by ExecutionService) — don't
    // clobber it with the generic unwinding message. Timeouts keep theirs.
    const isUserCancellation = error instanceof ExecutionCancelledError;

    // Persist the terminal status + timing. Best-effort: the execution row may
    // have been removed meanwhile — never mask the original error.
    try {
      await this.deps.executionRepo.updateStatus(executionId, status, isUserCancellation ? undefined : message);
      await this.deps.executionRepo.setRuntimeDetails(executionId, { durationMs });
      await this.deps.logRepo.log({
        executionId,
        event: "EXECUTION_FAILED",
        level: status === "CANCELLED" ? "WARN" : "ERROR",
        status,
        durationMs,
        metadata: { error: message },
      });
    } catch {
      // Ignore persistence failures in the error path.
    }

    logger.error(
      { executionId, status, error: message },
      status === "CANCELLED" ? "Execution Cancelled" : "Execution Failed"
    );

    return { status, finalOutput: null, providerUsed: null, plan: null, error: message };
  }
}

/** Race the promise against a timeout and an optional abort signal. */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new ExecutionTimeoutError(`Execution timed out after ${timeoutMs}ms`)));
    }, timeoutMs);

    const onAbort = () => {
      finish(() => reject(new ExecutionCancelledError("Execution cancelled")));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => finish(() => resolve(value)),
      (reason) => finish(() => reject(reason))
    );
  });
}
