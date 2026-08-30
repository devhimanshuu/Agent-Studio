import { AuditLogDTO } from "@/repositories/interfaces/IAuditLogRepository";
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

interface AuditExportPayload {
  exportedAt: string;
  count: number;
  entries: AuditLogDTO[];
}

export interface AuditFilters {
  search?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export const auditApi = {
  list: (filters: AuditFilters = {}): Promise<AuditLogDTO[]> => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.action) params.set("action", filters.action);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return fetch(qs ? `/api/audit?${qs}` : "/api/audit").then((r) => handle<AuditLogDTO[]>(r));
  },

  export: (filters: AuditFilters = {}): Promise<AuditExportPayload> => {
    const params = new URLSearchParams({ export: "1" });
    if (filters.search) params.set("search", filters.search);
    if (filters.action) params.set("action", filters.action);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    return fetch(`/api/audit?${params.toString()}`).then((r) => handle<AuditExportPayload>(r));
  },
};
