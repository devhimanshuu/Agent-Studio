import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

export const dynamic = "force-dynamic";

const { vaultService } = apiServices();

/**
 * GET /api/vault/[id]/reveal — Get the raw (decrypted) value of a vault entry.
 * Used by the UI for clipboard copy and by the execution engine for secret injection.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;

    // Get the entry to find its key
    const entry = await vaultService.getById(userId, id);
    if (!entry) {
      return handleApiError(new Error("Vault entry not found"));
    }

    // Get the raw value using the key
    const rawValue = await vaultService.getRawValue(userId, entry.key);
    if (rawValue === null) {
      return handleApiError(new Error("Failed to decrypt value"));
    }

    return NextResponse.json({ success: true, rawValue });
  } catch (error) {
    return handleApiError(error);
  }
}
