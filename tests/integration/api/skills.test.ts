/**
 * Integration tests for /api/skills – exercises the full route handler → service
 * → fake repository stack without touching a real database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fake repos MUST be defined inside vi.hoisted() because it runs before
// any top-level declarations (classes, imports, variables).
// ---------------------------------------------------------------------------
const { fakeSkillRepo, fakeAuditRepo } = vi.hoisted(() => {
  class FakeSkillRepo {
    skills = new Map();
    versions = new Map();
    private skillSeq = 0;
    private versionSeq = 0;
    async findById(id: string) { return this.skills.get(id) ?? null; }
    async findByIdForUser(id: string, userId: string) { const s = this.skills.get(id); return s && s.userId === userId ? s : null; }
    async findByUserId(userId: string) { return [...this.skills.values()].filter((s: any) => s.userId === userId); }
    async list(userId: string, _query: any) { const items = [...this.skills.values()].filter((s: any) => s.userId === userId); return { items, total: items.length }; }
    async create(input: any) {
      this.skillSeq += 1; this.versionSeq += 1;
      const skillId = `skill-${this.skillSeq}`, versionId = `version-${this.versionSeq}`, now = new Date();
      const version = { id: versionId, skillId, versionNumber: 1, status: "DRAFT", inputSchema: input.inputSchema ?? {}, outputSchema: input.outputSchema ?? {}, instructions: input.instructions ?? "", examples: input.examples ?? [], allowedTools: input.allowedTools ?? [], actionsRequiringApproval: input.actionsRequiringApproval ?? [], maxExecutionSteps: input.maxExecutionSteps ?? 10, notes: input.notes ?? null, createdAt: now };
      this.versions.set(versionId, version);
      const skill = { id: skillId, userId: input.userId, name: input.name, purpose: input.purpose, status: "DRAFT", currentDraftId: versionId, createdAt: now, updatedAt: now, currentDraft: version, versions: [version] };
      this.skills.set(skillId, skill); return skill;
    }
    async updateDraft(skillId: string, _userId: string, input: any) {
      const skill = this.skills.get(skillId); if (!skill) throw new Error("Skill not found");
      if (input.name !== undefined) skill.name = input.name; skill.updatedAt = new Date();
      return this.versions.get(skill.currentDraftId)!;
    }
    async duplicate(skillId: string, userId: string) {
      const skill = this.skills.get(skillId); if (!skill) throw new Error("Skill not found");
      const v = skill.versions?.[0];
      return this.create({ userId, name: `${skill.name} (Copy)`, purpose: skill.purpose, allowedTools: v?.allowedTools ?? ["calculator"], maxExecutionSteps: 10 });
    }
    async archive(skillId: string) { const s = this.skills.get(skillId); if (!s) throw new Error("Skill not found"); s.status = "ARCHIVED"; return s; }
    async deleteDraft(skillId: string) { this.skills.delete(skillId); }
    async publishVersion(skillId: string, _userId: string, versionId: string) {
      const skill = this.skills.get(skillId); if (!skill) throw new Error("Skill not found");
      const v = this.versions.get(versionId); if (!v) throw new Error("Version not found");
      v.status = "PUBLISHED"; skill.status = "PUBLISHED"; return v;
    }
    async findVersionById(versionId: string) { return this.versions.get(versionId) ?? null; }
    async findVersionsBySkillId(skillId: string) { return [...this.versions.values()].filter((v: any) => v.skillId === skillId); }
  }

  class FakeAuditRepo {
    logs: any[] = [];
    private seq = 0;
    async log(entry: any) { this.seq += 1; const dto = { id: `audit-${this.seq}`, ...entry, timestamp: new Date() }; this.logs.push(dto); return dto; }
    async findByUserId() { return []; }
    async listForUser() { return []; }
  }

  return { fakeSkillRepo: new FakeSkillRepo(), fakeAuditRepo: new FakeAuditRepo() };
});

// --- mocks must come before imports that reference them --------------------
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user-abc" })),
  createClerkClient: vi.fn(() => ({
    users: { getUser: vi.fn() },
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/repositories/SkillRepository", () => ({
  SkillRepository: vi.fn(() => fakeSkillRepo),
}));
vi.mock("@/repositories/AuditLogRepository", () => ({
  AuditLogRepository: vi.fn(() => fakeAuditRepo),
}));

// --- import AFTER mocks ---------------------------------------------------
import { GET, POST } from "@/app/api/skills/route";

describe("/api/skills – integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeSkillRepo.skills.clear();
    fakeSkillRepo.versions.clear();
  });

  // GET
  describe("GET", () => {
    it("returns 401 when Clerk reports no userId", async () => {
      const { auth } = await import("@clerk/nextjs/server");
      vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
      const res = await GET(new Request("http://localhost/api/skills"));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe("UNAUTHENTICATED");
    });

    it("returns an empty list when the user has no skills", async () => {
      const res = await GET(new Request("http://localhost/api/skills"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.items).toEqual([]);
      expect(body.data.total).toBe(0);
    });

    it("returns skills that belong to the authenticated user", async () => {
      await fakeSkillRepo.create({ userId: "user-abc", name: "Sentiment Analyzer", purpose: "Classifies text sentiment", allowedTools: ["calculator"] });
      const res = await GET(new Request("http://localhost/api/skills"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.items.length).toBe(1);
      expect(body.data.items[0].name).toBe("Sentiment Analyzer");
    });

    it("validates query parameters and returns 400 on invalid status", async () => {
      const res = await GET(new Request("http://localhost/api/skills?status=INVALID"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("passes through search and sort query params", async () => {
      await fakeSkillRepo.create({ userId: "user-abc", name: "Alpha", purpose: "First", allowedTools: ["calculator"] });
      await fakeSkillRepo.create({ userId: "user-abc", name: "Beta", purpose: "Second", allowedTools: ["calculator"] });
      const res = await GET(new Request("http://localhost/api/skills?search=Beta&sortBy=name&sortOrder=asc"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // POST
  describe("POST", () => {
    it("returns 401 when Clerk reports no userId", async () => {
      const { auth } = await import("@clerk/nextjs/server");
      vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
      const res = await POST(new Request("http://localhost/api/skills", { method: "POST", body: JSON.stringify({ name: "Test", purpose: "Test purpose long enough", allowedTools: ["calculator"] }) }));
      expect(res.status).toBe(401);
    });

    it("creates a skill with valid payload and returns 201", async () => {
      const payload = { name: "Data Processor", purpose: "Processes incoming data streams", instructions: "Read the input and produce a summary", allowedTools: ["calculator"], maxExecutionSteps: 10 };
      const req = new Request("http://localhost/api/skills", { method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json" } });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("Data Processor");
      expect(body.data.userId).toBe("user-abc");
      expect(body.data.status).toBe("DRAFT");
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await POST(new Request("http://localhost/api/skills", { method: "POST", body: JSON.stringify({ name: "X" }), headers: { "content-type": "application/json" } }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for invalid JSON body", async () => {
      const res = await POST(new Request("http://localhost/api/skills", { method: "POST", body: "not-json", headers: { "content-type": "application/json" } }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid JSON body");
    });

    it("returns 400 when allowedTools is empty", async () => {
      const res = await POST(new Request("http://localhost/api/skills", { method: "POST", body: JSON.stringify({ name: "Empty Tools", purpose: "No tools allowed here is quite invalid", allowedTools: [] }), headers: { "content-type": "application/json" } }));
      expect(res.status).toBe(400);
    });
  });
});
