/**
 * Organization Invitations Routes
 *
 * GET    /api/organizations/[id]/invitations — List pending invitations
 * DELETE /api/organizations/[id]/invitations — Cancel invitation
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { organizationService } = apiServices();

/**
 * GET /api/organizations/[id]/invitations — List pending invitations
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const invitations = await organizationService.listInvitations(userId, id);
    return NextResponse.json({ success: true, data: invitations });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/organizations/[id]/invitations — Cancel invitation
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
    const invitationId = url.searchParams.get("invitationId");

    if (!invitationId) {
      return badRequest(new Error("invitationId query parameter is required"));
    }

    await organizationService.cancelInvitation(userId, id, invitationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
