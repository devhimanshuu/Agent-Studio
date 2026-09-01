/**
 * Organization API Keys Routes
 *
 * GET  /api/organizations/[id]/api-keys      - List API keys
 * POST /api/organizations/[id]/api-keys      - Create API key
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { apiKeyService } = apiServices();

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
    return handleApiError(error);
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
    return handleApiError(error);
  }
}
