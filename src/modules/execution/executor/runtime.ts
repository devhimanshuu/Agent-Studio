import { Logger } from "@/lib/logger";
import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { ToolCallDTO, StepStatus } from "@/types/execution";
import { ToolRegistry } from "../tool-registry/toolRegistry";
import { PermissionChecker } from "../tool-registry/permissionChecker";
import { PlannerService } from "../planner/plannerService";
import { ToolCallRecord } from "../state/agentState";

/**
 * Everything the graph nodes need beyond the Agent State. Injected per
 * execution through the LangGraph `config.configurable.runtime` channel —
 * nodes stay independent and unit-testable.
 */
export interface ExecutionRuntime {
  executionId: string;
  logger: Logger;
  toolRegistry: ToolRegistry;
  permissionChecker: PermissionChecker;
  planner: PlannerService;
  executionRepo: IExecutionRepository;
  signal?: AbortSignal;
  /** Monotonic counter for persisted step numbers (one sequence per execution). */
  stepCounter: number;
}

/** Pull the runtime out of the LangGraph config passed to every node. */
export function requireRuntime(config: unknown): ExecutionRuntime {
  const runtime = (config as { configurable?: { runtime?: ExecutionRuntime } })?.configurable?.runtime;
  if (!runtime) {
    throw new Error("Execution runtime is missing from the graph config");
  }
  return runtime;
}

/** Persist one graph-node execution as an ExecutionStep row. */
export async function persistNodeStep(
  runtime: ExecutionRuntime,
  nodeName: string,
  status: StepStatus,
  snapshot: Record<string, unknown>
): Promise<void> {
  runtime.stepCounter += 1;
  const now = new Date();
  await runtime.executionRepo.addStep(runtime.executionId, {
    stepNumber: runtime.stepCounter,
    nodeName,
    stateSnapshot: snapshot,
    status,
    startedAt: now,
    completedAt: now,
  });
}

/** Persist one tool call as a ToolCall row. */
export async function persistToolCall(
  runtime: ExecutionRuntime,
  record: ToolCallRecord,
  status: ToolCallDTO["status"]
): Promise<void> {
  await runtime.executionRepo.addToolCall(runtime.executionId, {
    toolName: record.toolName,
    action: record.action,
    inputArgs: record.input,
    outputResult: (record.output as Record<string, unknown> | undefined) ?? undefined,
    status,
    errorMessage: record.error,
  });
}
