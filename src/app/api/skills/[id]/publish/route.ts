import { NextResponse } from "next/server";
import { SkillService } from "@/services/SkillService";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";

const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { versionId } = body;
    if (!versionId) {
      return NextResponse.json({ success: false, error: "versionId is required" }, { status: 400 });
    }
    const published = await skillService.publishVersion(id, versionId);
    return NextResponse.json({ success: true, data: published });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
