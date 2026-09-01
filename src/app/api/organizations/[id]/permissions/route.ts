/**
 * Organization User Permissions API Route
 *
 * GET /api/organizations/[id]/permissions — Get effective permissions and role flags for current user in org
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { rbacService } = apiServices();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id: organizationId } = await params;
    const membership = await rbacService.getOrgMembership(userId, organizationId);
    if (!membership) return handleApiError(new Error("access denied"));

    const permissions = await rbacService.getUserOrgPermissions(userId, organizationId);

    return NextResponse.json({
      success: true,
      data: {
        role: membership.role,
        permissions,
        skillPermissions: membership.permissions,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
