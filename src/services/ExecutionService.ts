import { IExecutionService } from "./interfaces/IExecutionService";
import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { IAuditLogRepository } from "@/repositories/interfaces/IAuditLogRepository";
import { IApprovalRepository } from "@/repositories/interfaces/IApprovalRepository";
import { IExecutionLogRepository } from "@/repositories/interfaces/IExecutionLogRepository";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { ApprovalHistoryRepository } from "@/repositories/ApprovalHistoryRepository";
import { ExecutionLogRepository } from "@/repositories/ExecutionLogRepository";
import { ApprovalEngine } from "@/modules/approval";
import { ExecutionDTO, StartExecutionInput } from "@/types/execution";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { LLMProvider, getLLMProvider } from "@/providers/llm";
import { ExecutionPlan, ToolCallRecord } from "@/modules/execution/state/agentState";
import { ExecutionEngine, EngineRunResult } from "@/modules/execution/executor/executionEngine";
import { CancellationManager } from "@/modules/execution/executor/cancellation";
import { createToolRegistry, ToolRegistry } from "@/modules/tools";
import { PermissionChecker } from "@/modules/execution/tool-registry/permissionChecker";
import { PlannerService } from "@/modules/execution/planner/plannerService";
import { McpClientService } from "./McpClientService";
import { IOpenApiService } from "./interfaces/IOpenApiService";
import {
  validateSkillForExecution,
  validateVersionForExecution,
  validateUserInput,
} from "@/modules/execution/executor/validation";
import { InvalidSkillError } from "@/modules/execution/executor/errors";
import { GraphInterpreter, GraphRunResult, GraphState } from "@/modules/graph/graphInterpreter";
import { isValidGraph } from "@/types/graph";
import { logger } from "@/lib/logger";

interface ExecutionServiceDeps {
  /** Injected LLM (router) — defaults to the env-configured failover router. */
  llm?: LLMProvider;
  /** Injected engine (tests) — defaults to a graph-first ExecutionEngine. */
  engine?: ExecutionEngine;
  /** Injected graph interpreter (tests) — defaults to the visual-graph interpreter. */
  graphInterpreter?: GraphInterpreter;
  cancellations?: CancellationManager;
  /** Persists HITL approval requests created when runs pause. */
  approvalRepo?: IApprovalRepository;
  /** Approval engine for HITL lifecycle management. */
  approvalEngine?: ApprovalEngine;
  /** Persists structured execution logs (observability). */
  logRepo?: IExecutionLogRepository;
  /**
   * MCP client hub — when provided, the user's cached MCP tools are synced
   * into the run registries before execution so skills can call them.
   */
  mcpService?: McpClientService;
  /**
   * OpenAPI service — when provided, the user's configured OpenAPI tools are synced
   * into the run registries before execution so skills can call them.
   */
  openApiService?: IOpenApiService;
}

export class ExecutionService implements IExecutionService {
  private cancellations: CancellationManager;
  private engine: ExecutionEngine;
  private graphInterpreter: GraphInterpreter;
  private approvalEngine: ApprovalEngine;
  private mcpService?: McpClientService;
  private openApiService?: IOpenApiService;
  /** Registries used by the engine + graph interpreter — kept so MCP tools can
   * be synced per user before each run. */
  private engineRegistry: ToolRegistry;
  private graphRegistry: ToolRegistry;

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
    this.mcpService = deps.mcpService;
    this.openApiService = deps.openApiService;

    // Single shared registries so the MCP hub can sync a user's discovered
    // tools onto them before each run (registry is mutable + namespaced).
    this.engineRegistry = createToolRegistry();
    this.graphRegistry = createToolRegistry();

    this.engine =
      deps.engine ??
      new ExecutionEngine({
        // Registry pre-loaded with the built-in tools (calculator, document
        // search, record lookup, mock task creator). New tools self-register
        // here via the tools module — zero runtime changes.
        toolRegistry: this.engineRegistry,
        permissionChecker: new PermissionChecker(),
        planner: new PlannerService(llm),
        executionRepo: this.executionRepo,
        approvalRepo,
        logRepo: deps.logRepo ?? new ExecutionLogRepository(),
      });

