/**
 * Custom Role Assignment API Routes
 *
 * PUT    /api/organizations/[id]/members/[userId]/role  - Assign custom role
 * DELETE /api/organizations/[id]/members/[userId]/role  - Remove custom role
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CustomRoleService } from "@/services/CustomRoleService";
import { unauthorized, forbidden, badRequest, serverError } from "@/lib/api/handlers";
import { ForbiddenError } from "@/services/RBACService";
import { logger } from "@/lib/logger";

const customRoleService = new CustomRoleService();

/**
 * PUT /api/organizations/[id]/members/[userId]/role — Assign custom role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { userId: currentUserId } = await auth();
  if (!currentUserId) return unauthorized();

  try {
    const { id: organizationId, userId: targetUserId } = await params;
    const body = await request.json();

    if (!body.roleId) {
      return badRequest(new Error("roleId is required"));
    }

    await customRoleService.assignToMember(
      currentUserId,
      organizationId,
      targetUserId,
      body.roleId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof ForbiddenError) {
      return forbidden();
    }
    if (error instanceof Error) {
      return badRequest(error);
    }
    logger.error({ error }, "Failed to assign custom role");
    return serverError(error);
  }
}

/**
 * DELETE /api/organizations/[id]/members/[userId]/role — Remove custom role
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { userId: currentUserId } = await auth();
  if (!currentUserId) return unauthorized();

  try {
    const { id: organizationId, userId: targetUserId } = await params;
    await customRoleService.removeFromMember(
      currentUserId,
      organizationId,
      targetUserId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return forbidden();
    }
    if (error instanceof Error) {
      return badRequest(error);
    }
    logger.error({ error }, "Failed to remove custom role");
    return serverError(error);
  }
}
