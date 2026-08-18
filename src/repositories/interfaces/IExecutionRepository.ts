import {
  ExecutionDTO,
  ExecutionStepDTO,
  ToolCallDTO,
  StartExecutionInput,
  ExecutionQuery,
} from "@/types/execution";

export interface IExecutionRepository {
  findById(id: string): Promise<ExecutionDTO | null>;
  /** Scoped to the owning user — returns null when the execution belongs to someone else. */
  findByIdForUser(id: string, userId: string): Promise<ExecutionDTO | null>;
  findByUserId(userId: string): Promise<ExecutionDTO[]>;
  /** Returns total number of executions for the owning user. */
  countByUserId(userId: string): Promise<number>;
  /** Searchable / filterable / sortable execution history for the owning user. */
  listForUser(userId: string, query: ExecutionQuery): Promise<ExecutionDTO[]>;
  create(input: StartExecutionInput, maxSteps: number, skillName?: string): Promise<ExecutionDTO>;
  updateStatus(id: string, status: ExecutionDTO["status"], errorMessage?: string): Promise<ExecutionDTO>;
  addStep(executionId: string, step: Omit<ExecutionStepDTO, "id" | "executionId">): Promise<ExecutionStepDTO>;
  addToolCall(executionId: string, toolCall: Omit<ToolCallDTO, "id" | "executionId" | "executedAt">): Promise<ToolCallDTO>;
  /** Aggregated usage counts per tool name (tools dashboard metric). Scoped to
   * the owning user when provided. */
  countToolCallsByTool(userId?: string): Promise<Record<string, number>>;
  /** Most recent tool calls for a given tool (tool details page). Scoped to
   * the owning user when provided — never leaks another user's invocations. */
  findToolCallsByToolName(toolName: string, userId?: string, limit?: number): Promise<ToolCallDTO[]>;
  setFinalOutput(id: string, output: Record<string, unknown>): Promise<ExecutionDTO>;
  /** Persist runtime details captured during execution (provider used, plan, duration). */
  setRuntimeDetails(
    id: string,
    details: { provider?: string; plannerOutput?: Record<string, unknown>; durationMs?: number }
  ): Promise<ExecutionDTO>;
  /** Link a newly created execution back to the run it was replayed from. */
  setReplayedFrom(id: string, replayedFromExecutionId: string): Promise<ExecutionDTO>;
  /** Observability aggregations for the owning user. */
  getMetrics(userId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    cancelled: number;
    paused: number;
    avgDurationMs: number;
    mostUsedSkills: { skillName: string; count: number }[];
  }>;
  /** Approval summary (total + pending) for the owning user. */
  getApprovalSummary(userId: string): Promise<{ total: number; pending: number }>;
}
