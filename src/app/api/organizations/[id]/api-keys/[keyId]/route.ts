/**
 * API Key by ID Routes
 *
 * DELETE /api/organizations/[id]/api-keys/[keyId] — Delete API key
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { apiKeyService } = apiServices();

/**
 * DELETE /api/organizations/[id]/api-keys/[keyId] — Delete API key
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id, keyId } = await params;
    await apiKeyService.delete(userId, id, keyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
