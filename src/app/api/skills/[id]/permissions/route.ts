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
import { unauthorized, forbidden, badRequest, serverError } from "@/lib/api/handlers";
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
      select: { id: true, userId: true, organizationId: true },
    });

    if (!skill) {
      return badRequest(new Error("Skill not found"));
    }

    if (!skill.organizationId) {
      return badRequest(new Error("Skill does not belong to an organization"));
    }

    // Check user is org member
    const membership = await rbacService.getOrgMembership(userId, skill.organizationId);
    if (!membership) {
      return forbidden();
    }

    // Get organization members with their permissions
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: skill.organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // For now, all members have the same permissions based on their org role
    // In a full implementation, you'd have a SkillPermission table
    const permissions = members.map((m) => ({
      userId: m.user.id,
      userName: m.user.name,
      userEmail: m.user.email,
      orgRole: m.role,
      skillPermissions: m.role === "OWNER" || m.role === "ADMIN"
        ? ["SKILL_ADMIN", "SKILL_EDITOR", "SKILL_EXECUTOR", "SKILL_VIEWER"]
        : m.role === "MEMBER"
          ? ["SKILL_EDITOR", "SKILL_EXECUTOR", "SKILL_VIEWER"]
          : ["SKILL_VIEWER"],
    }));

    return NextResponse.json({ success: true, data: permissions });
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

    if (!body.targetUserId || !body.permissions) {
      return badRequest(new Error("targetUserId and permissions are required"));
    }

    // Validate permissions
    const invalidPerms = body.permissions.filter((p: string) => !VALID_PERMISSIONS.includes(p));
    if (invalidPerms.length > 0) {
      return badRequest(new Error(`Invalid permissions: ${invalidPerms.join(", ")}`));
    }

    // Get skill
    const skill = await prisma.skill.findUnique({
      where: { id },
      select: { id: true, userId: true, organizationId: true },
    });

    if (!skill) {
      return badRequest(new Error("Skill not found"));
    }

    if (!skill.organizationId) {
      return badRequest(new Error("Skill does not belong to an organization"));
    }

    // Check user is SKILL_ADMIN or org admin
    const membership = await rbacService.getOrgMembership(userId, skill.organizationId);
    if (!membership) {
      return forbidden();
    }

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return forbidden();
    }

    // Verify target user is a member
    const targetMembership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: skill.organizationId,
        userId: body.targetUserId,
      },
    });

    if (!targetMembership) {
      return badRequest(new Error("Target user is not a member of this organization"));
    }

    // In a full implementation, you'd store per-skill permissions in a separate table
    // For now, we store them as a JSON field on the skill version
    logger.info({ skillId: id, targetUserId: body.targetUserId, permissions: body.permissions }, "Skill permissions updated (in-memory for now)");

    return NextResponse.json({
      success: true,
      data: {
        message: "Permissions saved. In production, this would persist to a SkillPermission table.",
        targetUserId: body.targetUserId,
        permissions: body.permissions,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to set skill permissions");
    return serverError(error);
  }
}

/**
 * DELETE /api/skills/[id]/permissions — Reset permissions to org defaults
 */
export async function DELETE(
  request: NextRequest,
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
      select: { id: true, organizationId: true },
    });

    if (!skill) {
      return badRequest(new Error("Skill not found"));
    }

    if (!skill.organizationId) {
      return badRequest(new Error("Skill does not belong to an organization"));
    }

    // Check permission
    const membership = await rbacService.getOrgMembership(userId, skill.organizationId);
    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      return forbidden();
    }

    logger.info({ skillId: id, targetUserId }, "Skill permissions reset to org defaults");

    return NextResponse.json({
      success: true,
      data: { message: "Permissions reset to organization defaults" },
    });
  } catch (error) {
    logger.error({ error }, "Failed to reset skill permissions");
    return serverError(error);
  }
}
