import { ToolType } from "./tool";

/** Transports supported by the MCP client hub. */
export type McpTransport = "SSE" | "STDIO";

export type McpServerStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";

/** A progress event emitted during MCP tool/resource/prompt calls. */
export interface McpProgressEvent {
  type: "started" | "progress" | "completed" | "failed";
  operation: "callTool" | "listResources" | "readResource" | "listPrompts" | "getPrompt";
  detail?: string;
  progress?: number; // 0-100 percentage when type === "progress"
  message?: string;
  error?: string;
  timestamp: number;
}

/** A sampling request from a connected MCP server for LLM completion. */
export interface McpSamplingRequest {
  serverId: string;
  serverName: string;
  messages: { role: "user" | "assistant"; content: { type: string; text?: string } }[];
  modelPreferences?: { hints?: { name: string }[]; costPriority?: number; speedPriority?: number; intelligencePriority?: number };
  systemPrompt?: string;
  temperature?: number;
  maxTokens: number;
  stopSequences?: string[];
  tools?: unknown[];
  toolChoice?: { mode?: string };
}

/** Result of an LLM sampling call. */
export interface McpSamplingResult {
  model: string;
  role: "assistant";
  content: { type: "text"; text: string };
  stopReason?: string;
}

/** Permission status for sampling requests from a specific server. */
export type McpSamplingPermission = "always" | "ask" | "never";

/** A tool discovered from a remote MCP server via `tools/list`. */
export interface McpToolDefinition {
  /** Server-local tool name (e.g. `create_issue`). */
  name: string;
  description?: string;
  /** JSON Schema (draft-07 style) accepted by the tool. */
  inputSchema: Record<string, unknown>;
  /** MCP tool annotations — hints about safety/idempotency. */
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  } | null;
  /** Whether the tool mutates external state (derived from annotations + heuristics). */
  isWrite: boolean;
  /** Whether invoking this tool must pause for HITL approval. */
  requiresApproval: boolean;
}

/** Persisted row for a configured MCP server (multi-tenant by userId). */
export interface McpServerDTO {
  id: string;
  userId: string;
  name: string;
  transport: McpTransport;
  endpointUrl?: string | null;
  command?: string | null;
  headers?: Record<string, string> | null;
  status: McpServerStatus;
  /** Cached discovered tool definitions + schemas (JSON). */
  cachedTools: McpToolDefinition[];
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Input to register a new MCP server connection. */
export interface CreateMcpServerInput {
  userId: string;
  name: string;
  transport: McpTransport;
  endpointUrl?: string;
  command?: string;
  headers?: Record<string, string>;
  /** When true, connect + discover tools immediately (default true). */
  connectOnCreate?: boolean;
}

/** Input to update an existing server (name / endpoint / headers / command). */
export interface UpdateMcpServerInput {
  name?: string;
  endpointUrl?: string;
  command?: string;
  headers?: Record<string, string>;
  /** Null clears the stored headers. */
  clearHeaders?: boolean;
}

/** Live health probe result for one server. */
export interface McpHealth {
  serverId: string;
  status: "healthy" | "degraded" | "unavailable";
  latencyMs: number;
  message?: string;
  toolCount: number;
}

/** Live execution of a discovered MCP tool from the hub UI. */
export interface McpToolTestResult {
  ok: boolean;
  durationMs: number;
  output?: unknown;
  error?: string;
  toolName: string;
  serverId: string;
}

/** One-click ecosystem preset shown in the MCP Server Hub. */
export interface McpPreset {
  id: string;
  name: string;
  transport: McpTransport;
  endpointUrl?: string;
  command?: string;
  /** Placeholder template for required auth headers (e.g. `Bearer ${GITHUB_PAT}`). */
  headers?: Record<string, string>;
  description: string;
  requiresAuthToken: boolean;
  category?: "DEVELOPMENT" | "DATABASE" | "WEB_SEARCH" | "PRODUCTIVITY" | "BROWSER" | "REASONING" | "DEVOPS" | "RESEARCH" | "UTILITY";
}

/** Registry tool type for MCP tools (kept for typing the hub UI). */
export type McpToolType = ToolType;

/** A registered skill/workflow exposed as an MCP tool on the Agent Studio server. */
export interface McpSkillToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** An MCP resource exposed by a connected MCP server (URI-addressable data/file/context). */
export interface McpResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** Result of reading an MCP resource. */
export interface McpResourceReadResult {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/** An MCP prompt template exposed by an MCP server. */
export interface McpPromptDefinition {
  name: string;
  description?: string;
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
  }[];
}

/** Prompt message contents returned by prompts/get. */
export interface McpPromptResult {
  description?: string;
  messages: {
    role: "user" | "assistant";
    content: {
      type: "text" | "resource" | "image";
      text?: string;
      resource?: McpResourceReadResult;
    };
  }[];
}

/** Aggregated telemetry/metrics for an MCP server. */
export interface McpServerMetrics {
  serverId: string;
  totalCalls: number;
  successRate: number;
  avgLatencyMs: number;
  lastCalledAt: Date | null;
  cachedToolCount: number;
  circuitState: "CLOSED" | "OPEN" | "HALF_OPEN";
}

// ─── Tool Update Discovery ───

/** A single tool-level change detected between two rediscovery snapshots. */
export type McpToolChangeKind = "added" | "removed" | "schema_changed" | "description_changed";

export interface McpToolChange {
  /** The tool name (common across old + new). */
  toolName: string;
  /** What changed. */
  kind: McpToolChangeKind;
  /** Previous definition (null when kind === "added"). */
  oldDef?: McpToolDefinition | null;
  /** New definition (null when kind === "removed"). */
  newDef?: McpToolDefinition | null;
  /** Human-readable summary of the schema diff (for the UI). */
  summary: string;
}

/** A pending update package for one MCP server. */
export interface McpToolUpdate {
  id: string;
  serverId: string;
  serverName: string;
  /** ISO timestamp of when this update was detected. */
  detectedAt: string;
  /** The list of tool-level changes. */
  changes: McpToolChange[];
  /** Skills whose allowedTools reference tools on this server. */
  affectedSkillIds: string[];
}

/** Input for applying a tool update to a skill draft. */
export interface ApplyToolUpdateInput {
  /** The update id from the pending updates list. */
  updateId: string;
  /** Which changes to apply (tool names). Omit to apply all. */
  toolNames?: string[];
  /** Skill IDs to update. Omit to update all affected skills. */
  skillIds?: string[];
}

