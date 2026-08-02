import { z } from "zod";

export const respondApprovalSchema = z.object({
  approvalId: z.string().min(1, "Approval ID is required"),
  userId: z.string().min(1, "User ID is required"),
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
  idempotencyKey: z.string().min(1, "Idempotency key is required"),
});
