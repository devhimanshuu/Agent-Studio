/**
 * API Key by ID Routes
 *
 * DELETE /api/organizations/[id]/api-keys/[keyId] — Delete API key
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ApiKeyService } from "@/services/ApiKeyService";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api/handlers";
import { ForbiddenError } from "@/services/RBACService";
import { logger } from "@/lib/logger";

const apiKeyService = new ApiKeyService();

/**
 * DELETE /api/organizations/[id]/api-keys/[keyId] — Delete API key
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id, keyId } = await params;
    await apiKeyService.delete(userId, id, keyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ForbiddenError) return forbidden();
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound(error.message);
    }
    logger.error({ error }, "Failed to delete API key");
    return serverError(error);
  }
}
