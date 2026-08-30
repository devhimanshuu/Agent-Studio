/**
 * Integration tests for /api/approvals – exercises auth, error paths and
 * the full GET/POST flow backed by fake repositories.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Inline fakes inside vi.hoisted
// ---------------------------------------------------------------------------
const {
  fakeApprovalRepo,
  fakeHistoryRepo,
  mockApprovalEngine,
  mockApprovalHistoryService,
} = vi.hoisted(() => {
  class FakeApprovalRepo {
    requests = new Map();
    async findById(id: string) { return this.requests.get(id) ?? null; }
    async findByExecutionId(executionId: string) { return [...this.requests.values()].filter((r: any) => r.executionId === executionId); }
    async findPendingByUserId(userId: string) { return [...this.requests.values()].filter((r: any) => r.userId === userId && r.status === "PENDING"); }
    async findByUserId(userId: string) { return [...this.requests.values()].filter((r: any) => r.userId === userId); }
    async create(request: any) { const id = `approval-${this.requests.size + 1}`; const dto = { id, status: "PENDING", requestedAt: new Date(), ...request }; this.requests.set(id, dto); return dto; }
    async upsertByIdempotencyKey(request: any) { return this.create(request); }
    async respond(input: any) { const req = this.requests.get(input.approvalId); if (!req || req.status !== "PENDING") return null; req.status = input.response; return req; }
    async findByIdempotencyKey() { return null; }
    async expireByIdempotencyKey() {}
    async expireStaleForUser() { return 0; }
  }

  class FakeHistoryRepo {
    entries: any[] = [];
    private seq = 0;
    async log(input: any) { this.seq += 1; const dto = { id: `history-${this.seq}`, ...input, timestamp: new Date() }; this.entries.push(dto); return dto; }
    async findByApprovalId() { return []; }
    async findByExecutionId() { return []; }
  }

  // Lightweight stubs that match the interface routes actually call
  const mockApprovalEngine = {
    async approve() { return { success: true }; },
    async reject() { return { success: true }; },
  };
  const mockApprovalHistoryService = {
    async getTimeline() { return []; },
  };

  return {
    fakeApprovalRepo: new FakeApprovalRepo(),
    fakeHistoryRepo: new FakeHistoryRepo(),
    mockApprovalEngine,
    mockApprovalHistoryService,
  };
});

// --- mocks -----------------------------------------------------------------
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user-approvals" })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/api/rateLimit", () => ({
  rateLimit: vi.fn(() => null),
}));

vi.mock("@/repositories/ApprovalRepository", () => ({ ApprovalRepository: vi.fn(() => fakeApprovalRepo) }));
vi.mock("@/repositories/ApprovalHistoryRepository", () => ({ ApprovalHistoryRepository: vi.fn(() => fakeHistoryRepo) }));

vi.mock("@/lib/api/services", () => ({
  apiServices: vi.fn(() => ({
    approvalRepo: fakeApprovalRepo,
    historyRepo: fakeHistoryRepo,
    approvalEngine: mockApprovalEngine,
    approvalHistoryService: mockApprovalHistoryService,
  })),
}));

// --- import AFTER mocks ----------------------------------------------------
import { GET, POST } from "@/app/api/approvals/route";

describe("/api/approvals – integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeApprovalRepo.requests.clear();
    fakeHistoryRepo.entries = [];
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      const { auth } = await import("@clerk/nextjs/server");
      vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
      const res = await GET(new Request("http://localhost/api/approvals"));
      expect(res.status).toBe(401);
    });

    it("returns empty list when user has no approval requests", async () => {
      const res = await GET(new Request("http://localhost/api/approvals"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    it("returns approval requests belonging to the authenticated user", async () => {
      await fakeApprovalRepo.create({
        userId: "user-approvals",
        executionId: "exec-1",
        skillName: "Test Skill",
        toolName: "calculator",
        actionDescription: "Run calculation",
        idempotencyKey: "idem-1",
      });

      const res = await GET(new Request("http://localhost/api/approvals"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].status).toBe("PENDING");
    });

    it("returns approval requests with history attached", async () => {
      await fakeApprovalRepo.create({
        userId: "user-approvals",
        executionId: "exec-2",
        skillName: "Another Skill",
        toolName: "calculator",
        actionDescription: "Run calculation",
        idempotencyKey: "idem-2",
      });

      const res = await GET(new Request("http://localhost/api/approvals"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data[0].history).toBeDefined();
      expect(Array.isArray(body.data[0].history)).toBe(true);
    });
  });

  describe("POST", () => {
    it("returns 401 when unauthenticated", async () => {
      const { auth } = await import("@clerk/nextjs/server");
      vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
      const res = await POST(new Request("http://localhost/api/approvals", { method: "POST", body: JSON.stringify({ approvalId: "x", approved: true }) }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when body is invalid", async () => {
      const res = await POST(new Request("http://localhost/api/approvals", { method: "POST", body: JSON.stringify({}), headers: { "content-type": "application/json" } }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const res = await POST(new Request("http://localhost/api/approvals", { method: "POST", body: "not json", headers: { "content-type": "application/json" } }));
      expect(res.status).toBe(400);
    });

    it("approves a request with valid payload", async () => {
      await fakeApprovalRepo.create({
        userId: "user-approvals",
        executionId: "exec-1",
        skillName: "Test",
        toolName: "calc",
        actionDescription: "Do thing",
        idempotencyKey: "idem-approve",
      });

      const res = await POST(new Request("http://localhost/api/approvals", {
        method: "POST",
        body: JSON.stringify({ approvalId: "approval-1", approved: true, idempotencyKey: "idem-approve" }),
        headers: { "content-type": "application/json" },
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });
});
