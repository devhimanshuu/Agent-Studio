import { McpPreset } from "@/types/mcp";

/**
 * 1-Click Ecosystem Presets for the MCP Server Hub. Each preset creates a
 * server row (DISCONNECTED by default); the user supplies auth tokens /
 * connection details at connect time.
 */
export const MCP_PRESETS: McpPreset[] = [
  // Development & Code
  {
    id: "github",
    name: "GitHub MCP",
    transport: "SSE",
    endpointUrl: "https://api.githubcopilot.com/mcp/",
    headers: { Authorization: "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}" },
    description: "Repositories, issues, pull requests, code search, and release management via the GitHub MCP server.",
    requiresAuthToken: true,
    category: "DEVELOPMENT",
  },
  {
    id: "git",
    name: "Git Repository MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-git <PATH_TO_GIT_REPO>",
    description: "Inspect local Git repositories: read commits, commit logs, diffs, branches, and staged changes.",
    requiresAuthToken: false,
    category: "DEVELOPMENT",
  },

  // Databases & Memory
  {
    id: "postgres",
    name: "Postgres MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-postgres <DATABASE_URL>",
    description: "Query and mutate a PostgreSQL database through the reference Postgres MCP server.",
    requiresAuthToken: false,
    category: "DATABASE",
  },
  {
    id: "sqlite",
    name: "SQLite MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-sqlite <PATH_TO_DB_FILE>",
    description: "Local SQLite database access (schema introspection, queries, writes) via the reference SQLite server.",
    requiresAuthToken: false,
    category: "DATABASE",
  },
  {
    id: "memory",
    name: "Memory MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-memory",
    description: "Persistent knowledge-graph memory across agent executions (entities, relations, observations).",
    requiresAuthToken: false,
    category: "DATABASE",
  },

  // Web, Search & Scraping
  {
    id: "webfetch",
    name: "Web Fetch MCP",
    transport: "SSE",
    endpointUrl: "https://mcp.kagi.com/fetch",
    description: "Fetch and summarize web pages with clean article extraction (Kagi).",
    requiresAuthToken: false,
    category: "WEB_SEARCH",
  },
  {
    id: "fetch",
    name: "Web Fetcher Reference MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-fetch",
    description: "Official MCP reference server for fetching web pages and extracting clean markdown for LLMs.",
    requiresAuthToken: false,
    category: "WEB_SEARCH",
  },
  {
    id: "brave",
    name: "Brave Search MCP",
    transport: "SSE",
    endpointUrl: "https://api.search.brave.com/mcp/server",
    headers: { Authorization: "Bearer ${BRAVE_SEARCH_API_KEY}" },
    description: "Web, image, and news search backed by the Brave Search API.",
    requiresAuthToken: true,
    category: "WEB_SEARCH",
  },

  // Browser Automation
  {
    id: "playwright",
    name: "Playwright Browser MCP",
    transport: "STDIO",
    command: "npx -y @playwright/mcp@latest",
    description: "End-to-end browser automation: take screenshots, navigate pages, click buttons, and scrape interactive single-page apps.",
    requiresAuthToken: false,
    category: "BROWSER",
  },
  {
    id: "puppeteer",
    name: "Puppeteer MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-puppeteer",
    description: "Headless Chrome automation for capturing screenshots, web pages, and PDF generation.",
    requiresAuthToken: false,
    category: "BROWSER",
  },

  // AI Reasoning & Test
  {
    id: "sequential-thinking",
    name: "Sequential Thinking MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-sequential-thinking",
    description: "Dynamic chain-of-thought problem solving with branching, hypothesis testing, and revision for complex multi-step tasks.",
    requiresAuthToken: false,
    category: "REASONING",
  },
  {
    id: "everything",
    name: "Everything Test MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-everything",
    description: "Comprehensive MCP reference testing server exposing all protocol primitives (tools, resources, prompts).",
    requiresAuthToken: false,
    category: "UTILITY",
  },

  // Productivity & Workspaces
  {
    id: "filesystem",
    name: "Filesystem MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-filesystem <ALLOWED_DIRECTORY>",
    description: "Read/write access to local files, sandboxed to the allowed directory roots.",
    requiresAuthToken: false,
    category: "PRODUCTIVITY",
  },
  {
    id: "slack",
    name: "Slack MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-slack",
    description: "Dispatch notifications, read channel threads, and search messages. Configure SLACK_BOT_TOKEN + SLACK_TEAM_ID in the server environment.",
    requiresAuthToken: false,
    category: "PRODUCTIVITY",
  },
  {
    id: "notion",
    name: "Notion MCP",
    transport: "STDIO",
    command: "npx -y @notionhq/notion-mcp-server",
    headers: { Authorization: "Bearer ${NOTION_API_KEY}" },
    description: "Read and write Notion databases, pages, and blocks to synchronize agent workflows with your team workspace.",
    requiresAuthToken: true,
    category: "PRODUCTIVITY",
  },
  {
    id: "linear",
    name: "Linear MCP",
    transport: "STDIO",
    command: "npx -y @linear/linear-mcp-server",
    headers: { Authorization: "Bearer ${LINEAR_API_KEY}" },
    description: "Create and update Linear issues, search projects, and query team backlogs.",
    requiresAuthToken: true,
    category: "PRODUCTIVITY",
  },

  // DevOps & Cloud
  {
    id: "docker",
    name: "Docker MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-docker",
    description: "Manage Docker containers, list images, inspect compose stacks, and stream container logs.",
    requiresAuthToken: false,
    category: "DEVOPS",
  },
  {
    id: "sentry",
    name: "Sentry MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-sentry",
    headers: { Authorization: "Bearer ${SENTRY_AUTH_TOKEN}" },
    description: "Query production errors, triage exceptions, and inspect stack traces directly from Sentry.",
    requiresAuthToken: true,
    category: "DEVOPS",
  },

  // Research & Media
  {
    id: "arxiv",
    name: "ArXiv Research MCP",
    transport: "STDIO",
    command: "npx -y arxiv-mcp-server",
    description: "Search, query, and download scientific and AI research papers from ArXiv.",
    requiresAuthToken: false,
    category: "RESEARCH",
  },
  {
    id: "youtube-transcript",
    name: "YouTube Transcript MCP",
    transport: "STDIO",
    command: "npx -y @kimtaeyoon83/mcp-server-youtube-transcript",
    description: "Extract clean, timestamped subtitles and transcripts from YouTube video URLs.",
    requiresAuthToken: false,
    category: "RESEARCH",
  },

  // Location & Utilities
  {
    id: "google-maps",
    name: "Google Maps MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-google-maps",
    headers: { "X-Goog-Api-Key": "${GOOGLE_MAPS_API_KEY}" },
    description: "Geocoding, route directions, places search, and distance matrix computations.",
    requiresAuthToken: true,
    category: "UTILITY",
  },
  {
    id: "time",
    name: "Time & Timezone MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-time",
    description: "Query local and UTC time, convert timestamps, and resolve global timezone offsets.",
    requiresAuthToken: false,
    category: "UTILITY",
  },
];

export function findMcpPreset(id: string): McpPreset | undefined {
  return MCP_PRESETS.find((preset) => preset.id === id);
}

/** Resolve `Bearer ${TOKEN_PLACEHOLDER}` style headers with the user-supplied token. */
export function resolvePresetHeaders(preset: McpPreset, authToken?: string): Record<string, string> | undefined {
  if (!preset.headers) return undefined;
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(preset.headers)) {
    const placeholder = value.match(/\$\{([^}]+)\}/);
    if (placeholder && authToken) {
      resolved[key] = value.replace(/\$\{[^}]+\}/, authToken);
    } else if (!placeholder) {
      resolved[key] = value;
    }
    // Placeholders without a token are intentionally dropped — never persist
    // a literal "${TOKEN}" that would leak as a fake header.
  }
  return Object.keys(resolved).length > 0 ? resolved : undefined;
}
