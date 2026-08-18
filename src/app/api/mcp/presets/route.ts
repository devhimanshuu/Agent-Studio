import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { MCP_PRESETS } from "@/modules/mcp/presets";
import { unauthorized } from "@/lib/api/handlers";

/**
 * 1-Click ecosystem presets — served from the same module that powers the
 * connect modal, so the hub always shows the canonical catalog.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();
  return NextResponse.json({ success: true, data: MCP_PRESETS });
}
