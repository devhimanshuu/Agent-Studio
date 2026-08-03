import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { respondApprovalSchema } from "@/validators/approvalSchema";
import { ApprovalService } from "@/services/ApprovalService";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { unauthorized, forbidden, badRequest, serverError } from "@/lib/api/handlers";

const approvalRepo = new ApprovalRepository();
const auditRepo = new AuditLogRepository();
const approvalService = new ApprovalService(approvalRepo, auditRepo);

export async function GET(_request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  // Scoped to the authenticated user — previously the queue was readable by
  // passing any `?userId=` query param (or the "demo-user-id" fallback).
  const pending = await approvalService.getPendingApprovals(userId);
  return NextResponse.json({ success: true, data: pending });
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return unauthorized();

    const body = await request.json();
    // Never trust a client-supplied userId — the authenticated session wins.
    const validated = respondApprovalSchema.parse({ ...body, userId });
    const result = await approvalService.respondToApprovalForUser(validated, userId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Ownership / not-found → 403 (don't leak which request ids exist).
    if (message.includes("not found") || message.includes("access")) {
      return forbidden();
    }
    if (error instanceof Error && "issues" in error) {
      return badRequest(error); // Zod validation failure → 400
    }
    if (error instanceof Error) {
      return badRequest(new Error(error.message)); // business rule (already responded) → 400
    }
    return serverError(error);
  }
}
