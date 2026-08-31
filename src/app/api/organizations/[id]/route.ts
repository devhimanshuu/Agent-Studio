/**
 * Organization by ID API Routes
 *
 * GET    /api/organizations/[id]      - Get organization details
 * PUT    /api/organizations/[id]      - Update organization
 * DELETE /api/organizations/[id]      - Delete organization
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { OrganizationService } from "@/services/OrganizationService";
import { unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/api/handlers";
import { ForbiddenError } from "@/services/RBACService";
import { logger } from "@/lib/logger";

const organizationService = new OrganizationService();

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
      return notFound("Organization not found");
    }

    return NextResponse.json({ success: true, data: organization });
  } catch (error) {
    logger.error({ error }, "Failed to get organization");
    return serverError(error);
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
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof ForbiddenError) {
      return forbidden();
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound(error.message);
    }
    logger.error({ error }, "Failed to update organization");
    return serverError(error);
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
    if (error instanceof ForbiddenError) {
      return forbidden();
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound(error.message);
    }
    logger.error({ error }, "Failed to delete organization");
    return serverError(error);
  }
}
