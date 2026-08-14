import { ExecutionDTO, ExecutionQuery } from "@/types/execution";
import { ObservabilityMetrics } from "@/types/observability";
import { ExecutionDetail } from "@/modules/history/executionHistoryService";
import { ApiResponse } from "./skills";

async function handle<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    const payload = json as { success: false; error?: string };
    const error = new Error(payload.error || "Request failed") as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return json.data;
}

function buildQuery(query: ExecutionQuery = {}): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.skillName) params.set("skillName", query.skillName);
  if (query.provider) params.set("provider", query.provider);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return qs ? `/api/executions?${qs}` : "/api/executions";
}

export const executionsApi = {
  /** List with optional search / filter / sort (history + observability pages). */
  list: (query: ExecutionQuery = {}): Promise<ExecutionDTO[]> =>
    fetch(buildQuery(query)).then((r) => handle<ExecutionDTO[]>(r)),

  /** Full trace: execution + logs + timeline + approvals. */
  detail: (id: string): Promise<ExecutionDetail> =>
    fetch(`/api/executions/${id}/detail`).then((r) => handle<ExecutionDetail>(r)),

  /** JSON export of the full execution report. */
  exportReport: (id: string): Promise<ExecutionDetail & { exportedAt: string }> =>
    fetch(`/api/executions/${id}/export`).then((r) => handle<ExecutionDetail & { exportedAt: string }>(r)),

  /** Observability widgets. */
  metrics: (): Promise<ObservabilityMetrics> =>
    fetch("/api/executions/metrics").then((r) => handle<ObservabilityMetrics>(r)),

  start: (skillVersionId: string, inputData: Record<string, unknown>): Promise<ExecutionDTO> =>
    fetch("/api/executions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillVersionId, inputData }),
    }).then((r) => handle<ExecutionDTO>(r)),

  cancel: (id: string): Promise<ExecutionDTO> =>
    fetch(`/api/executions/${id}/cancel`, { method: "POST" }).then((r) => handle<ExecutionDTO>(r)),

  /** Replay a previous execution — creates a NEW linked run, never mutates history. */
  replay: (id: string): Promise<ExecutionDTO> =>
    fetch(`/api/executions/${id}/replay`, { method: "POST" }).then((r) => handle<ExecutionDTO>(r)),

  resume: (id: string, approvalId: string, idempotencyKey: string): Promise<ExecutionDTO> =>
    fetch(`/api/executions/${id}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId, idempotencyKey }),
    }).then((r) => handle<ExecutionDTO>(r)),

  /** Step-level safe retry / recovery: resumes a failed run from the failed step. */
  retry: (id: string): Promise<ExecutionDTO> =>
    fetch(`/api/executions/${id}/retry`, { method: "POST" }).then((r) => handle<ExecutionDTO>(r)),
};

