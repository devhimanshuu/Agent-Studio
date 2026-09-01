/**
 * Invitation Acceptance API Route
 *
 * POST /api/invitations/[token]/accept — Accept organization invitation
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { organizationService } = apiServices();

/**
 * POST /api/invitations/[token]/accept — Accept invitation
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { token } = await params;

    if (!token) {
      return badRequest(new Error("Invitation token is required"));
    }

    const membership = await organizationService.acceptInvitation(userId, token);

    return NextResponse.json({ success: true, data: membership });
  } catch (error) {
    return handleApiError(error);
  }
}
