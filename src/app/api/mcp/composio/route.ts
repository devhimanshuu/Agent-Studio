import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest } from "@/lib/api/handlers";

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3.1";

/**
 * POST /api/mcp/composio
 * Creates a Composio session for the authenticated user and returns
 * the MCP endpoint URL + headers needed to connect Agent Studio to it.
 *
 * Body (optional):
 *   - toolkits?: string[]   — specific toolkit slugs (e.g. ["gmail", "github"])
 *   - tools?: Record<string, { enable: string[] }>  — specific tools per toolkit
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return badRequest(new Error("COMPOSIO_API_KEY not configured. Add it to your .env file."));
  }

  let body: { toolkits?: string[]; tools?: Record<string, { enable: string[] }> } = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — defaults to all toolkits
  }

  try {
    // Create a Composio session with MCP transport
    const sessionPayload: Record<string, unknown> = {
      user_id: userId,
      mcp: true,
    };

    if (body.toolkits && body.toolkits.length > 0) {
      sessionPayload.toolkits = body.toolkits;
    }

    if (body.tools) {
      sessionPayload.tools = body.tools;
    }

    const res = await fetch(`${COMPOSIO_BASE}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(sessionPayload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Composio] Session creation failed:", res.status, err);
      return badRequest(new Error(`Composio session failed: ${res.status} — ${err}`));
    }

    const session = await res.json();

    // Extract MCP endpoint from the session
    const mcpUrl = session.mcp?.url;
    const mcpHeaders = session.mcp?.headers;

    if (!mcpUrl) {
      return badRequest(new Error("Composio session created but no MCP URL returned. Session may need toolkits configured."));
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.session_id,
        mcpUrl,
        mcpHeaders: mcpHeaders || {},
        toolkits: body.toolkits || "all",
      },
    });
  } catch (error) {
    console.error("[Composio] Error:", error);
    return badRequest(error instanceof Error ? error : new Error("Failed to create Composio session"));
  }
}

/**
 * GET /api/mcp/composio
 * Lists available Composio toolkits (for the directory browser to show).
 */
export async function GET() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: true, data: [], message: "COMPOSIO_API_KEY not configured" });
  }

  try {
    const res = await fetch(`${COMPOSIO_BASE}/toolkits?limit=200`, {
      headers: { "x-api-key": apiKey },
    });

    if (!res.ok) {
      return NextResponse.json({ success: true, data: [] });
    }

    const json = await res.json();
    const toolkits = (json.items || []).map((tk: Record<string, unknown>) => ({
      slug: tk.slug,
      name: tk.name,
      toolsCount: (tk.meta as Record<string, unknown>)?.tools_count || 0,
      description: (tk.meta as Record<string, unknown>)?.description || "",
      categories: (((tk.meta as Record<string, unknown>)?.categories || []) as Record<string, unknown>[]).map((c: Record<string, unknown>) => c.name),
      noAuth: tk.no_auth || false,
      managedAuth: ((tk.composio_managed_auth_schemes || []) as unknown[]).length > 0,
    }));

    return NextResponse.json({
      success: true,
      data: toolkits,
      total: toolkits.length,
    });
  } catch (_error) {
    return NextResponse.json({ success: true, data: [] });
  }
}
