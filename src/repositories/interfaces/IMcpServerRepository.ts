import {
  CreateMcpServerInput,
  McpServerDTO,
  McpServerStatus,
  McpToolDefinition,
  UpdateMcpServerInput,
} from "@/types/mcp";

export interface IMcpServerRepository {
  findById(id: string): Promise<McpServerDTO | null>;
  /** Scoped to the owning user — returns null when the server belongs to someone else. */
  findByIdForUser(id: string, userId: string): Promise<McpServerDTO | null>;
  findByUserId(userId: string): Promise<McpServerDTO[]>;
  create(input: CreateMcpServerInput): Promise<McpServerDTO>;
  update(id: string, userId: string, input: UpdateMcpServerInput): Promise<McpServerDTO>;
  delete(id: string, userId: string): Promise<void>;
  updateStatus(id: string, status: McpServerStatus, lastError?: string | null): Promise<McpServerDTO>;
  /** Atomically persist the discovered tool cache. */
  updateCachedTools(id: string, tools: McpToolDefinition[]): Promise<McpServerDTO>;
}
