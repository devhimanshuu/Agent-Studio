import {
  CreateMcpServerInput,
  McpHealth,
  McpProgressEvent,
  McpSamplingResult,
  McpServerDTO,
  McpToolTestResult,
  UpdateMcpServerInput,
} from "@/types/mcp";
import { Tool, ToolRegistry } from "@/modules/tools";

export interface IMcpClientService {
  listServers(userId: string): Promise<McpServerDTO[]>;
  getServer(serverId: string, userId: string): Promise<McpServerDTO | null>;
  createServer(input: CreateMcpServerInput): Promise<McpServerDTO>;
  updateServer(serverId: string, userId: string, input: UpdateMcpServerInput): Promise<McpServerDTO>;
  deleteServer(serverId: string, userId: string): Promise<void>;
  connect(serverId: string, userId: string): Promise<McpServerDTO>;
  reconnect(serverId: string, userId: string): Promise<McpServerDTO>;
  disconnect(serverId: string, userId: string): Promise<McpServerDTO>;
  rediscoverTools(serverId: string, userId: string): Promise<McpServerDTO>;
  healthCheck(serverId: string, userId: string): Promise<McpHealth>;
  testTool(serverId: string, userId: string, toolName: string, args: Record<string, unknown>): Promise<McpToolTestResult>;
  listResources(serverId: string, userId: string): Promise<any[]>;
  readResource(serverId: string, userId: string, uri: string): Promise<any>;
  listPrompts(serverId: string, userId: string): Promise<any[]>;
  getPrompt(serverId: string, userId: string, promptName: string, args?: Record<string, string>): Promise<any>;
  getMetrics(serverId: string, userId: string): Promise<any>;
  /** Subscribe to progress events from a connected MCP server. */
  onProgress(serverId: string, userId: string, listener: (event: McpProgressEvent) => void): () => void;
  /** Handle a sampling/createMessage request from a connected MCP server. */
  handleSamplingRequest(serverId: string, userId: string, params: Record<string, unknown>): Promise<McpSamplingResult>;
  /** Sync cached MCP tools into a registry as standard ITools (idempotent). */
  registerUserMcpTools(userId: string, registry: ToolRegistry): Promise<Tool[]>;
  buildUserRegistry(userId: string, base: ToolRegistry): Promise<ToolRegistry>;
}
