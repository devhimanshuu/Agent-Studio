import { IApprovalRepository } from "@/repositories/interfaces/IApprovalRepository";
import { ApprovalRequestDTO, RespondApprovalInput } from "@/types/approval";

/** In-memory approval repository mirroring the CAS semantics of the real one. */
export class FakeApprovalRepo implements IApprovalRepository {
  requests: ApprovalRequestDTO[] = [];
  private seq = 0;

  async findById(id: string): Promise<ApprovalRequestDTO | null> {
    return this.requests.find((r) => r.id === id) ?? null;
  }

  async findByExecutionId(executionId: string): Promise<ApprovalRequestDTO[]> {
    return this.requests.filter((r) => r.executionId === executionId);
  }

  async findPendingByUserId(userId: string): Promise<ApprovalRequestDTO[]> {
    return this.requests.filter((r) => r.userId === userId && r.status === "PENDING");
  }

  async findByUserId(userId: string): Promise<ApprovalRequestDTO[]> {
    return this.requests
      .filter((r) => r.userId === userId)
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  async create(request: Omit<ApprovalRequestDTO, "id" | "status" | "requestedAt">): Promise<ApprovalRequestDTO> {
    return this.upsertByIdempotencyKey(request);
  }

  async upsertByIdempotencyKey(
    request: Omit<ApprovalRequestDTO, "id" | "status" | "requestedAt">
  ): Promise<ApprovalRequestDTO> {
    const existing = this.requests.find((r) => r.idempotencyKey === request.idempotencyKey);
    if (existing) return existing;
    this.seq += 1;
    const row: ApprovalRequestDTO = {
      id: `approval-${this.seq}`,
      status: "PENDING",
      requestedAt: new Date(),
      ...request,
    };
    this.requests.push(row);
    return row;
  }

  async respond(input: RespondApprovalInput): Promise<ApprovalRequestDTO | null> {
    const existing = this.requests.find((r) => r.id === input.approvalId);
    if (!existing || existing.status !== "PENDING") return null;
    existing.status = input.approved ? "APPROVED" : "REJECTED";
    existing.respondedAt = new Date();
    existing.rejectionReason = input.rejectionReason;
    return existing;
  }

  async findByIdempotencyKey(key: string): Promise<ApprovalRequestDTO | null> {
    return this.requests.find((r) => r.idempotencyKey === key) ?? null;
  }
}
