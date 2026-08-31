/**
 * Invitation Acceptance API Route
 *
 * POST /api/invitations/[token]/accept — Accept organization invitation
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { OrganizationService } from "@/services/OrganizationService";
import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";
import { logger } from "@/lib/logger";

const organizationService = new OrganizationService();

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
    if (error instanceof Error) {
      // Specific error messages for different failure cases
      if (error.message.includes("Invalid")) {
        return badRequest(error);
      }
      if (error.message.includes("expired")) {
        return badRequest(error);
      }
      if (error.message.includes("already")) {
        return badRequest(error);
      }
      if (error.message.includes("does not match")) {
        return badRequest(error);
      }
    }
    logger.error({ error }, "Failed to accept invitation");
    return serverError(error);
  }
}
