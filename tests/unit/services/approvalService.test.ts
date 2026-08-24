import { describe, it, expect } from "vitest";
import { ApprovalService } from "@/services/ApprovalService";
import { IApprovalRepository } from "@/repositories/interfaces/IApprovalRepository";
import { IAuditLogRepository } from "@/repositories/interfaces/IAuditLogRepository";
import { ApprovalRequestDTO, RespondApprovalInput } from "@/types/approval";

class FakeApprovalRepo implements IApprovalRepository {
  async expireStaleForUser(userId: string): Promise<number> {
    let n = 0;
    for (const r of this.requests.values()) {
      if (r.userId === userId && r.status === "PENDING") { r.status = "EXPIRED"; n += 1; }
    }
    return n;
  }
  requests = new Map<string, ApprovalRequestDTO>();
  respondCalls: RespondApprovalInput[] = [];
  /** When set, `respond` returns null without mutating — simulates losing the CAS race. */
  forceNullRespond = false;

  async findById(id: string): Promise<ApprovalRequestDTO | null> {
    return this.requests.get(id) ?? null;
  }
  async findByExecutionId(): Promise<ApprovalRequestDTO[]> {
    return [];
  }
  async findPendingByUserId(): Promise<ApprovalRequestDTO[]> {
    return [];
  }
  async findByUserId(): Promise<ApprovalRequestDTO[]> {
    return [];
  }
  async create(request: Omit<ApprovalRequestDTO, "id" | "status" | "requestedAt">): Promise<ApprovalRequestDTO> {
    return this.upsertByIdempotencyKey(request);
  }
  async upsertByIdempotencyKey(
    request: Omit<ApprovalRequestDTO, "id" | "status" | "requestedAt">
  ): Promise<ApprovalRequestDTO> {
    const existing = [...this.requests.values()].find((r) => r.idempotencyKey === request.idempotencyKey);
    if (existing) return existing;
    const created: ApprovalRequestDTO = { ...request, id: `req-${this.requests.size + 1}`, status: "PENDING", requestedAt: new Date() };
    this.requests.set(created.id, created);
    return created;
  }
  async respond(input: RespondApprovalInput): Promise<ApprovalRequestDTO | null> {
    this.respondCalls.push(input);
    if (this.forceNullRespond) return null;
    const a = this.requests.get(input.approvalId);
    if (!a) return null;
    // Mirror the repository's atomic compare-and-swap: only PENDING → terminal.
    if (a.status !== "PENDING") return null;
    a.status = input.approved ? "APPROVED" : "REJECTED";
    a.respondedAt = new Date();
    a.rejectionReason = input.rejectionReason;
    return a;
  }
  async findByIdempotencyKey(): Promise<ApprovalRequestDTO | null> {
    return null;
  }
  async expireByIdempotencyKey(key: string): Promise<void> {
    const existing = [...this.requests.values()].find((r) => r.idempotencyKey === key);
    if (existing && existing.status === "PENDING") existing.status = "EXPIRED";
  }
}

function makeApproval(overrides: Partial<ApprovalRequestDTO> = {}): ApprovalRequestDTO {
  return {
    id: "req-1",
    executionId: "exec-1",
    userId: "u1",
    toolName: "task_creator",
    action: "create",
    inputPayload: { title: "Write report" },
    status: "PENDING",
    idempotencyKey: "k-1",
    requestedAt: new Date(),
    ...overrides,
  };
}

function makeHarness() {
  const repo = new FakeApprovalRepo();
  const auditEntries: Record<string, unknown>[] = [];
  const auditRepo = {
    log: async (entry: unknown) => {
      auditEntries.push(entry as Record<string, unknown>);
      return { id: "log", details: {}, action: "", timestamp: new Date() };
    },
    findByUserId: async () => [],
  } as unknown as IAuditLogRepository;
  const service = new ApprovalService(repo, auditRepo);
  return { repo, auditEntries, service };
}

