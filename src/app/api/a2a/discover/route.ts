import { NextResponse } from "next/server";
import { a2aClientService } from "@/services/A2AClientService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    // Return all curated presets
    return NextResponse.json({
      presets: a2aClientService.listPresets(),
    });
  }

  try {
    const manifest = await a2aClientService.discover(targetUrl);
    return NextResponse.json({
      success: true,
      manifest,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to discover A2A agent",
      },
      { status: 400 }
    );
  }
}
