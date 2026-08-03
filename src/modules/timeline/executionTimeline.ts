import { ExecutionDTO } from "@/types/execution";
import { TimelineEvent } from "@/types/observability";
import { ApprovalRequestDTO, ApprovalHistoryDTO } from "@/types/approval";

/**
 * Builds a unified, time-ordered timeline for an execution from four sources:
 *  1. execution lifecycle (started / completed / failed)
 *  2. node steps (planner, permission, tool_selection, tool_execution, approval, finish)
 *  3. tool calls (executed actions with durations)
 *  4. approval requests + history (requested / approved / rejected / resumed)
 *  5. structured execution logs (fallback for anything not covered)
 *
 * Used by /dashboard/executions/[id] and the JSON export.
 */
export function buildExecutionTimeline(
  execution: ExecutionDTO,
  approvals: ApprovalRequestDTO[] = [],
  approvalHistory: ApprovalHistoryDTO[] = []
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // 1. Lifecycle events.
  events.push({
    id: `exec-start-${execution.id}`,
    at: execution.startedAt,
    type: "execution",
    label: "Execution Started",
    status: "RUNNING",
    metadata: { skillVersionId: execution.skillVersionId },
  });

  if (execution.completedAt) {
    events.push({
      id: `exec-end-${execution.id}`,
      at: execution.completedAt,
      type: "execution",
      label:
        execution.status === "COMPLETED"
          ? "Execution Completed"
          : execution.status === "CANCELLED"
            ? "Execution Cancelled"
            : execution.status === "STEP_LIMIT_EXCEEDED"
              ? "Step Limit Exceeded"
              : "Execution Failed",
      status: execution.status,
      durationMs: execution.durationMs ?? undefined,
      metadata: execution.errorMessage ? { error: execution.errorMessage } : undefined,
    });
  }

  // 2. Node steps.
  for (const step of execution.steps ?? []) {
    const label = nodeLabel(step.nodeName);
    events.push({
      id: `step-${step.id}`,
      at: step.startedAt,
      type: "node",
      label,
      status: step.status,
      detail: step.nodeName === "tool_execution" ? undefined : summaryOf(step.stateSnapshot),
      metadata: step.stateSnapshot,
    });
  }

  // 3. Tool calls.
  for (const call of execution.toolCalls ?? []) {
    events.push({
      id: `tool-${call.id}`,
      at: call.executedAt,
      type: "tool",
      label: `Tool Executed · ${call.toolName}`,
      status: call.status,
      detail: `${call.toolName} · ${call.action}`,
      durationMs: call.durationMs ?? undefined,
      metadata: {
        toolName: call.toolName,
        action: call.action,
        input: call.inputArgs,
        output: call.outputResult,
        error: call.errorMessage,
      },
    });
  }

  // 4. Approval events.
  for (const approval of approvals) {
    events.push({
      id: `approval-req-${approval.id}`,
      at: approval.requestedAt,
      type: "approval",
      label: `Approval Requested · ${approval.toolName}`,
      status: approval.status,
      detail: `${approval.toolName} · ${approval.action}`,
      metadata: { inputPayload: approval.inputPayload },
    });

    if (approval.respondedAt && (approval.status === "APPROVED" || approval.status === "REJECTED")) {
      events.push({
        id: `approval-resp-${approval.id}`,
        at: approval.respondedAt,
        type: "approval",
        label: approval.status === "APPROVED" ? "Approval Approved" : "Approval Rejected",
        status: approval.status,
        detail: approval.rejectionReason ?? undefined,
      });
    }
  }

  // Approval history entries not already covered (e.g. RESUMED / CANCELLED).
  // The APPROVED/REJECTED history rows duplicate the response event above, so
  // they are skipped — only the lifecycle rows that add new information remain.
  for (const entry of approvalHistory) {
    if (entry.action === "APPROVED" || entry.action === "REJECTED") continue;
    events.push({
      id: `ah-${entry.id}`,
      at: entry.timestamp,
      type: "approval",
      label: `Approval ${entry.action}`,
      status: entry.action,
      metadata: entry.details,
    });
  }

  // 5. Structured logs (fallback for anything else). Tool calls are already
  // rendered from execution.toolCalls above, so TOOL_* log rows are skipped to
  // avoid rendering every tool call twice in the unified timeline.
  for (const log of execution.logs ?? []) {
    const covered =
      log.event.startsWith("EXECUTION_") ||
      log.event.startsWith("TOOL_") ||
      log.event === "APPROVAL_REQUESTED" ||
      log.event === "APPROVAL_RESPONDED";
    if (covered) continue;
    events.push({
      id: `log-${log.id}`,
      at: log.timestamp,
      type: "log",
      label: log.event,
      status: log.status ?? log.level,
      durationMs: log.durationMs ?? undefined,
      metadata: log.metadata,
    });
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function nodeLabel(nodeName: string): string {
  switch (nodeName) {
    case "planner":
      return "Planner Generated";
    case "permission":
      return "Permission Checked";
    case "tool_selection":
      return "Tool Selected";
    case "tool_execution":
      return "Tool Execution Node";
    case "approval":
      return "Approval Checkpoint";
    case "finish":
      return "Output Assembled";
    default:
      return nodeName;
  }
}

function summaryOf(snapshot: Record<string, unknown> | undefined): string | undefined {
  if (!snapshot || Object.keys(snapshot).length === 0) return undefined;
  const preview = JSON.stringify(snapshot);
  return preview.length > 80 ? `${preview.slice(0, 80)}…` : preview;
}
