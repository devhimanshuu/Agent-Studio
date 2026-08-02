import { NextResponse } from "next/server";
import { respondApprovalSchema } from "@/validators/approvalSchema";
import { ApprovalService } from "@/services/ApprovalService";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";

const approvalRepo = new ApprovalRepository();
const auditRepo = new AuditLogRepository();
const approvalService = new ApprovalService(approvalRepo, auditRepo);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "demo-user-id";
  const pending = await approvalService.getPendingApprovals(userId);
  return NextResponse.json({ success: true, data: pending });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = respondApprovalSchema.parse(body);
    const result = await approvalService.respondToApproval(validated);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Approval request failed" }, { status: 400 });
  }
}
