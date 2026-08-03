import { ExecutionDTO } from "@/types/execution";
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

export const executionsApi = {
  list: (): Promise<ExecutionDTO[]> => fetch("/api/executions").then((r) => handle<ExecutionDTO[]>(r)),

  get: (id: string): Promise<ExecutionDTO> =>
    fetch(`/api/executions/${id}`).then((r) => handle<ExecutionDTO>(r)),

  start: (skillVersionId: string, inputData: Record<string, unknown>): Promise<ExecutionDTO> =>
    fetch("/api/executions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillVersionId, inputData }),
    }).then((r) => handle<ExecutionDTO>(r)),

  cancel: (id: string): Promise<ExecutionDTO> =>
    fetch(`/api/executions/${id}/cancel`, { method: "POST" }).then((r) => handle<ExecutionDTO>(r)),
};
