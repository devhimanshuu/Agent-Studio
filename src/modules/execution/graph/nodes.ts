import { SkillVersionDTO } from "@/types/skill";
import { AgentState, ToolCallRecord } from "../state/agentState";
import { ExecutionRuntime, requireRuntime, persistNodeStep, persistToolCall } from "../executor/runtime";
import { errorMessage, ExecutionCancelledError, ExecutionError, StepLimitExceededError, UnauthorizedToolError, ToolExecutionError } from "../executor/errors";
import { ToolValidationError, ToolTimeoutError } from "@/modules/tools";
import { withRetries } from "../executor/retry";

export type GraphNode = (state: AgentState, config: unknown) => Promise<Partial<AgentState>>;

/** True when the given step must pause for human approval — the plan flag, the
 * version's action list, OR the tool's own requiresApproval contract (WRITE
 * tools always pause regardless of what the plan said). */
export function stepRequiresApproval(
  step: { action: string; requiresApproval: boolean; toolName?: string },
  version: SkillVersionDTO | null,
  tool?: { requiresApproval: boolean } | null
): boolean {
  if (step.requiresApproval) return true;
  if (version?.actionsRequiringApproval?.includes(step.action)) return true;
  return Boolean(tool?.requiresApproval);
}

/** Decides whether a tool failure deserves one retry. Domain errors and
 * deterministic tool-framework errors (invalid input, timeout) fail fast;
 * transient failures (vendor/network hiccups) get one retry. */
export function isRetryableToolFailure(error: unknown): boolean {
  return (
    !(error instanceof ExecutionError) &&
    !(error instanceof ToolValidationError) &&
    !(error instanceof ToolTimeoutError)
  );
}

/**
 * PlannerNode — the ONLY node that touches the LLM. Produces the deterministic
 * plan, enforces the max-steps bound, and records the serving provider.
 */
export const plannerNode: GraphNode = async (state, config) => {
  const runtime = requireRuntime(config);
  const { skill, version, input, executionId } = state;
  if (!skill || !version) throw new ExecutionError("Skill or version is missing", "INVALID_SKILL");

  runtime.logger.info({ executionId, skillId: skill.id }, "Planner Started");
  try {
    const plan = await runtime.planner.plan({ skill, version, userInput: input });
    if (plan.steps.length > version.maxExecutionSteps) {
      throw new StepLimitExceededError(
        `Plan requires ${plan.steps.length} steps but the skill allows a maximum of ${version.maxExecutionSteps}`
      );
    }
    await persistNodeStep(runtime, "planner", "SUCCESS", {
      steps: plan.steps.length,
      requiredTools: plan.requiredTools,
    });
    runtime.logger.info({ executionId, steps: plan.steps.length }, "Planner Finished");
    return {
      plan,
      currentStep: 0,
      executionStatus: "RUNNING",
      providerUsed: runtime.planner.providerLabel,
    };
  } catch (error) {
    await persistNodeStep(runtime, "planner", "FAILED", { error: errorMessage(error) });
    throw error;
  }
};

/**
 * PermissionNode — verifies every planned tool exists, is enabled, and is
 * declared in the skill's allowedTools. Rejects unauthorized tools outright.
 */
export const permissionNode: GraphNode = async (state, config) => {
  const runtime = requireRuntime(config);
  const { plan, version } = state;
  if (!plan) throw new ExecutionError("No plan to validate", "GRAPH_FAILURE");

  const allowedTools = version?.allowedTools ?? [];
  for (const step of plan.steps) {
    if (step.toolName === "none") continue;
    const verdict = runtime.permissionChecker.check(step.toolName, allowedTools, runtime.toolRegistry);
    if (!verdict.ok) {
      throw new UnauthorizedToolError(verdict.toolName, verdict.reason);
    }
  }

  await persistNodeStep(runtime, "permission", "SUCCESS", { toolsChecked: plan.steps.length });
  runtime.logger.info({ executionId: state.executionId, checked: plan.steps.length }, "Permission Checker finished");
  return {};
};

/**
 * ToolSelectionNode — picks the next unexecuted plan step (advances currentStep
 * by one). The conditional edge then decides approval / execution / finish.
 */
export const toolSelectionNode: GraphNode = async (state, config) => {
  const runtime = requireRuntime(config);
  const { plan, currentStep, version } = state;
  if (!plan) throw new ExecutionError("No plan to execute", "GRAPH_FAILURE");

  // Cooperative cancellation: bail out at node boundaries when aborted so the
  // graph unwinds instead of continuing to execute (and persist steps).
  if (runtime.signal?.aborted) {
    throw new ExecutionCancelledError("Execution cancelled");
  }

  const nextIndex = currentStep;
  if (nextIndex >= plan.steps.length) {
    return { currentStep: plan.steps.length };
  }

  const step = plan.steps[nextIndex];
  const tool = runtime.toolRegistry.getTool(step.toolName);
  // Stamp the merged approval decision into state so the conditional edge can
  // route to the approval node WITHOUT needing registry access.
  const approvalPending = stepRequiresApproval(step, version, tool);
  await persistNodeStep(runtime, "tool_selection", "SUCCESS", {
    stepNumber: step.stepNumber,
    tool: step.toolName,
    requiresApproval: approvalPending,
  });
  runtime.logger.info({ executionId: state.executionId, tool: step.toolName }, "Tool Selected");
  return { currentStep: nextIndex + 1, approvalPending };
};

/**
 * ToolExecutionNode — executes the selected step through the tool registry.
 * Re-checks permission at execution time and persists the tool call.
 */
