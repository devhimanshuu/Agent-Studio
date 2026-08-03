import { Annotation } from "@langchain/langgraph";
import { ExecutionStatus } from "@/types/execution";
import { AgentState, ApprovalStatus, ExecutionPlan, ToolCallRecord } from "../state/agentState";

/**
 * LangGraph channels for the Agent State.
 *
 * - `toolCalls` and `errors` append (reducer) so each node contributes records.
 * - `results` merges objects so later steps never clobber earlier outputs.
 * - Everything else is a LastValue channel (overwrite by the producing node).
 */
export const AgentStateAnnotation = Annotation.Root({
  executionId: Annotation<string>(),
  skill: Annotation<AgentState["skill"]>(),
  version: Annotation<AgentState["version"]>(),
  input: Annotation<Record<string, unknown>>(),
  plan: Annotation<ExecutionPlan | null>(),
  currentStep: Annotation<number>(),
  toolCalls: Annotation<ToolCallRecord[]>({
    reducer: (a, b) => [...(a ?? []), ...b],
  }),
  results: Annotation<Record<string, unknown>>({
    reducer: (a, b) => ({ ...(a ?? {}), ...b }),
  }),
  errors: Annotation<string[]>({
    reducer: (a, b) => [...(a ?? []), ...b],
  }),
  retries: Annotation<number>(),
  approvalStatus: Annotation<ApprovalStatus>(),
  executionStatus: Annotation<ExecutionStatus>(),
  finalOutput: Annotation<Record<string, unknown> | null>(),
  providerUsed: Annotation<string | null>(),
});
