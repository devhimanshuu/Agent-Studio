/**
 * Organization API Keys Routes
 *
 * GET  /api/organizations/[id]/api-keys      - List API keys
 * POST /api/organizations/[id]/api-keys      - Create API key
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ApiKeyService } from "@/services/ApiKeyService";
import { unauthorized, forbidden, badRequest, serverError } from "@/lib/api/handlers";
import { ForbiddenError } from "@/services/RBACService";
import { logger } from "@/lib/logger";

const apiKeyService = new ApiKeyService();

/**
 * GET /api/organizations/[id]/api-keys — List organization API keys
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const keys = await apiKeyService.list(userId, id);
    return NextResponse.json({ success: true, data: keys });
  } catch (error) {
    if (error instanceof ForbiddenError) return forbidden();
    logger.error({ error }, "Failed to list API keys");
    return serverError(error);
  }
}

/**
 * POST /api/organizations/[id]/api-keys — Create API key
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

    if (!body.name) {
      return badRequest(new Error("API key name is required"));
    }

    if (body.name.length < 2 || body.name.length > 100) {
      return badRequest(new Error("API key name must be 2-100 characters"));
    }

    // Validate scopes if provided
    if (body.scopes && !Array.isArray(body.scopes)) {
      return badRequest(new Error("Scopes must be an array"));
    }

    // Validate expiration if provided
    if (body.expiresAt) {
      const expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        return badRequest(new Error("Expiration date must be in the future"));
      }
    }

    const key = await apiKeyService.create(userId, id, {
      name: body.name,
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });

    return NextResponse.json({ success: true, data: key }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof ForbiddenError) return forbidden();
    if (error instanceof Error) return badRequest(error);
    logger.error({ error }, "Failed to create API key");
    return serverError(error);
  }
}
