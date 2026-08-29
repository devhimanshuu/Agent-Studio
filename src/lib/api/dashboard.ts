import { DashboardStatsDTO, TimeRangeFilter } from "@/types/dashboard";
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

export const dashboardApi = {
  getStats: (timeRange: TimeRangeFilter = "7d"): Promise<DashboardStatsDTO> =>
    fetch(`/api/dashboard/stats?timeRange=${timeRange}`).then((r) => handle<DashboardStatsDTO>(r)),
};
