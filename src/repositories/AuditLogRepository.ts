import { IAuditLogRepository, AuditLogDTO } from "./interfaces/IAuditLogRepository";
import { prisma } from "@/lib/prisma";

export class AuditLogRepository implements IAuditLogRepository {
  async log(entry: Omit<AuditLogDTO, "id" | "timestamp">): Promise<AuditLogDTO> {
    const created = await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        executionId: entry.executionId,
        action: entry.action,
        details: entry.details as any,
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

    return logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      executionId: l.executionId,
      action: l.action,
      details: l.details as Record<string, unknown>,
      ipAddress: l.ipAddress,
      timestamp: l.timestamp,
    }));
  }
}