describe("ApprovalService.respondToApprovalForUser", () => {
  it("lets the owning user respond and records them as the audit actor", async () => {
    const { repo, auditEntries, service } = makeHarness();
    repo.requests.set("req-1", makeApproval());

    const result = await service.respondToApprovalForUser(
      { approvalId: "req-1", userId: "u1", approved: true, idempotencyKey: "k-1" },
      "u1"
    );

    expect(result.status).toBe("APPROVED");
    expect(repo.respondCalls).toHaveLength(1);
    expect(repo.respondCalls[0].userId).toBe("u1");
    expect(auditEntries[0].action).toBe("APPROVAL_GRANTED");
    expect(auditEntries[0].userId).toBe("u1");
  });

  it("rejects a non-owner without calling respond", async () => {
    const { repo, service } = makeHarness();
    repo.requests.set("req-1", makeApproval());

    await expect(
      service.respondToApprovalForUser(
        { approvalId: "req-1", userId: "u2", approved: true, idempotencyKey: "k-1" },
        "u2"
      )
    ).rejects.toThrow(/not found or you do not have access/);
    expect(repo.respondCalls).toHaveLength(0);
  });

  it("rejects a missing request", async () => {
    const { service } = makeHarness();
    await expect(
      service.respondToApprovalForUser(
        { approvalId: "nope", userId: "u1", approved: true, idempotencyKey: "k-1" },
        "u1"
      )
    ).rejects.toThrow(/not found or you do not have access/);
  });

  it("always uses the authenticated user, never a client-supplied userId", async () => {
    const { repo, auditEntries, service } = makeHarness();
    repo.requests.set("req-1", makeApproval());

    // The input carries a spoofed userId; the authed actor must win.
    await service.respondToApprovalForUser(
      { approvalId: "req-1", userId: "evil-user", approved: true, idempotencyKey: "k-1" },
      "u1"
    );

    expect(repo.respondCalls[0].userId).toBe("u1");
    expect(auditEntries[0].userId).toBe("u1");
  });
});

describe("ApprovalService idempotency enforcement", () => {
  it("rejects a replay of the same idempotency key after the first response", async () => {
    const { repo, auditEntries, service } = makeHarness();
    repo.requests.set("req-1", makeApproval());

    const first = await service.respondToApproval({
      approvalId: "req-1",
      userId: "u1",
      approved: true,
      idempotencyKey: "k-1",
    });
    expect(first.status).toBe("APPROVED");

    // Same key, same request — single-use: the key must never respond twice.
    await expect(
      service.respondToApproval({
        approvalId: "req-1",
        userId: "u1",
        approved: false,
        idempotencyKey: "k-1",
      })
    ).rejects.toThrow(/already in status APPROVED/);
    expect(repo.respondCalls).toHaveLength(1);
    expect(auditEntries).toHaveLength(1); // exactly one audit entry, one response
  });

  it("rejects a response carrying a key that belongs to a different request", async () => {
    const { repo, service } = makeHarness();
    repo.requests.set("req-1", makeApproval({ idempotencyKey: "k-1" }));
    repo.requests.set("req-2", makeApproval({ id: "req-2", idempotencyKey: "k-2" }));

    // Present req-2's key while responding to req-1 — forged/foreign token.
    await expect(
      service.respondToApproval({
        approvalId: "req-1",
        userId: "u1",
        approved: true,
        idempotencyKey: "k-2",
      })
    ).rejects.toThrow(/Invalid idempotency key/);
    expect(repo.respondCalls).toHaveLength(0);
  });

  it("throws when the atomic respond loses a race (concurrent duplicate)", async () => {
    const { repo, service } = makeHarness();
    repo.requests.set("req-1", makeApproval());
    repo.forceNullRespond = true; // simulate the CAS losing to a concurrent response

    await expect(
      service.respondToApproval({
        approvalId: "req-1",
        userId: "u1",
        approved: true,
        idempotencyKey: "k-1",
      })
    ).rejects.toThrow(/already responded to/);
  });
});
