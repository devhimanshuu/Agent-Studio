/**
 * Google Agent-to-Agent (A2A) Protocol Standard Types & Schemas
 *
 * Provides standardized interfaces for:
 * 1. Agent Discovery & Manifests (agent.json / Agent Cards)
 * 2. Task Delegation & State Machine
 * 3. Cross-Agent Messaging & Swarm Negotiation
 */

export interface A2AEndpointConfig {
  tasks: string;
  messages?: string;
  stream?: string;
  health?: string;
}

export interface A2ACapability {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tags?: string[];
}

export interface A2AAuth {
  type: "none" | "bearer" | "oauth2" | "api_key";
  headerName?: string;
  tokenUrl?: string;
  scopes?: string[];
}

/**
 * Standard Google A2A Agent Card / Manifest representation.
 * Conforms to `/.well-known/agent.json` specification.
 */
export interface A2AAgentManifest {
  name: string;
  displayName?: string;
  description: string;
  version: string;
  protocolVersion: "1.0.0" | string;
  provider?: {
    name: string;
    url?: string;
    contact?: string;
  };
  endpoints: A2AEndpointConfig;
  capabilities: A2ACapability[];
  auth?: A2AAuth;
  icon?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export type A2ATaskStatus = "submitted" | "accepted" | "in_progress" | "completed" | "failed" | "rejected";

export interface A2ATaskRequest {
  taskId?: string;
  capability?: string;
  input: Record<string, unknown>;
  constraints?: {
    timeoutMs?: number;
    maxSteps?: number;
    streamTokens?: boolean;
    requireProof?: boolean;
  };
  callbackUrl?: string;
  context?: Record<string, unknown>;
}

export interface A2ATaskResponse {
  taskId: string;
  status: A2ATaskStatus;
  result?: unknown;
  error?: string;
  durationMs?: number;
  tokensUsed?: number;
  artifacts?: Array<{
    name: string;
    type: string;
    data: unknown;
  }>;
}

export interface A2AMessage {
  id?: string;
  sender: string;
  recipient?: string;
  role: "agent" | "user" | "system" | "mediator";
  content: string;
  turn?: number;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface A2AChannelParticipant {
  agentUrl: string;
  name: string;
  role: string;
  systemPrompt?: string;
  authToken?: string;
}

export type A2AChannelMode = "round_robin" | "debate" | "consensus" | "delegation";

export interface A2AChannelConfig {
  mode: A2AChannelMode;
  topic?: string;
  maxTurns?: number;
  participants: A2AChannelParticipant[];
}
