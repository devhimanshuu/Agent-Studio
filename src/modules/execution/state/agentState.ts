import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { ExecutionStatus } from "@/types/execution";

/**
 * A single step of an execution plan. Every step maps to one tool action the
 * runtime is permitted to take (or `none` for pure data pass-through steps).
 */
export interface PlannedStep {
  stepNumber: number;
  /** Tool name to invoke — `"none"` marks a non-tool (data) step. */
  toolName: string;
  action: string;
  input: Record<string, unknown>;
  /** True when the plan flagged this action for human approval. */
  requiresApproval: boolean;
}

/** Deterministic plan produced by the planner node. */
export interface ExecutionPlan {
  reasoning: string;
  requiredTools: string[];
  steps: PlannedStep[];
  expectedOutput: string;
}

export type ToolCallStatus = "PENDING" | "SUCCESS" | "ERROR" | "BLOCKED" | "REJECTED";

/** Runtime record of one executed (or attempted) tool call. */
export interface ToolCallRecord {
  stepNumber: number;
  toolName: string;
  action: string;
  input: Record<string, unknown>;
  status: ToolCallStatus;
  output?: unknown;
  error?: string;
  requiresApproval: boolean;
  /** Wall-clock execution time in ms (includes retries). */
  durationMs?: number;
}

export type ApprovalStatus = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";

/**
 * The strongly typed Agent State — the single source of truth shared by every
 * graph node. The runtime is GRAPH-FIRST: this state flows through the nodes,
 * and the LLM is only ever consulted by the planner node, never the center of
 * the system.
 */
export interface AgentState {
  executionId: string;
  /** Loaded skill + version being executed. */
  skill: SkillDTO | null;
  version: SkillVersionDTO | null;
  /** Validated user input. */
  input: Record<string, unknown>;
  /** Plan produced by the planner node. */
  plan: ExecutionPlan | null;
  /** Number of plan steps already processed (0-based index of next step). */
  currentStep: number;
  /** True when the CURRENT step must pause for human approval (plan flag,
   * version action list, or the tool's own requiresApproval contract). */
  approvalPending: boolean;
  /** Every tool call attempted during the run. */
  toolCalls: ToolCallRecord[];
  /** Collected outputs keyed by `step_<n>`. */
  results: Record<string, unknown>;
  /** Accumulated errors across nodes. */
  errors: string[];
  retries: number;
  approvalStatus: ApprovalStatus;
  executionStatus: ExecutionStatus;
  finalOutput: Record<string, unknown> | null;
  /** LLM provider/model that served the planner, e.g. `groq/llama-3.3-70b-versatile`. */
  providerUsed: string | null;
}

/** Initial Agent State for a new execution. */
export function createInitialAgentState(input: {
  executionId: string;
  skill: SkillDTO;
  version: SkillVersionDTO;
  userInput: Record<string, unknown>;
}): AgentState {
  return {
    executionId: input.executionId,
    skill: input.skill,
    version: input.version,
    input: input.userInput,
    plan: null,
    currentStep: 0,
    approvalPending: false,
    toolCalls: [],
    results: {},
    errors: [],
    retries: 0,
    approvalStatus: "NOT_REQUIRED",
    executionStatus: "RUNNING",
    finalOutput: null,
    providerUsed: null,
  };
}
