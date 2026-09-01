/**
 * Organization Members API Routes
 *
 * GET  /api/organizations/[id]/members      - List members
 * POST /api/organizations/[id]/members      - Invite member
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { organizationService } = apiServices();

/**
 * GET /api/organizations/[id]/members — List organization members
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const members = await organizationService.listMembers(userId, id);
    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/organizations/[id]/members — Invite member to organization
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

    if (!body.email) {
      return badRequest(new Error("Email is required"));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return badRequest(new Error("Invalid email format"));
    }

    // Validate role if provided
    const validRoles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
    if (body.role && !validRoles.includes(body.role)) {
      return badRequest(new Error(`Role must be one of: ${validRoles.join(", ")}`));
    }

    const invitation = await organizationService.inviteMember(userId, id, {
      email: body.email,
      role: body.role,
    });

    return NextResponse.json({ success: true, data: invitation }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
