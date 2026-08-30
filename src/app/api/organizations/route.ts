/**
 * Organization API Routes
 *
 * GET  /api/organizations      - List user's organizations
 * POST /api/organizations      - Create new organization
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { OrganizationService } from "@/services/OrganizationService";
import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";
import { logger } from "@/lib/logger";

const organizationService = new OrganizationService();

/**
 * GET /api/organizations — List user's organizations
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const organizations = await organizationService.listUserOrganizations(userId);
    return NextResponse.json({ success: true, data: organizations });
  } catch (error) {
    logger.error({ error }, "Failed to list organizations");
    return serverError(error);
  }
}

/**
 * POST /api/organizations — Create new organization
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();

    if (!body.name) {
      return badRequest(new Error("Organization name is required"));
    }

    // Validate name length
    if (body.name.length < 2 || body.name.length > 100) {
      return badRequest(new Error("Organization name must be 2-100 characters"));
    }

    // Validate slug format if provided
    if (body.slug && !/^[a-z0-9-]+$/.test(body.slug)) {
      return badRequest(new Error("Slug must contain only lowercase letters, numbers, and hyphens"));
    }

    const organization = await organizationService.create(userId, {
      name: body.name,
      slug: body.slug,
      plan: body.plan,
      billingEmail: body.billingEmail,
    });

    return NextResponse.json({ success: true, data: organization }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof Error && error.message.includes("already exists")) {
      return badRequest(error);
    }
    logger.error({ error }, "Failed to create organization");
    return serverError(error);
  }
}
