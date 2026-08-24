// ────────────── Skills Marketplace ──────────────

export type SkillCategory = "RESEARCH" | "CODING" | "ANALYSIS" | "CREATIVE" | "PRODUCTIVITY" | "DATA" | "COMMUNICATION" | "AUTOMATION" | "KNOWLEDGE";

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  author: string;
  source: "glama" | "mcp.so" | "awesome-mcp" | "community" | "smithery" | "composio" | "arcade";
  sourceUrl?: string;
  requiredServers: string[]; // MCP server IDs needed
  requiredTools: string[];   // Specific tool names needed
  tags: string[];
  /** Real GitHub stars when the source provides them — NEVER fabricated. */
  stars?: number;
  /** Real install counts when the registry exposes them; undefined otherwise. */
  installs?: number;
  /** Real rating when the source provides one; undefined otherwise. */
  rating?: number; // 1-5
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  estimatedTime: string; // e.g., "5 min"
  steps: SkillStep[];
}

export interface SkillStep {
  order: number;
  action: string; // e.g., "connect-supabase", "run-query", "summarize"
  description: string;
  requiredTool?: string;
  config?: Record<string, unknown>;
}

export interface SkillsFeedResponse {
  success: boolean;
  total: number;
  data: AgentSkill[];
  categories: { id: SkillCategory; count: number }[];
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
    hasMore: boolean;
  };
}

// ────────────── Quality Scoring ──────────────

export type QualityGrade = "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";

export interface ServerQualityScore {
  serverId: string;
  overall: QualityGrade;
  overallScore: number; // 0-100
  dimensions: {
    schemaQuality: { score: number; grade: QualityGrade; details: string };
    latency: { score: number; grade: QualityGrade; avgMs: number };
    uptime: { score: number; grade: QualityGrade; percent: number };
    documentation: { score: number; grade: QualityGrade; hasReadme: boolean; hasExamples: boolean };
    maintenance: { score: number; grade: QualityGrade; lastUpdated: string; commitFrequency: string };
    community: { score: number; grade: QualityGrade; stars: number; issues: number; forks: number };
  };
  badges: QualityBadge[];
  lastScored: string;
}

export interface QualityBadge {
  id: string;
  label: string;
  icon: string;
  description: string;
  earnedAt: string;
}

// ────────────── Server Composition ──────────────

export type CompositionNodeType = "MCP_SERVER" | "TRANSFORM" | "CONDITION" | "OUTPUT" | "INPUT";

export interface CompositionNode {
  id: string;
  type: CompositionNodeType;
  serverId?: string; // For MCP_SERVER nodes
  toolName?: string; // Specific tool to call
  config: Record<string, unknown>;
  position: { x: number; y: number };
  label: string;
}

export interface CompositionEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  sourceOutput?: string;
  targetInput?: string;
  label?: string;
}

export interface ServerComposition {
  id: string;
  name: string;
  description: string;
  nodes: CompositionNode[];
  edges: CompositionEdge[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  tags: string[];
  usedBy: number;
  rating: number;
}

// ────────────── Agent Skill Chains ──────────────

export interface SkillChainStep {
  order: number;
  skillId: string;
  skillName: string;
  inputMapping?: string;
  outputMapping?: string;
  config?: Record<string, unknown>;
  timeoutMs?: number;
  retryOnFailure?: boolean;
}

export interface AgentSkillChain {
  id: string;
  name: string;
  description: string;
  steps: SkillChainStep[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  tags: string[];
  totalExecutions: number;
  avgExecutionTimeMs: number;
  successRate: number;
  rating: number;
}

// ────────────── Agent Registry ──────────────

export type AgentStatus = "ONLINE" | "OFFLINE" | "BUSY" | "ERROR";

export interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  owner: string;
  endpointUrl: string; // MCP-compatible endpoint
  transport: "SSE" | "STDIO";
  capabilities: AgentCapability[];
  status: AgentStatus;
  lastSeen: string;
  totalCalls: number;
  avgLatencyMs: number;
  trustScore: number; // 0-100
  isVerified: boolean;
  tags: string[];
  createdAt: string;
}

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  estimatedLatencyMs: number;
}

export interface AgentRegistryResponse {
  success: boolean;
  total: number;
  data: RegisteredAgent[];
}
