import { IAuditLogRepository, AuditLogDTO } from "@/repositories/interfaces/IAuditLogRepository";
import { AuditQuery } from "@/types/observability";

/**
 * Queries and exports the audit trail for the owning user.
 */
export class AuditService {
  constructor(private auditRepo: IAuditLogRepository) {}

  async list(userId: string, query: AuditQuery): Promise<AuditLogDTO[]> {
    return this.auditRepo.listForUser(userId, {
      search: query.search,
      action: query.action,
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
  }

  /** JSON export payload: list + export metadata. */
  async export(userId: string, query: AuditQuery): Promise<{ exportedAt: string; count: number; entries: AuditLogDTO[] }> {
    const entries = await this.list(userId, { ...query, limit: 1000 });
    return {
      exportedAt: new Date().toISOString(),
      count: entries.length,
      entries,
    };
  }
}
