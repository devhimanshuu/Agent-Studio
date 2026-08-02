import { ApprovalRequestDTO, RespondApprovalInput } from "@/types/approval";

export interface IApprovalRepository {
  findById(id: string): Promise<ApprovalRequestDTO | null>;
  findByExecutionId(executionId: string): Promise<ApprovalRequestDTO[]>;
  findPendingByUserId(userId: string): Promise<ApprovalRequestDTO[]>;
  create(request: Omit<ApprovalRequestDTO, "id" | "status" | "requestedAt">): Promise<ApprovalRequestDTO>;
  respond(input: RespondApprovalInput): Promise<ApprovalRequestDTO>;
  findByIdempotencyKey(key: string): Promise<ApprovalRequestDTO | null>;
}
