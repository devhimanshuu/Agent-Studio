import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { SkillService } from "@/services/SkillService";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { updateSkillSchema } from "@/validators/skillSchema";
import { unauthorized, badRequest, serverError, notFound, forbidden } from "@/lib/api/handlers";
import { RBACService, ForbiddenError } from "@/services/RBACService";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);
const rbacService = new RBACService();

/**
 * GET /api/skills/[id] — Get skill details
 * Supports organization-level access control
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    
    // Get skill to check organization context
    const skill = await prisma.skill.findUnique({
      where: { id },
      include: { versions: true },
    });
    
    if (!skill) return notFound("Skill not found");

    // Check access permission
    const hasAccess = await rbacService.canAccessResource(
      userId,
      skill.organizationId || "",
      "skill",
      id,
      "read"
    );

    if (!hasAccess) return forbidden();

    return NextResponse.json({ success: true, data: skill });
  } catch (error) {
    logger.error({ error }, "Failed to get skill");
    return serverError(error);
  }
}

/**
 * PATCH /api/skills/[id] — Update skill
 * Requires SKILL_EDITOR permission
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    
    // Get skill to check organization context
    const skill = await prisma.skill.findUnique({
      where: { id },
      select: { organizationId: true, userId: true },
    });
    
    if (!skill) return notFound("Skill not found");

    // Check edit permission
    if (skill.organizationId) {
      try {
        await rbacService.requireSkillPermission(userId, id, "SKILL_EDITOR");
      } catch (error) {
        if (error instanceof ForbiddenError) return forbidden();
        throw error;
      }
    } else {
      // Personal skill - only owner can edit
      if (skill.userId !== userId) return forbidden();
    }

    const body = await request.json();
    const validated = updateSkillSchema.parse(body);
    const updated = await skillService.updateSkill(id, userId, validated);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    if (error instanceof Error && "issues" in error) {
      return badRequest(error); // Zod validation failure → 400
    }
    if (message.includes("cannot be edited")) {
      return badRequest(new Error(message));
    }
    if (error instanceof ForbiddenError) return forbidden();
    logger.error({ error }, "Failed to update skill");
    return serverError(error);
  }
}

/**
 * DELETE /api/skills/[id] — Delete skill
 * Requires SKILL_ADMIN permission
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    
    // Get skill to check organization context
    const skill = await prisma.skill.findUnique({
      where: { id },
      select: { organizationId: true, userId: true },
    });
    
    if (!skill) return notFound("Skill not found");

    // Check delete permission
    if (skill.organizationId) {
      try {
        await rbacService.requireSkillPermission(userId, id, "SKILL_ADMIN");
      } catch (error) {
        if (error instanceof ForbiddenError) return forbidden();
        throw error;
      }
    } else {
      // Personal skill - only owner can delete
      if (skill.userId !== userId) return forbidden();
    }

    await skillService.deleteSkill(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    if (message.includes("cannot be deleted")) return badRequest(new Error(message));
    if (error instanceof ForbiddenError) return forbidden();
    logger.error({ error }, "Failed to delete skill");
    return serverError(error);
  }
}
