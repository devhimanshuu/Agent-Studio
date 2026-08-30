/**
 * Skill Permissions Routes
 *
 * GET    /api/skills/[id]/permissions — Get skill permissions
 * POST   /api/skills/[id]/permissions — Set skill permissions
 * DELETE /api/skills/[id]/permissions — Reset to org defaults
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { RBACService, ForbiddenError } from "@/services/RBACService";
import { unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/api/handlers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const rbacService = new RBACService();

// Valid skill permissions
const VALID_PERMISSIONS = ["SKILL_ADMIN", "SKILL_EDITOR", "SKILL_EXECUTOR", "SKILL_VIEWER"];

/**
 * GET /api/skills/[id]/permissions — Get skill permissions
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;

    // Get skill
    const skill = await prisma.skill.findUnique({
      where: { id },
      select: { organizationId: true, userId: true },
    });

    if (!skill) return notFound("Skill not found");

    // Check permission
    if (skill.organizationId) {
      const membership = await rbacService.getOrgMembership(userId, skill.organizationId);
      if (!membership) return forbidden();
    } else {
      if (skill.userId !== userId) return forbidden();
    }

    // Get permissions for the skill
    const permissions = await rbacService.getUserSkillPermissions(userId, id);

    return NextResponse.json({
      success: true,
      data: {
        skillId: id,
        permissions: permissions.permissions,
        isOwner: skill.userId === userId,
        organizationId: skill.organizationId,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get skill permissions");
    return serverError(error);
  }
}

/**
 * POST /api/skills/[id]/permissions — Set skill permissions for a user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    if (!body.targetUserId) {
      return badRequest(new Error("targetUserId is required"));
    }

    if (!body.permissions || !Array.isArray(body.permissions)) {
      return badRequest(new Error("permissions must be an array"));
    }

    // Validate permissions
    const invalidPermissions = body.permissions.filter(
      (p: string) => !VALID_PERMISSIONS.includes(p)
    );
    if (invalidPermissions.length > 0) {
      return badRequest(new Error(`Invalid permissions: ${invalidPermissions.join(", ")}`));
    }

    // Get skill
    const skill = await prisma.skill.findUnique({
      where: { id },
      select: { organizationId: true, userId: true },
    });

    if (!skill) return notFound("Skill not found");

    // Must be in an organization to set permissions
    if (!skill.organizationId) {
      return badRequest(new Error("Skill permissions can only be set for organization skills"));
    }

    // Check permission (only SKILL_ADMIN can set permissions)
    try {
      await rbacService.requireSkillPermission(userId, id, "SKILL_ADMIN");
    } catch (error) {
      if (error instanceof ForbiddenError) return forbidden();
      throw error;
    }

    // Check if target user is a member of the organization
    const targetMembership = await rbacService.getOrgMembership(
      body.targetUserId,
      skill.organizationId
    );

    if (!targetMembership) {
      return badRequest(new Error("Target user is not a member of this organization"));
    }

    // Store permissions in the skill's metadata or a separate table
    // For now, we'll store in a JSON field on the skill
    // In production, you'd want a separate SkillPermission table
    const currentPermissions = (await prisma.skill.findUnique({
      where: { id },
      select: { graphDefinition: true },
    }))?.graphDefinition as Record<string, unknown> || {};

    const skillPermissions = (currentPermissions.skillPermissions as Record<string, string[]>) || {};
    skillPermissions[body.targetUserId] = body.permissions;

    await prisma.skill.update({
      where: { id },
      data: {
        graphDefinition: {
          ...currentPermissions,
          skillPermissions,
        },
      },
    });

    logger.info({ skillId: id, targetUserId: body.targetUserId, permissions: body.permissions }, "Skill permissions updated");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof ForbiddenError) return forbidden();
    logger.error({ error }, "Failed to set skill permissions");
    return serverError(error);
  }
}

/**
 * DELETE /api/skills/[id]/permissions — Reset skill permissions to org defaults
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("targetUserId");

    if (!targetUserId) {
      return badRequest(new Error("targetUserId query parameter is required"));
    }

    // Get skill
    const skill = await prisma.skill.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!skill) return notFound("Skill not found");

    if (!skill.organizationId) {
      return badRequest(new Error("Skill permissions can only be managed for organization skills"));
    }

    // Check permission
    try {
      await rbacService.requireSkillPermission(userId, id, "SKILL_ADMIN");
    } catch (error) {
      if (error instanceof ForbiddenError) return forbidden();
      throw error;
    }

    // Remove user's custom permissions
    const currentPermissions = (await prisma.skill.findUnique({
      where: { id },
      select: { graphDefinition: true },
    }))?.graphDefinition as Record<string, unknown> || {};

    const skillPermissions = (currentPermissions.skillPermissions as Record<string, string[]>) || {};
    delete skillPermissions[targetUserId];

    await prisma.skill.update({
      where: { id },
      data: {
        graphDefinition: {
          ...currentPermissions,
          skillPermissions,
        },
      },
    });

    logger.info({ skillId: id, targetUserId }, "Skill permissions reset");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ForbiddenError) return forbidden();
    logger.error({ error }, "Failed to reset skill permissions");
    return serverError(error);
  }
}
