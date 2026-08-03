import { VersionDiffResult } from "@/types/observability";
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

export const compareApi = {
  compare: (versionA: string, versionB: string): Promise<VersionDiffResult> => {
    const params = new URLSearchParams({ versionA, versionB });
    return fetch(`/api/compare?${params.toString()}`).then((r) => handle<VersionDiffResult>(r));
  },
};
