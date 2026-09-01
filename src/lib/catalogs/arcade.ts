/**
 * Arcade integrations catalog — known integrations list.
 */

import { logger } from "@/lib/logger";

const ARCADE_CACHE_TTL = 3600_000;

interface ArcadeCacheEntry {
  integrations: ArcadeIntegration[];
  totalCount: number;
  fetchedAt: number;
}

let arcadeCache: ArcadeCacheEntry | null = null;

export interface ArcadeIntegration {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  authType: string;
  toolsCount: number;
  mcpEndpoint: string;
}

/**
 * Fetch Arcade integrations (static known list since Arcade has no public catalog API).
 */
export async function fetchArcadeIntegrations(): Promise<ArcadeIntegration[]> {
  if (arcadeCache && Date.now() - arcadeCache.fetchedAt < ARCADE_CACHE_TTL) {
    return arcadeCache.integrations;
  }

  const knownIntegrations: ArcadeIntegration[] = [
    { id: "arcade-gmail", name: "Gmail", description: "Send, read, search, and manage Gmail emails with OAuth-backed authorization.", category: "COMMUNICATION", logo: "https://www.arcade.dev/integrations/gmail.svg", authType: "OAUTH2", toolsCount: 45, mcpEndpoint: "https://mcp.arcade.dev/gmail" },
    { id: "arcade-slack", name: "Slack", description: "Send messages, list channels, manage threads, and search conversations in Slack workspaces.", category: "COMMUNICATION", logo: "https://www.arcade.dev/integrations/slack.svg", authType: "OAUTH2", toolsCount: 52, mcpEndpoint: "https://mcp.arcade.dev/slack" },
    { id: "arcade-github", name: "GitHub", description: "Create issues, pull requests, manage repos, search code, and review PRs on GitHub.", category: "DEVELOPER TOOLS", logo: "https://www.arcade.dev/integrations/github.svg", authType: "OAUTH2", toolsCount: 87, mcpEndpoint: "https://mcp.arcade.dev/github" },
    { id: "arcade-google-sheets", name: "Google Sheets", description: "Read, write, format, and analyze data in Google Sheets spreadsheets.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/google-sheets.svg", authType: "OAUTH2", toolsCount: 34, mcpEndpoint: "https://mcp.arcade.dev/google-sheets" },
    { id: "arcade-google-docs", name: "Google Docs", description: "Create, edit, and format Google Docs documents programmatically.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/google-docs.svg", authType: "OAUTH2", toolsCount: 28, mcpEndpoint: "https://mcp.arcade.dev/google-docs" },
    { id: "arcade-google-drive", name: "Google Drive", description: "Upload, download, search, and organize files in Google Drive.", category: "FILE SYSTEMS", logo: "https://www.arcade.dev/integrations/google-drive.svg", authType: "OAUTH2", toolsCount: 31, mcpEndpoint: "https://mcp.arcade.dev/google-drive" },
    { id: "arcade-notion", name: "Notion", description: "Create pages, query databases, update content, and manage workspaces in Notion.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/notion.svg", authType: "OAUTH2", toolsCount: 38, mcpEndpoint: "https://mcp.arcade.dev/notion" },
    { id: "arcade-jira", name: "Jira", description: "Create, transition, assign, and search Jira issues across projects and boards.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/jira.svg", authType: "OAUTH2", toolsCount: 42, mcpEndpoint: "https://mcp.arcade.dev/jira" },
    { id: "arcade-confluence", name: "Confluence", description: "Read, create, and edit Confluence pages and spaces.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/confluence.svg", authType: "OAUTH2", toolsCount: 24, mcpEndpoint: "https://mcp.arcade.dev/confluence" },
    { id: "arcade-linear", name: "Linear", description: "Create issues, manage projects, and track progress in Linear.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/linear.svg", authType: "OAUTH2", toolsCount: 36, mcpEndpoint: "https://mcp.arcade.dev/linear" },
    { id: "arcade-hubspot", name: "HubSpot", description: "Manage contacts, deals, companies, and pipelines in HubSpot CRM.", category: "CUSTOMER DATA", logo: "https://www.arcade.dev/integrations/hubspot.svg", authType: "OAUTH2", toolsCount: 48, mcpEndpoint: "https://mcp.arcade.dev/hubspot" },
    { id: "arcade-stripe", name: "Stripe", description: "Process payments, manage subscriptions, invoices, and customers via Stripe.", category: "FINANCE & FINTECH", logo: "https://www.arcade.dev/integrations/stripe.svg", authType: "API_KEY", toolsCount: 44, mcpEndpoint: "https://mcp.arcade.dev/stripe" },
    { id: "arcade-salesforce", name: "Salesforce", description: "Query records, create leads, manage opportunities in Salesforce CRM.", category: "CUSTOMER DATA", logo: "https://www.arcade.dev/integrations/salesforce.svg", authType: "OAUTH2", toolsCount: 56, mcpEndpoint: "https://mcp.arcade.dev/salesforce" },
    { id: "arcade-asana", name: "Asana", description: "Create tasks, manage projects, and track milestones in Asana.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/asana.svg", authType: "OAUTH2", toolsCount: 30, mcpEndpoint: "https://mcp.arcade.dev/asana" },
    { id: "arcade-dropbox", name: "Dropbox", description: "Upload, download, share, and manage files in Dropbox.", category: "FILE SYSTEMS", logo: "https://www.arcade.dev/integrations/dropbox.svg", authType: "OAUTH2", toolsCount: 22, mcpEndpoint: "https://mcp.arcade.dev/dropbox" },
    { id: "arcade-reddit", name: "Reddit", description: "Search posts, read comments, and manage subreddits on Reddit.", category: "SOCIAL MEDIA", logo: "https://www.arcade.dev/integrations/reddit.svg", authType: "OAUTH2", toolsCount: 18, mcpEndpoint: "https://mcp.arcade.dev/reddit" },
    { id: "arcade-youtube", name: "YouTube", description: "Search videos, read comments, manage playlists, and get transcripts from YouTube.", category: "MULTIMEDIA", logo: "https://www.arcade.dev/integrations/youtube.svg", authType: "OAUTH2", toolsCount: 20, mcpEndpoint: "https://mcp.arcade.dev/youtube" },
    { id: "arcade-x", name: "X (Twitter)", description: "Post tweets, search timelines, manage followers, and read DMs on X.", category: "SOCIAL MEDIA", logo: "https://www.arcade.dev/integrations/x.svg", authType: "OAUTH2", toolsCount: 26, mcpEndpoint: "https://mcp.arcade.dev/x" },
    { id: "arcade-ms-teams", name: "Microsoft Teams", description: "Send messages, list channels, manage meetings, and search in Microsoft Teams.", category: "COMMUNICATION", logo: "https://www.arcade.dev/integrations/ms-teams.svg", authType: "OAUTH2", toolsCount: 32, mcpEndpoint: "https://mcp.arcade.dev/ms-teams" },
    { id: "arcade-google-slides", name: "Google Slides", description: "Create, edit, and format Google Slides presentations.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/google-slides.svg", authType: "OAUTH2", toolsCount: 16, mcpEndpoint: "https://mcp.arcade.dev/google-slides" },
    { id: "arcade-pagerduty", name: "PagerDuty", description: "Create incidents, manage on-call schedules, and resolve alerts in PagerDuty.", category: "DEVOPS & CLOUD", logo: "https://www.arcade.dev/integrations/pagerduty.svg", authType: "OAUTH2", toolsCount: 18, mcpEndpoint: "https://mcp.arcade.dev/pagerduty" },
    { id: "arcade-figma", name: "Figma", description: "Read designs, extract components, and export assets from Figma files.", category: "DESIGN", logo: "https://www.arcade.dev/integrations/figma.svg", authType: "OAUTH2", toolsCount: 14, mcpEndpoint: "https://mcp.arcade.dev/figma" },
    { id: "arcade-spotify", name: "Spotify", description: "Search tracks, manage playlists, control playback, and get recommendations on Spotify.", category: "MULTIMEDIA", logo: "https://www.arcade.dev/integrations/spotify.svg", authType: "OAUTH2", toolsCount: 22, mcpEndpoint: "https://mcp.arcade.dev/spotify" },
    { id: "arcade-zoom", name: "Zoom", description: "Schedule meetings, list recordings, and manage participants on Zoom.", category: "COMMUNICATION", logo: "https://www.arcade.dev/integrations/zoom.svg", authType: "OAUTH2", toolsCount: 16, mcpEndpoint: "https://mcp.arcade.dev/zoom" },
    { id: "arcade-twitch", name: "Twitch", description: "Search streams, read chats, and manage channels on Twitch.", category: "MULTIMEDIA", logo: "https://www.arcade.dev/integrations/twitch.svg", authType: "OAUTH2", toolsCount: 12, mcpEndpoint: "https://mcp.arcade.dev/twitch" },
    { id: "arcade-clickup", name: "ClickUp", description: "Create tasks, manage spaces, and track time in ClickUp.", category: "PRODUCTIVITY", logo: "https://www.arcade.dev/integrations/clickup.svg", authType: "OAUTH2", toolsCount: 34, mcpEndpoint: "https://mcp.arcade.dev/clickup" },
    { id: "arcade-linkedin", name: "LinkedIn", description: "Search profiles, post updates, and manage connections on LinkedIn.", category: "SOCIAL MEDIA", logo: "https://www.arcade.dev/integrations/linkedin.svg", authType: "OAUTH2", toolsCount: 14, mcpEndpoint: "https://mcp.arcade.dev/linkedin" },
    { id: "arcade-attio", name: "Attio", description: "Manage contacts, deals, and workspace data in Attio CRM.", category: "CUSTOMER DATA", logo: "https://www.arcade.dev/integrations/attio.svg", authType: "OAUTH2", toolsCount: 20, mcpEndpoint: "https://mcp.arcade.dev/attio" },
  ];

  arcadeCache = {
    integrations: knownIntegrations,
    totalCount: knownIntegrations.length,
    fetchedAt: Date.now(),
  };

  logger.info({ count: knownIntegrations.length }, "Arcade integrations loaded");
  return knownIntegrations;
}