    this.graphInterpreter =
      deps.graphInterpreter ??
      new GraphInterpreter({
        llm,
        toolRegistry: this.graphRegistry,
        permissionChecker: new PermissionChecker(),
        executionRepo: this.executionRepo,
        approvalRepo,
        logRepo: deps.logRepo ?? new ExecutionLogRepository(),
        // Vault bridge for HTTP-node `${vault.KEY}` placeholders — secrets are
        // resolved per-run from the owning user's vault, never stored on the
        // graph or logged with the request.
        resolveSecrets: async (userId, value) => {
          const { resolveVaultPlaceholders } = await import("@/lib/secrets");
          return resolveVaultPlaceholders(userId, value);
        },
      });
  }

  /** True when the version carries a valid visual graph → run the graph interpreter. */
  private usesGraph(version: SkillVersionDTO): boolean {
    return isValidGraph(version.graphDefinition ?? null);
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

    // A graphDefinition that fails validation means the canvas graph was left
    // mid-edit (e.g. no END node). Fail loudly instead of silently falling
    // back to the linear planner — the user expects their graph to run.
    if (version.graphDefinition && !isValidGraph(version.graphDefinition)) {
      throw new InvalidSkillError(
        "The visual graph is incomplete — add a START node, an END node, and valid connections before running."
      );
    }

    // Sync the user's cached MCP & OpenAPI tools into the run registries so skills can
    // call them (permission-gated via allowedTools). Idempotent — safe on every run.
    await Promise.all([
      this.syncMcpTools(input.userId),
      this.syncOpenApiTools(input.userId),
    ]);

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
      // Visual graph versions run through the graph interpreter; everything
      // else keeps the linear planner-first engine.
      if (this.usesGraph(version)) {
        const graphResult = await this.graphInterpreter.run({
          executionId: execution.id,
          skill,
          version,
          graph: version.graphDefinition!,
          userInput: input.inputData,
          signal,
          replayOutputs: input.replayOutputs,
        });
        result = this.toEngineResult(graphResult);
      } else {
        result = await this.engine.run({
          executionId: execution.id,
          skill,
          version,
          userInput: input.inputData,
          signal,
        });
      }
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

  /**
   * Best-effort sync of the user's cached MCP tools onto the shared run
   * registries. Only available when an McpClientService was injected; injected
   * engines (tests) keep their own registries untouched.
   */
  private async syncMcpTools(userId: string): Promise<void> {
    if (!this.mcpService) return;
    await Promise.all([
      this.mcpService.registerUserMcpTools(userId, this.engineRegistry),
      this.mcpService.registerUserMcpTools(userId, this.graphRegistry),
    ]);
  }

  /**
   * Best-effort sync of the user's configured OpenAPI tools onto the shared run registries.
   */
  private async syncOpenApiTools(userId: string): Promise<void> {
    if (!this.openApiService) return;
    await Promise.all([
      this.openApiService.syncRegistryTools(userId, this.engineRegistry),
      this.openApiService.syncRegistryTools(userId, this.graphRegistry),
    ]);
  }

  /** Normalize a graph interpreter result to the shared engine result shape. */
  private toEngineResult(graph: GraphRunResult): EngineRunResult {
    return {
      status: graph.status,
      finalOutput: graph.finalOutput,
      providerUsed: graph.providerUsed,
      plan: null,
      error: graph.error,
    };
  }

  async cancelExecution(id: string, userId: string): Promise<ExecutionDTO> {
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

    await Promise.all([
      this.syncMcpTools(userId),
      this.syncOpenApiTools(userId),
    ]);

    // Atomic CAS: exactly one concurrent resume/retry/cancel wins. The old
    // read-then-write guard let two simultaneous resumes both pass the
    // status check and double-invoke the graph.
    const claimed = await this.executionRepo.claimRun(executionId);
    if (!claimed) throw new Error("Execution is already running");

    try {
      return await this.runResume(execution, userId, { skipCompletedNodes: false });
    } catch (error) {
      // Release the claim so a corrected retry is possible.
      await this.executionRepo
        .updateStatus(executionId, "FAILED", error instanceof Error ? error.message : "Resume error occurred")
        .catch(() => {});
      throw error;
    }
  }

  /**
   * Shared resume/retry runner. AWAITS the graph/engine run instead of
   * fire-and-forget: on serverless (Vercel) a floating promise after the HTTP
   * response freezes with the lambda and the execution stayed RUNNING forever.
   */
  private async runResume(
    execution: ExecutionDTO,
    userId: string,
    options: { skipCompletedNodes: boolean }
  ): Promise<ExecutionDTO> {
    const executionId = execution.id;

    // Load the skill and version that were used for this execution.
    if (!execution.skillVersionId) {
      throw new Error("Cannot resume: the skill version for this execution has been deleted.");
    }
    const version = await this.skillRepo.findVersionById(execution.skillVersionId);
    if (!version) throw new Error("Skill version not found");

    const skill = await this.skillRepo.findByIdForUser(version.skillId, userId);
    if (!skill) throw new Error("Skill not found or you do not have access to it");

    // Visual graph runs persist a `{ graph: true, pausedAtNodeId, state }`
    // payload — resume the graph interpreter in place.
    const planner = execution.plannerOutput as Record<string, unknown> | null;
    if (planner?.graph === true && this.usesGraph(version)) {
      return this.resumeGraphExecution(execution, skill, version, userId, planner, options.skipCompletedNodes);
    }

    const plan = planner as unknown as ExecutionPlan | null;
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

    const signal = this.cancellations.create(executionId);

    let result: EngineRunResult;
    try {
      result = await this.engine.run({
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
      });
    } finally {
      this.cancellations.dispose(executionId);
    }

    return this.persistTerminal(executionId, userId, result, { resumed: true });
  }

  /** Persist the outcome of an awaited run and return the fresh row. */
  private async persistTerminal(
    executionId: string,
    userId: string,
    result: EngineRunResult,
    auditDetails: Record<string, unknown>
  ): Promise<ExecutionDTO> {
    if (result.status === "COMPLETED") {
      await this.executionRepo.setFinalOutput(executionId, result.finalOutput ?? {});
      await this.auditRepo.log({
        userId,
        executionId,
        action: "EXECUTION_COMPLETED",
        details: auditDetails,
      });
    } else if (result.status === "PAUSED_FOR_APPROVAL") {
      await this.executionRepo.updateStatus(executionId, "PAUSED_FOR_APPROVAL");
    } else if (result.error) {
      await this.executionRepo.updateStatus(executionId, result.status, result.error);
    }
    logger.info({ executionId, status: result.status }, "Resumed execution finished");
    return (await this.executionRepo.findById(executionId)) ?? ({} as ExecutionDTO);
  }

  /**
   * Resume a visual-graph execution from the persisted pause position. The
   * successor of the approved node is the continuation point; restored state
   * (results, loop counters, tool calls) keeps the run exactly in place.
   * With `skipCompletedNodes` (failure retry) nodes whose outputs are already
   * persisted are replayed from state instead of re-executed — previously a
   * retry re-ran every agent/tool/HTTP node, duplicating LLM spend and any
   * non-idempotent side effects.
   */
  private async resumeGraphExecution(
    execution: ExecutionDTO,
    skill: SkillDTO,
    version: SkillVersionDTO,
    userId: string,
    planner: Record<string, unknown>,
    skipCompletedNodes: boolean
  ): Promise<ExecutionDTO> {
    const executionId = execution.id;
    const state = planner.state as GraphState | undefined;
    const pausedAtNodeId = planner.pausedAtNodeId as string | undefined;
    const graph = version.graphDefinition!;

    if (!state) {
      throw new Error("Incomplete graph resume state");
    }

    // Approval resume: continue from the approved node's successor. Failure
    // retries restart from START with skip-completed replay semantics.
    const nextNode =
      pausedAtNodeId
        ? graph.edges.find((e) => e.source === pausedAtNodeId)?.target ?? pausedAtNodeId
        : graph.nodes.find((n) => n.type === "start")?.id ?? graph.nodes[0]?.id;
    if (!nextNode) {
      throw new Error("Incomplete graph resume state");
    }

    const signal = this.cancellations.create(executionId);

    let result: GraphRunResult;
    try {
      result = await this.graphInterpreter.run({
        executionId,
        skill,
        version,
        graph,
        userInput: execution.inputData,
        signal,
        resume: { state, fromNodeId: nextNode, ...(skipCompletedNodes ? { skipCompletedNodes: true } : {}) },
      });
    } catch (error) {
      this.cancellations.dispose(executionId);
      await this.executionRepo
        .updateStatus(executionId, "FAILED", error instanceof Error ? error.message : "Resume error occurred")
        .catch(() => {});
      throw error;
    }
    this.cancellations.dispose(executionId);

    const normalized: EngineRunResult = this.toEngineResult(result);
    if (result.status !== "COMPLETED" && result.status !== "PAUSED_FOR_APPROVAL" && !normalized.error) {
      normalized.error = result.error;
    }
    return this.persistTerminal(executionId, userId, normalized, {
      resumed: true,
      graph: true,
      ...(skipCompletedNodes ? { skippedCompletedNodes: true } : {}),
    });
  }

  async retryFailedExecution(executionId: string, userId: string): Promise<ExecutionDTO> {
    const execution = await this.executionRepo.findByIdForUser(executionId, userId);
    if (!execution) throw new Error("Execution not found or you do not have access to it");

    await Promise.all([
      this.syncMcpTools(userId),
      this.syncOpenApiTools(userId),
    ]);

    // Same atomic claim as resume — concurrent retries cannot double-run.
    const claimed = await this.executionRepo.claimRun(executionId);
    if (!claimed) throw new Error("Execution is already running");

    await this.auditRepo.log({
      userId,
      executionId,
      action: "EXECUTION_RECOVERY_STARTED",
      details: { recoveredFromStatus: execution.status },
    });

    try {
      // Retry replays completed work from the persisted trace instead of
      // re-executing it (see resumeGraphExecution docstring).
      return await this.runResume(execution, userId, { skipCompletedNodes: true });
    } catch (error) {
      await this.executionRepo
        .updateStatus(executionId, "FAILED", error instanceof Error ? error.message : "Recovery error occurred")
        .catch(() => {});
      throw error;
    }
  }
}

