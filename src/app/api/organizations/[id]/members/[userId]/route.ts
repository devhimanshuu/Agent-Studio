/**
 * Individual Member API Routes
 *
 * PUT    /api/organizations/[id]/members/[userId]    - Update member role
 * DELETE /api/organizations/[id]/members/[userId]    - Remove member
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { OrganizationService } from "@/services/OrganizationService";
import { unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/api/handlers";
import { ForbiddenError } from "@/services/RBACService";
import { logger } from "@/lib/logger";

const organizationService = new OrganizationService();

/**
 * PUT /api/organizations/[id]/members/[userId] — Update member role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { userId: currentUserId } = await auth();
  if (!currentUserId) return unauthorized();

  try {
    const { id, userId: targetUserId } = await params;
    const body = await request.json();

    if (!body.role) {
      return badRequest(new Error("Role is required"));
    }

    // Validate role
    const validRoles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
    if (!validRoles.includes(body.role)) {
      return badRequest(new Error(`Role must be one of: ${validRoles.join(", ")}`));
    }

    const member = await organizationService.updateMemberRole(
      currentUserId,
      id,
      targetUserId,
      body.role
    );

    return NextResponse.json({ success: true, data: member });
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
    logger.error({ error }, "Failed to update member role");
    return serverError(error);
  }
}

/**
 * DELETE /api/organizations/[id]/members/[userId] — Remove member
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { userId: currentUserId } = await auth();
  if (!currentUserId) return unauthorized();

  try {
    const { id, userId: targetUserId } = await params;
    await organizationService.removeMember(currentUserId, id, targetUserId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return forbidden();
    }
    if (error instanceof Error) {
      return badRequest(error);
    }
    logger.error({ error }, "Failed to remove member");
    return serverError(error);
  }
}
