import { Prisma } from "@prisma/client";
import { IMcpServerRepository } from "./interfaces/IMcpServerRepository";
import {
  CreateMcpServerInput,
  McpServerDTO,
  McpServerStatus,
  McpToolDefinition,
  UpdateMcpServerInput,
} from "@/types/mcp";
import { prisma } from "@/lib/prisma";
import { ensureUserExists } from "@/lib/user";

export class McpServerRepository implements IMcpServerRepository {
  async findById(id: string): Promise<McpServerDTO | null> {
    const row = await prisma.mcpServer.findUnique({ where: { id } });
    return row ? this.map(row) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<McpServerDTO | null> {
    const row = await prisma.mcpServer.findFirst({ where: { id, userId } });
    return row ? this.map(row) : null;
  }

  async findByUserId(userId: string): Promise<McpServerDTO[]> {
    const rows = await prisma.mcpServer.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => this.map(row));
  }

  async create(input: CreateMcpServerInput): Promise<McpServerDTO> {
    const row = await prisma.$transaction(async (tx) => {
      await ensureUserExists(input.userId, tx);
      return tx.mcpServer.create({
        data: {
          userId: input.userId,
          name: input.name,
          transport: input.transport,
          endpointUrl: input.endpointUrl ?? null,
          command: input.command ?? null,
          headers: (input.headers ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
          status: "DISCONNECTED",
          cachedTools: [],
        },
      });
    });
    return this.map(row);
  }

  async update(id: string, userId: string, input: UpdateMcpServerInput): Promise<McpServerDTO> {
    const existing = await prisma.mcpServer.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("MCP server not found or you do not have access to it");
    const row = await prisma.mcpServer.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.endpointUrl !== undefined && { endpointUrl: input.endpointUrl || null }),
        ...(input.command !== undefined && { command: input.command || null }),
        ...(input.headers !== undefined && {
          headers: (input.headers as Prisma.InputJsonValue) ?? Prisma.DbNull,
        }),
        ...(input.clearHeaders === true && { headers: Prisma.DbNull }),
      },
    });
    return this.map(row);
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.mcpServer.deleteMany({ where: { id, userId } });
  }

  async updateStatus(id: string, status: McpServerStatus, lastError?: string | null): Promise<McpServerDTO> {
    const row = await prisma.mcpServer.update({
      where: { id },
      data: {
        status,
        ...(lastError !== undefined ? { lastError } : {}),
      },
    });
    return this.map(row);
  }

  async updateCachedTools(id: string, tools: McpToolDefinition[]): Promise<McpServerDTO> {
    const row = await prisma.mcpServer.update({
      where: { id },
      data: {
        cachedTools: tools as unknown as Prisma.InputJsonValue,
        status: "CONNECTED",
        lastError: null,
      },
    });
    return this.map(row);
  }

  private map(row: Prisma.McpServerGetPayload<{}>): McpServerDTO {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      transport: row.transport,
      endpointUrl: row.endpointUrl,
      command: row.command,
      headers: (row.headers as Record<string, string> | null) ?? null,
      status: row.status,
      cachedTools: Array.isArray(row.cachedTools) ? (row.cachedTools as unknown as McpToolDefinition[]) : [],
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
