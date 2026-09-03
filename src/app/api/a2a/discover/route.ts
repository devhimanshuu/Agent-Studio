import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { a2aClientService } from "@/services/A2AClientService";
import { fetchA2ARegistry } from "@/modules/a2a/registry";
import { rateLimit } from "@/lib/api/rateLimit";
import { env } from "@/lib/config/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/a2a/discover
 *
 * With no `url` query param: pulls the directory of agents. Tries the
 * upstream registry configured via `A2A_REGISTRY_URL` and falls back to the
 * static presets when nothing is reachable.
 *
 * With a `url` query param: performs a single-agent discovery and returns
 * the fetched manifest. Rate-limited and Clerk-auth gated.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    const { manifests, source } = await fetchA2ARegistry({
      registryUrl: env.A2A_REGISTRY_URL,
      authToken: env.A2A_REGISTRY_TOKEN,
    });
    return NextResponse.json({ presets: manifests, source });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required for remote discovery", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const limited = rateLimit(`a2a:discover:${userId}`);
  if (limited) {
    return limited;
  }

  try {
    const manifest = await a2aClientService.discover(targetUrl);
    return NextResponse.json({ success: true, manifest });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to discover A2A agent",
      },
      { status: 400 },
    );
  }
}