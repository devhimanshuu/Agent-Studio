import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { SkillService } from "@/services/SkillService";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { updateSkillSchema } from "@/validators/skillSchema";
import { unauthorized, badRequest, serverError, notFound, forbidden } from "@/lib/api/handlers";

const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const skill = await skillService.getSkillForUser(id, userId);
    if (!skill) return notFound("Skill not found");
    return NextResponse.json({ success: true, data: skill });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateSkillSchema.parse(body);
    const updated = await skillService.updateSkill(id, userId, validated);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not found") || message.includes("access")) {
      return forbidden();
    }
    if (error instanceof Error && "issues" in error) {
      return badRequest(error); // Zod validation failure → 400
    }
    // Business-rule violations (e.g. editing an archived skill) are client
    // errors → 400, not 500s.
    if (message.includes("cannot be edited")) {
      return badRequest(new Error(message));
    }
    return serverError(error); // service/DB failure → 500
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    await skillService.deleteSkill(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    if (message.includes("cannot be deleted")) return badRequest(new Error(message));
    return serverError(error);
  }
}
