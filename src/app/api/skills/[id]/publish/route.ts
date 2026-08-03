import { NextResponse } from "next/server";
import { SkillService } from "@/services/SkillService";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { publishSkillSchema } from "@/validators/skillSchema";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest, serverError, forbidden, notFound } from "@/lib/api/handlers";

const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = publishSkillSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error);

    const published = await skillService.publishVersion(id, userId, parsed.data.versionId);
    return NextResponse.json({ success: true, data: published });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Ownership violation (skill exists but belongs to someone else) → 403.
    // Genuinely missing skill/version → 404 (an owner passing a bad id should
    // see "not found", not a misleading 403).
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    // Business-rule violations (e.g. re-publishing a published version or
    // publishing an archived skill) are client errors → 400, not 500s.
    if (message.includes("cannot be published") || message.includes("Only draft")) {
      return badRequest(new Error(message));
    }
    return serverError(error);
  }
}
