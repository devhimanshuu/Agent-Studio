import { McpPreset } from "@/types/mcp";

/**
 * 1-Click Ecosystem Presets for the MCP Server Hub. Each preset creates a
 * server row (DISCONNECTED by default); the user supplies auth tokens /
 * connection details at connect time.
 */
export const MCP_PRESETS: McpPreset[] = [
  {
    id: "github",
    name: "GitHub MCP",
    transport: "SSE",
    endpointUrl: "https://api.githubcopilot.com/mcp/",
    headers: { Authorization: "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}" },
    description: "Repositories, issues, pull requests, code search, and release management via the GitHub MCP server.",
    requiresAuthToken: true,
  },
  {
    id: "postgres",
    name: "Postgres MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-postgres <DATABASE_URL>",
    description: "Query and mutate a PostgreSQL database through the reference Postgres MCP server.",
    requiresAuthToken: false,
  },
  {
    id: "sqlite",
    name: "SQLite MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-sqlite <PATH_TO_DB_FILE>",
    description: "Local SQLite database access (schema introspection, queries, writes) via the reference SQLite server.",
    requiresAuthToken: false,
  },
  {
    id: "webfetch",
    name: "Web Fetch MCP",
    transport: "SSE",
    endpointUrl: "https://mcp.kagi.com/fetch",
    description: "Fetch and summarize web pages with clean article extraction (Kagi).",
    requiresAuthToken: false,
  },
  {
    id: "brave",
    name: "Brave Search MCP",
    transport: "SSE",
    endpointUrl: "https://api.search.brave.com/mcp/server",
    headers: { Authorization: "Bearer ${BRAVE_SEARCH_API_KEY}" },
    description: "Web, image, and news search backed by the Brave Search API.",
    requiresAuthToken: true,
  },
  {
    id: "filesystem",
    name: "Filesystem MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-filesystem <ALLOWED_DIRECTORY>",
    description: "Read/write access to local files, sandboxed to the allowed directory roots.",
    requiresAuthToken: false,
  },
  {
    id: "slack",
    name: "Slack MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-slack",
    description: "Dispatch notifications, read channel threads, and search messages. Configure SLACK_BOT_TOKEN + SLACK_TEAM_ID in the server environment.",
    requiresAuthToken: false,
  },
  {
    id: "memory",
    name: "Memory MCP",
    transport: "STDIO",
    command: "npx -y @modelcontextprotocol/server-memory",
    description: "Persistent knowledge-graph memory across agent executions (entities, relations, observations).",
    requiresAuthToken: false,
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
