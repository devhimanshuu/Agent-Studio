import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation } from "./agentAnnotation";
import {
  plannerNode,
  permissionNode,
  toolSelectionNode,
  toolExecutionNode,
  approvalNode,
  finishNode,
} from "./nodes";
import { AgentState } from "../state/agentState";

/**
 * Execution graph topology (GRAPH-FIRST — the LLM lives only inside the
 * planner node):
 *
 *   START → planner → permission ─┬─ (no steps) ──→ finish → END
 *                                └─ (has steps) ─→ tool_selection ─┬─ approval needed → approval → END (paused)
 *                                                                 └─ else → tool_execution ─┬─ more steps → tool_selection
 *                                                                                           └─ done → finish → END
 */

function routeAfterPermission(state: AgentState): string {
  return state.plan && state.plan.steps.length > 0 ? "tool_selection" : "finish";
}

function routeAfterSelection(state: AgentState): string {
  const step = state.plan?.steps[state.currentStep - 1];
  if (!step) return "finish";
  // The merged approval decision (plan flag, version action list, or the
  // tool's own requiresApproval contract) was stamped by tool_selection.
  if (state.approvalPending) return "approval";
  return "tool_execution";
}

function routeAfterExecution(state: AgentState): string {
  if (state.currentStep < (state.plan?.steps.length ?? 0)) return "tool_selection";
  return "finish";
}

/** Compile a fresh execution graph. Cheap; safe to call per execution. */
export function createExecutionGraph() {
  return new StateGraph(AgentStateAnnotation)
    .addNode("planner", plannerNode)
    .addNode("permission", permissionNode)
    .addNode("tool_selection", toolSelectionNode)
    .addNode("tool_execution", toolExecutionNode)
    .addNode("approval", approvalNode)
    .addNode("finish", finishNode)
    .addEdge(START, "planner")
    .addEdge("planner", "permission")
    .addConditionalEdges("permission", routeAfterPermission)
    .addConditionalEdges("tool_selection", routeAfterSelection)
    .addConditionalEdges("tool_execution", routeAfterExecution)
    .addEdge("approval", END)
    .addEdge("finish", END)
    .compile();
}
