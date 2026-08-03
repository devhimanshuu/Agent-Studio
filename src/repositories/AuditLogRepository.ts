import { Prisma } from "@prisma/client";
import { IAuditLogRepository, AuditLogDTO, AuditLogQuery } from "./interfaces/IAuditLogRepository";
import { prisma } from "@/lib/prisma";

export class AuditLogRepository implements IAuditLogRepository {
  async log(entry: Omit<AuditLogDTO, "id" | "timestamp">): Promise<AuditLogDTO> {
    const created = await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        executionId: entry.executionId,
        action: entry.action,
        details: entry.details as unknown as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress,
      },
    });

    return {
      id: created.id,
      userId: created.userId,
      executionId: created.executionId,
      action: created.action,
      details: created.details as Record<string, unknown>,
      ipAddress: created.ipAddress,
      timestamp: created.timestamp,
    };
  }

  async findByUserId(userId: string): Promise<AuditLogDTO[]> {
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: 100,
    });

    return logs.map(this.mapLog);
  }

  async listForUser(userId: string, query: AuditLogQuery): Promise<AuditLogDTO[]> {
    const where: Prisma.AuditLogWhereInput = { userId };
    if (query.action) where.action = query.action;
    // Defense in depth: the route validates from/to and returns 400 first, but
    // the repo must never 500 on an Invalid Date from any caller — skip it.
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const fromValid = from !== undefined && !Number.isNaN(from.getTime());
    const toValid = to !== undefined && !Number.isNaN(to.getTime());
    if (fromValid || toValid) {
      where.timestamp = {
        ...(fromValid ? { gte: from } : {}),
        ...(toValid ? { lte: to } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: "insensitive" } },
        { executionId: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: Math.min(query.limit ?? 200, 500),
    });

    return logs.map(this.mapLog);
  }

  private mapLog(l: Prisma.AuditLogGetPayload<{}>): AuditLogDTO {
    return {
      id: l.id,
      userId: l.userId,
      executionId: l.executionId,
      action: l.action,
      details: l.details as Record<string, unknown>,
      ipAddress: l.ipAddress,
      timestamp: l.timestamp,
    };
  }
}
