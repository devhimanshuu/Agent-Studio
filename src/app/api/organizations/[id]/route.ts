/**
 * Organization by ID API Routes
 *
 * GET    /api/organizations/[id]      - Get organization details
 * PUT    /api/organizations/[id]      - Update organization
 * DELETE /api/organizations/[id]      - Delete organization
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { organizationService } = apiServices();

/**
 * GET /api/organizations/[id] — Get organization details
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const organization = await organizationService.getById(userId, id);

    if (!organization) {
      return handleApiError(new Error("Organization not found"));
    }

    return NextResponse.json({ success: true, data: organization });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/organizations/[id] — Update organization
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();

    const organization = await organizationService.update(userId, id, {
      name: body.name,
      billingEmail: body.billingEmail,
      settings: body.settings,
    });

    return NextResponse.json({ success: true, data: organization });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/organizations/[id] — Delete organization
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    await organizationService.delete(userId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
