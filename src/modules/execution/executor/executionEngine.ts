import { Logger, logger as defaultLogger } from "@/lib/logger";
import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { ExecutionStatus } from "@/types/execution";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { createInitialAgentState, ExecutionPlan, AgentState } from "../state/agentState";
import { createExecutionGraph } from "../graph/buildExecutionGraph";
import { ToolRegistry } from "../tool-registry/toolRegistry";
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
      signal: input.signal,
      stepCounter: 0,
    };

    logger.info({ executionId, skillId: skill.id, versionNumber: version.versionNumber }, "Execution Started");

    const initialState = createInitialAgentState({ executionId, skill, version, userInput });

    try {
      const finalState: AgentState = await withTimeout(
        this.graph.invoke(initialState, { configurable: { runtime } }),
        this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        input.signal
      );

      const status = finalState.executionStatus;
      await this.deps.executionRepo.setRuntimeDetails(executionId, {
        provider: finalState.providerUsed ?? undefined,
        plannerOutput: (finalState.plan as unknown as Record<string, unknown>) ?? undefined,
        durationMs: Date.now() - startedAt,
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

    // Persist the terminal status + timing. Best-effort: the execution row may
    // have been removed meanwhile — never mask the original error.
    try {
      await this.deps.executionRepo.updateStatus(executionId, status, message);
      await this.deps.executionRepo.setRuntimeDetails(executionId, { durationMs });
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