export const toolExecutionNode: GraphNode = async (state, config) => {
  const runtime = requireRuntime(config);
  const { plan, version, currentStep, executionId } = state;
  if (!plan) throw new ExecutionError("No plan to execute", "GRAPH_FAILURE");

  const step = plan.steps[currentStep - 1];
  if (!step) throw new ExecutionError(`No step to execute at index ${currentStep - 1}`, "GRAPH_FAILURE");

  const tool = runtime.toolRegistry.getTool(step.toolName);
  const requiresApproval = stepRequiresApproval(step, version, tool);
  const baseRecord: ToolCallRecord = {
    stepNumber: step.stepNumber,
    toolName: step.toolName,
    action: step.action,
    input: step.input,
    status: "PENDING",
    requiresApproval,
  };

  // Data pass-through step (no tool) — record input as the result.
  if (step.toolName === "none") {
    const record: ToolCallRecord = { ...baseRecord, status: "SUCCESS", output: { ...step.input } };
    await persistToolCall(runtime, record, "SUCCESS");
    await persistNodeStep(runtime, "tool_execution", "SUCCESS", { tool: "none", status: "SUCCESS" });
    return { toolCalls: [record], results: { [`step_${step.stepNumber}`]: record.output } };
  }

  // Permission re-check at execution time (belt & suspenders).
  const verdict = runtime.permissionChecker.check(step.toolName, version?.allowedTools ?? [], runtime.toolRegistry);
  if (!verdict.ok) {
    const record: ToolCallRecord = { ...baseRecord, status: "BLOCKED", error: verdict.reason };
    await persistToolCall(runtime, record, "BLOCKED");
    await persistNodeStep(runtime, "tool_execution", "FAILED", { error: verdict.reason });
    throw new UnauthorizedToolError(verdict.toolName, verdict.reason);
  }

  const toolStartedAt = Date.now();
  // The plan keeps the tool's action separate from its argument payload — merge
  // it back so the tool receives a complete invocation. Tools whose schema has
  // no action field simply ignore the extra key (Zod strips unknown fields).
  const executionInput = { ...step.input, action: step.action };
  try {
    const output = await withRetries(
      () => runtime.toolRegistry.executeTool(step.toolName, executionInput),
      {
        attempts: 2,
        delayMs: 0,
        // Retry transient tool failures once. Domain errors (ExecutionError,
        // e.g. a blocked/unauthorized action) and deterministic tool-framework
        // errors (invalid input, timeout) fail fast — but a plain transient
        // failure (vendor/network hiccup inside the tool) is worth one retry.
        // Previously `attempts: 2` was dead: the default predicate only
        // retries errors flagged `retryable`, which tool errors never are.
        isRetryable: isRetryableToolFailure,
      }
    );
    const record: ToolCallRecord = {
      ...baseRecord,
      status: "SUCCESS",
      output,
      durationMs: Date.now() - toolStartedAt,
    };
    await persistToolCall(runtime, record, "SUCCESS");
    await persistNodeStep(runtime, "tool_execution", "SUCCESS", { tool: step.toolName, status: "SUCCESS" });
    runtime.logger.info({ executionId, tool: step.toolName }, "Tool Executed");
    return { toolCalls: [record], results: { [`step_${step.stepNumber}`]: output } };
  } catch (error) {
    const message = errorMessage(error);
    const record: ToolCallRecord = { ...baseRecord, status: "ERROR", error: message };
    await persistToolCall(runtime, record, "ERROR");
    await persistNodeStep(runtime, "tool_execution", "FAILED", { tool: step.toolName, error: message });
    throw new ToolExecutionError(step.toolName, message);
  }
};

/**
 * ApprovalNode — pauses the run when an action requires human approval.
 * Creates the HITL ApprovalRequest so the pending queue and the respond API
 * have a row to operate on, then parks the run in PAUSED_FOR_APPROVAL.
 * Resolution (approve/reject) ships with the HITL workflow next phase.
 */
export const approvalNode: GraphNode = async (state, config) => {
  const runtime = requireRuntime(config);
  const step = state.plan?.steps[state.currentStep - 1];

  // Deterministic per (execution, step) idempotency key. The upsert is
  // race-proof: a re-pause (or a concurrent run of the same execution) can
  // never duplicate the request — the @unique key resolves to one row.
  // Denormalizes skill name and planner reason onto the request so the review
  // card can show them without extra joins.
  if (step) {
    await runtime.approvalRepo.upsertByIdempotencyKey({
      executionId: state.executionId,
      userId: state.skill?.userId ?? "",
      skillName: state.skill?.name ?? null,
      plannerReason: state.plan?.reasoning ?? null,
      toolName: step.toolName,
      action: step.action,
      inputPayload: step.input,
      idempotencyKey: `appr-${state.executionId}-step-${step.stepNumber}`,
    });
    runtime.logger.info(
      { executionId: state.executionId, tool: step.toolName, action: step.action },
      "Approval request created"
    );
  }

  await persistNodeStep(runtime, "approval", "AWAITING_APPROVAL", {
    tool: step?.toolName ?? null,
    action: step?.action ?? null,
  });
  runtime.logger.info(
    { executionId: state.executionId, tool: step?.toolName, action: step?.action },
    "Execution paused for approval"
  );
  return { approvalStatus: "PENDING", executionStatus: "PAUSED_FOR_APPROVAL" };
};

/**
 * FinishNode — collects the step outputs into the final response.
 */
export const finishNode: GraphNode = async (state, config) => {
  const runtime = requireRuntime(config);
  const finalOutput = {
    results: state.results,
    expectedOutput: state.plan?.expectedOutput ?? "",
  };

  await persistNodeStep(runtime, "finish", "SUCCESS", { toolCalls: state.toolCalls.length });
  runtime.logger.info({ executionId: state.executionId }, "Execution Completed");
  return { finalOutput, executionStatus: "COMPLETED" };
};

