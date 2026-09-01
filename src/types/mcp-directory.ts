import { McpTransport } from "./mcp";

export type PublicMcpSource = "glama" | "mcp.so" | "curated" | "smithery" | "composio" | "arcade" | "mcpservers-org";

export type McpLanguage = "typescript" | "python" | "go" | "rust" | "csharp" | "java" | "cpp" | "ruby" | "unknown";

export type McpScope = "cloud" | "local" | "unknown";

export interface PublicMcpServer {
  id: string;
  source: PublicMcpSource;
  name: string;
  description: string;
  owner?: string;
  repoUrl?: string;
  stars?: number;
  tags?: string[];
  transport: McpTransport;
  command?: string;
  endpointUrl?: string;
  requiresAuthToken?: boolean;
  envVarsRequired?: string[];
  category?: string;
  isVerified?: boolean;
  language?: McpLanguage;
  license?: string;
  scope?: McpScope;
  qualityScore?: {
    license: "A" | "B" | "C" | "D";
    quality: "A" | "B" | "C" | "D";
    maintenance: "A" | "B" | "C" | "D";
  };
}

export interface McpDirectoryResponse {
  success: boolean;
  total: number;
  data: PublicMcpServer[];
  sources: {
    glamaCount: number;
    mcpSoCount: number;
    smitheryCount?: number;
    composioCount?: number;
    arcadeCount?: number;
    mcpserversOrgCount?: number;
  };
}

export interface GitHubReleaseInfo {
  version: string;
  name: string;
  publishedAt: string;
  body?: string;
  url: string;
}

export interface GitHubRepoInfo {
  release: GitHubReleaseInfo | null;
  readme: string | null;
}

export interface ServerHealthPing {
  status: "healthy" | "degraded" | "unreachable";
  statusCode: number;
  latencyMs: number;
  endpointUrl: string;
  error?: string;
}
