import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { VaultService } from "@/services/VaultService";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const vaultService = new VaultService();

/**
 * GET /api/vault/[id]/reveal — Get the raw (decrypted) value of a vault entry.
 * Used by the UI for clipboard copy and by the execution engine for secret injection.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Get the entry to find its key
    const entry = await vaultService.getById(userId, id);
    if (!entry) {
      return NextResponse.json({ error: "Vault entry not found" }, { status: 404 });
    }

    // Get the raw value using the key
    const rawValue = await vaultService.getRawValue(userId, entry.key);
    if (rawValue === null) {
      return NextResponse.json({ error: "Failed to decrypt value" }, { status: 500 });
    }

    return NextResponse.json({ success: true, rawValue });
  } catch (error) {
    logger.error({ error }, "Failed to reveal vault entry");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
