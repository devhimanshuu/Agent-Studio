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
import { REDACTED, isRedactedValue, redactHeaders } from "@/lib/secrets";

/**
 * MCP server repository.
 *
 * SECURITY: `headers` carries upstream credentials (Authorization, API keys).
 * Every DTO returned by this class has header VALUES redacted — the raw
 * values only leave this class through `getRawHeadersForUser`, which the
 * service layer uses exclusively to establish outbound connections.
 */
export class McpServerRepository implements IMcpServerRepository {
  async findById(id: string): Promise<McpServerDTO | null> {
    const row = await prisma.mcpServer.findUnique({ where: { id } });
    return row ? this.map(row) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<McpServerDTO | null> {
    const row = await prisma.mcpServer.findFirst({ where: { id, userId } });
    return row ? this.map(row) : null;
  }

  /** Raw (unredacted) headers for one user-owned server — connection setup ONLY. */
  async getRawHeadersForUser(id: string, userId: string): Promise<Record<string, string> | null> {
    const row = await prisma.mcpServer.findFirst({
      where: { id, userId },
      select: { headers: true },
    });
    return (row?.headers as Record<string, string> | null) ?? null;
  }

  async findByUserId(userId: string, limit?: number): Promise<McpServerDTO[]> {
    const rows = await prisma.mcpServer.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      ...(limit && limit > 0 ? { take: Math.min(limit, 200) } : {}),
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

    // Merge semantics for redacted header values: a client that received the
    // masked DTO sends `__REDACTED__` back — keep the stored secret instead
    // of persisting the sentinel over it.
    let mergedHeaders: Record<string, string> | undefined;
    if (input.headers !== undefined && input.headers !== null) {
      const existingHeaders = (existing.headers as Record<string, string> | null) ?? {};
      mergedHeaders = {};
      for (const [name, value] of Object.entries(input.headers)) {
        mergedHeaders[name] = isRedactedValue(value) ? existingHeaders[name] ?? value : value;
      }
    }

    const row = await prisma.mcpServer.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.endpointUrl !== undefined && { endpointUrl: input.endpointUrl || null }),
        ...(input.command !== undefined && { command: input.command || null }),
        ...(mergedHeaders !== undefined && {
          headers: mergedHeaders as unknown as Prisma.InputJsonValue,
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
      headers: redactHeaders(row.headers as Record<string, string> | null),
      status: row.status,
      cachedTools: Array.isArray(row.cachedTools) ? (row.cachedTools as unknown as McpToolDefinition[]) : [],
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export { REDACTED };
