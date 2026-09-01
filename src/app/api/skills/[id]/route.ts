import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { updateSkillSchema } from "@/validators/skillSchema";
import { unauthorized, handleApiError } from "@/lib/api/handlers";
import { NotFoundError } from "@/services/RBACService";
import { apiServices } from "@/lib/api/services";

const { skillService, rbacService } = apiServices();

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
    
    // Get skill to check organization context and return mapped DTO
    const skillData = await skillService.getSkill(id);
    if (!skillData) throw new NotFoundError("Skill not found");

    // Check access permission
    const hasAccess = await rbacService.canAccessResource(
      userId,
      skillData.organizationId || "",
      "skill",
      id,
      "read"
    );
    if (!hasAccess && skillData.userId !== userId) throw new NotFoundError("Skill not found");

    return NextResponse.json({ success: true, data: skillData });
  } catch (error) {
    return handleApiError(error);
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
    const skillData = await skillService.getSkill(id);
    if (!skillData) throw new NotFoundError("Skill not found");

    // Check edit permission
    const canEdit = await rbacService.canAccessResource(
      userId,
      skillData.organizationId || "",
      "skill",
      id,
      "write"
    );
    if (!canEdit && skillData.userId !== userId) throw new NotFoundError("Skill not found");

    const body = await request.json();
    const validated = updateSkillSchema.parse(body);
    const updated = await skillService.updateSkill(id, userId, validated);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error);
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
    const skillData = await skillService.getSkill(id);
    if (!skillData) throw new NotFoundError("Skill not found");

    // Check delete permission
    const canDelete = await rbacService.canAccessResource(
      userId,
      skillData.organizationId || "",
      "skill",
      id,
      "delete"
    );
    if (!canDelete && skillData.userId !== userId) throw new NotFoundError("Skill not found");

    await skillService.deleteSkill(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
