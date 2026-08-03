import { ToolCategory, ToolType } from "@/types/tool";

/** Health probe result surfaced on the tools dashboard. */
export interface ToolHealth {
  status: "healthy" | "degraded" | "unavailable";
  /** Time taken by the health probe in ms. */
  latencyMs: number;
  message?: string;
}

/**
 * The single contract every tool implements. The Agent Runtime knows NOTHING
 * about tool implementation details — it resolves tools through the registry
 * and calls `execute`. Adding a new tool = implement this interface + register
 * it (self-registration through the registry factory).
 */
export interface Tool {
  /** Stable unique identifier, e.g. `calculator`. */
  id: string;
  /** Registry key — must equal `id`. The plan references tools by this name. */
  name: string;
  /** Human-friendly label shown in the UI, e.g. `Calculator`. */
  displayName: string;
  description: string;
  /** High-level bucket used by the dashboard. */
  category: ToolCategory;
  /** READ tools never mutate state; WRITE tools may (and require approval). */
  type: ToolType;
  /** JSON Schema describing the accepted `input` shape (display + catalog). */
  inputSchema: Record<string, unknown>;
  /** JSON Schema describing the structured `output` shape (display). */
  outputSchema: Record<string, unknown>;
  /** True when every invocation must pause for human approval (WRITE tools). */
  requiresApproval: boolean;
  /** Disabled tools are rejected by the PermissionChecker before execution. */
  enabled: boolean;
  /** Optional per-invocation wall-clock budget in ms. Defaults to the
   * registry-level timeout. */
  timeoutMs?: number;
  /** Runs the tool. MUST reject with an Error on any failure. */
  execute(input: Record<string, unknown>): Promise<unknown>;
  /** Zod-backed input validation. Returns human-readable issues (empty = valid). */
  validate(input: Record<string, unknown>): string[];
  /** Lightweight liveness probe for the tools dashboard. */
  healthCheck(): Promise<ToolHealth>;
}
