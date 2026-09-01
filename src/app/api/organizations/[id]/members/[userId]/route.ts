/**
 * Individual Member API Routes
 *
 * PUT    /api/organizations/[id]/members/[userId]    - Update member role
 * DELETE /api/organizations/[id]/members/[userId]    - Remove member
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { organizationService } = apiServices();

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
    return handleApiError(error);
  }
}

/**
 * DELETE /api/organizations/[id]/members/[userId] — Remove member
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { userId: currentUserId } = await auth();
  if (!currentUserId) return unauthorized();

  try {
    const { id, userId: targetUserId } = await params;
    await organizationService.removeMember(currentUserId, id, targetUserId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
