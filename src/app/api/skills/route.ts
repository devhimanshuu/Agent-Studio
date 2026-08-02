import { NextResponse } from "next/server";
import { createSkillSchema } from "@/validators/skillSchema";
import { SkillService } from "@/services/SkillService";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";

const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "demo-user-id";
  const skills = await skillService.getUserSkills(userId);
  return NextResponse.json({ success: true, data: skills });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createSkillSchema.parse(body);
    const skill = await skillService.createSkill(validated);
    return NextResponse.json({ success: true, data: skill }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to create skill" }, { status: 400 });
  }
}
