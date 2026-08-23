import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest } from "@/lib/api/handlers";

/**
 * POST /api/mcp/arcade
 * Returns the MCP endpoint URL + auth headers needed to connect
 * Agent Studio to an Arcade integration.
 *
 * Body:
 *   - integration: string  — Arcade integration slug (e.g. "gmail", "github", "slack")
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const apiKey = process.env.ARCADE_API_KEY;
  if (!apiKey) {
    return badRequest(new Error("ARCADE_API_KEY not configured. Add it to your .env file."));
  }

  let body: { integration?: string } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest(new Error("Request body must include 'integration' field"));
  }

  if (!body.integration) {
    return badRequest(new Error("Missing 'integration' field in request body"));
  }

  try {
    // Arcade MCP servers follow the pattern: https://mcp.arcade.dev/{integration}
    // Auth is via Bearer token
    const mcpUrl = `https://mcp.arcade.dev/${body.integration}`;
    const mcpHeaders = {
      Authorization: `Bearer ${apiKey}`,
    };

    // Verify the endpoint is reachable
    const testRes = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        ...mcpHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "agent-studio", version: "1.0.0" } }, id: 1 }),
      signal: AbortSignal.timeout(10000),
    });

    // Even if initialize fails, we still return the endpoint — the user can connect
    // and Agent Studio will handle the connection error gracefully
    return NextResponse.json({
      success: true,
      data: {
        mcpUrl,
        mcpHeaders,
        integration: body.integration,
        verified: testRes.ok,
      },
    });
  } catch {
    // Return the endpoint anyway — let Agent Studio handle connection
    return NextResponse.json({
      success: true,
      data: {
        mcpUrl: `https://mcp.arcade.dev/${body.integration}`,
        mcpHeaders: {
          Authorization: `Bearer ${apiKey}`,
        },
        integration: body.integration,
        verified: false,
      },
    });
  }
}

/**
 * GET /api/mcp/arcade
 * Lists available Arcade integrations.
 */
export async function GET() {
  const apiKey = process.env.ARCADE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: true, data: [], message: "ARCADE_API_KEY not configured" });
  }

  // Arcade's known integrations with their MCP server endpoints
  const integrations = [
    { slug: "gmail", name: "Gmail", toolsCount: 45, category: "COMMUNICATION", description: "Send, read, search, and manage Gmail emails" },
    { slug: "slack", name: "Slack", toolsCount: 52, category: "COMMUNICATION", description: "Send messages, list channels, manage threads" },
    { slug: "github", name: "GitHub", toolsCount: 87, category: "DEVELOPER TOOLS", description: "Create issues, PRs, manage repos, search code" },
    { slug: "google-sheets", name: "Google Sheets", toolsCount: 34, category: "PRODUCTIVITY", description: "Read, write, format spreadsheets" },
    { slug: "google-docs", name: "Google Docs", toolsCount: 28, category: "PRODUCTIVITY", description: "Create, edit documents" },
    { slug: "google-drive", name: "Google Drive", toolsCount: 31, category: "FILE SYSTEMS", description: "Upload, download, search files" },
    { slug: "notion", name: "Notion", toolsCount: 38, category: "PRODUCTIVITY", description: "Create pages, query databases" },
    { slug: "jira", name: "Jira", toolsCount: 42, category: "PRODUCTIVITY", description: "Create, transition issues" },
    { slug: "confluence", name: "Confluence", toolsCount: 24, category: "PRODUCTIVITY", description: "Read, create pages" },
    { slug: "linear", name: "Linear", toolsCount: 36, category: "PRODUCTIVITY", description: "Create issues, manage projects" },
    { slug: "hubspot", name: "HubSpot", toolsCount: 48, category: "CUSTOMER DATA", description: "Manage contacts, deals, pipelines" },
    { slug: "stripe", name: "Stripe", toolsCount: 44, category: "FINANCE & FINTECH", description: "Process payments, manage subscriptions" },
    { slug: "salesforce", name: "Salesforce", toolsCount: 56, category: "CUSTOMER DATA", description: "Query records, create leads" },
    { slug: "asana", name: "Asana", toolsCount: 30, category: "PRODUCTIVITY", description: "Create tasks, manage projects" },
    { slug: "dropbox", name: "Dropbox", toolsCount: 22, category: "FILE SYSTEMS", description: "Upload, download, share files" },
    { slug: "reddit", name: "Reddit", toolsCount: 18, category: "SOCIAL MEDIA", description: "Search posts, read comments" },
    { slug: "youtube", name: "YouTube", toolsCount: 20, category: "MULTIMEDIA", description: "Search videos, get transcripts" },
    { slug: "x", name: "X (Twitter)", toolsCount: 26, category: "SOCIAL MEDIA", description: "Post tweets, search timelines" },
    { slug: "ms-teams", name: "Microsoft Teams", toolsCount: 32, category: "COMMUNICATION", description: "Send messages, manage meetings" },
    { slug: "google-slides", name: "Google Slides", toolsCount: 16, category: "PRODUCTIVITY", description: "Create, edit presentations" },
    { slug: "pagerduty", name: "PagerDuty", toolsCount: 18, category: "DEVOPS & CLOUD", description: "Create incidents, manage on-call" },
    { slug: "figma", name: "Figma", toolsCount: 14, category: "DESIGN", description: "Read designs, extract components" },
    { slug: "spotify", name: "Spotify", toolsCount: 22, category: "MULTIMEDIA", description: "Search tracks, manage playlists" },
    { slug: "zoom", name: "Zoom", toolsCount: 16, category: "COMMUNICATION", description: "Schedule meetings, list recordings" },
    { slug: "clickup", name: "ClickUp", toolsCount: 34, category: "PRODUCTIVITY", description: "Create tasks, manage spaces" },
    { slug: "linkedin", name: "LinkedIn", toolsCount: 14, category: "SOCIAL MEDIA", description: "Search profiles, post updates" },
    { slug: "attio", name: "Attio", toolsCount: 20, category: "CUSTOMER DATA", description: "Manage contacts, deals" },
    { slug: "twitch", name: "Twitch", toolsCount: 12, category: "MULTIMEDIA", description: "Search streams, read chats" },
  ];

  return NextResponse.json({
    success: true,
    data: integrations,
    total: integrations.length,
    message: "7,500+ tools across 81 MCP servers at arcade.dev",
  });
}
