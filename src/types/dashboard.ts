import { ExecutionDTO } from "./execution";
import { ApprovalRequestDTO } from "./approval";

export type TimeRangeFilter = "24h" | "7d" | "30d" | "all";

export interface SystemHealthDTO {
  mcpServersTotal: number;
  mcpServersConnected: number;
  openApiIntegrationsCount: number;
  ragDocumentsCount: number;
  ragChunksCount: number;
  vaultSecretsCount: number;
  permittedToolsCount: number;
  a2aAgentsCount: number;
}

export interface TelemetryMetricsDTO {
  totalExecutions: number;
  completed: number;
  failed: number;
  cancelled: number;
  paused: number;
  running: number;
  successRate: number;
  failureRate: number;
  avgDurationMs: number;
  statusBreakdown: Record<string, number>;
  providerBreakdown: { provider: string; count: number }[];
}

export interface LiveExecutionItemDTO {
  id: string;
  skillName: string;
  status: string;
  provider: string | null;
  startedAt: string;
  stepCount: number;
  maxSteps: number;
  currentToolName?: string;
  currentAction?: string;
}

export interface AgentGraphCardDTO {
  id: string;
  name: string;
  purpose: string;
  versionNumber: number;
  nodeCount: number;
  edgeCount: number;
  nodeTypes: string[];
  updatedAt: string;
}

export interface PinnedSkillDTO {
  id: string;
  name: string;
  purpose: string;
  versionId: string;
  versionNumber: number;
  inputSchema: Record<string, unknown>;
  examples: { input: Record<string, unknown>; output?: Record<string, unknown> }[];
  allowedTools: string[];
}

export interface ToolLeaderboardItemDTO {
  toolName: string;
  displayName: string;
  category: string;
  type: "READ" | "WRITE";
  callCount: number;
  avgDurationMs: number;
  errorCount: number;
  errorRate: number;
}

export interface RagInsightsDTO {
  totalCollections: number;
  totalDocuments: number;
  totalChunks: number;
  topCollections: { collection: string; documentCount: number; chunkCount: number }[];
  recentDocuments: { id: string; title: string; collection: string; chunkCount: number; updatedAt: string }[];
}

export interface AuditLogItemDTO {
  id: string;
  action: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface DashboardStatsDTO {
  timeRange: TimeRangeFilter;
  systemHealth: SystemHealthDTO;
  telemetry: TelemetryMetricsDTO;
  liveExecutions: LiveExecutionItemDTO[];
  agentGraphs: AgentGraphCardDTO[];
  pinnedSkills: PinnedSkillDTO[];
  toolLeaderboard: ToolLeaderboardItemDTO[];
  ragInsights: RagInsightsDTO;
  pendingApprovals: ApprovalRequestDTO[];
  recentExecutions: ExecutionDTO[];
  recentActivity: AuditLogItemDTO[];
  totalSkillsCount: number;
  publishedSkillsCount: number;
}
