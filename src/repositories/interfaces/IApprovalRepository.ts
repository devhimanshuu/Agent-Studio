import { ApprovalRequestDTO, RespondApprovalInput } from "@/types/approval";

export interface IApprovalRepository {
  findById(id: string): Promise<ApprovalRequestDTO | null>;
  findByExecutionId(executionId: string): Promise<ApprovalRequestDTO[]>;
  findPendingByUserId(userId: string): Promise<ApprovalRequestDTO[]>;
  create(request: Omit<ApprovalRequestDTO, "id" | "status" | "requestedAt">): Promise<ApprovalRequestDTO>;
  /**
   * Atomically transitions a PENDING request to APPROVED/REJECTED. Returns null
   * when no PENDING row matched (i.e. the request was already responded to) —
   * the caller must treat that as a single-use violation.
   */
  respond(input: RespondApprovalInput): Promise<ApprovalRequestDTO | null>;
  findByIdempotencyKey(key: string): Promise<ApprovalRequestDTO | null>;
}
