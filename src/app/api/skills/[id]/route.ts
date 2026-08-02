import { NextResponse } from "next/server";
import { SkillService } from "@/services/SkillService";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { updateDraftSchema } from "@/validators/skillSchema";

const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const skill = await skillService.getSkill(id);
  if (!skill) {
    return NextResponse.json({ success: false, error: "Skill not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: skill });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateDraftSchema.parse(body);
    const updated = await skillService.updateDraft(id, validated);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
