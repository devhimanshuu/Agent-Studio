import { NextResponse } from "next/server";
import { SkillService } from "@/services/SkillService";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, serverError, forbidden } from "@/lib/api/handlers";

const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return unauthorized();

    const { id } = await params;
    const duplicated = await skillService.duplicateSkill(id, userId);
    return NextResponse.json({ success: true, data: duplicated }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not found") || message.includes("access")) return forbidden();
    return serverError(error);
  }
}
