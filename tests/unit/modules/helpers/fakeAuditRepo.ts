import { IAuditLogRepository, AuditLogDTO, AuditLogQuery } from "@/repositories/interfaces/IAuditLogRepository";

export class FakeAuditRepo implements IAuditLogRepository {
  entries: AuditLogDTO[] = [];
  private seq = 0;

  async log(entry: Omit<AuditLogDTO, "id" | "timestamp">): Promise<AuditLogDTO> {
    this.seq += 1;
    const row: AuditLogDTO = {
      id: `audit-${this.seq}`,
      userId: entry.userId,
      executionId: entry.executionId,
      action: entry.action,
      details: entry.details,
      ipAddress: entry.ipAddress,
      timestamp: new Date(),
    };
    this.entries.push(row);
    return row;
  }

  async findByUserId(userId: string): Promise<AuditLogDTO[]> {
    return this.entries.filter((e) => e.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async listForUser(userId: string, query: AuditLogQuery): Promise<AuditLogDTO[]> {
    let items = this.entries.filter((e) => e.userId === userId);
    if (query.action) items = items.filter((e) => e.action === query.action);
    if (query.from) items = items.filter((e) => e.timestamp >= new Date(query.from!));
    if (query.to) items = items.filter((e) => e.timestamp <= new Date(query.to!));
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(
        (e) => e.action.toLowerCase().includes(q) || (e.executionId ?? "").toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items.slice(0, query.limit ?? 200);
  }
}
