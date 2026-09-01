import { SkillDTO, SkillVersionDTO, SkillListQuery, SkillListResult, CreateSkillInput, UpdateSkillInput } from "@/types/skill";

export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string; code?: string; fields?: Record<string, string[]> };

async function handle<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    const payload = json as { success: false; error?: string; fields?: Record<string, string[]> };
    const error = new Error(payload.error || "Request failed") as Error & { fields?: Record<string, string[]>; status?: number };
    error.fields = payload.fields;
    error.status = res.status;
    throw error;
  }
  return json.data;
}

function buildSkillsQuery(query: SkillListQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  const qs = params.toString();
  return qs ? `/api/skills?${qs}` : "/api/skills";
}

export const skillsApi = {
  list: (query: SkillListQuery): Promise<SkillListResult> =>
    fetch(buildSkillsQuery(query)).then((r) => handle<SkillListResult>(r)),

  get: (id: string): Promise<SkillDTO> => fetch(`/api/skills/${id}`).then((r) => handle<SkillDTO>(r)),

  create: (input: Omit<CreateSkillInput, "userId">): Promise<SkillDTO> =>
    fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => handle<SkillDTO>(r)),

  update: (id: string, input: UpdateSkillInput): Promise<SkillVersionDTO> =>
    fetch(`/api/skills/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => handle<SkillVersionDTO>(r)),

  duplicate: (id: string): Promise<SkillDTO> =>
    fetch(`/api/skills/${id}/duplicate`, { method: "POST" }).then((r) => handle<SkillDTO>(r)),

  archive: (id: string): Promise<SkillDTO> =>
    fetch(`/api/skills/${id}/archive`, { method: "POST" }).then((r) => handle<SkillDTO>(r)),

  restore: (id: string): Promise<SkillDTO> =>
    fetch(`/api/skills/${id}/restore`, { method: "POST" }).then((r) => handle<SkillDTO>(r)),

  publish: (id: string, versionId: string): Promise<SkillVersionDTO> =>
    fetch(`/api/skills/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    }).then((r) => handle<SkillVersionDTO>(r)),

  delete: (id: string): Promise<void> =>
    fetch(`/api/skills/${id}`, { method: "DELETE" }).then((r) => handle<void>(r)),
};
