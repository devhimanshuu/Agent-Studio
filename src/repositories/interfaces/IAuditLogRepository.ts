export interface AuditLogDTO {
  id: string;
  userId?: string | null;
  executionId?: string | null;
  action: string;
  details: Record<string, unknown>;
  ipAddress?: string | null;
  timestamp: Date;
}

export interface AuditLogQuery {
  search?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface IAuditLogRepository {
  log(entry: Omit<AuditLogDTO, "id" | "timestamp">): Promise<AuditLogDTO>;
  findByUserId(userId: string): Promise<AuditLogDTO[]>;
  /** Filterable audit history for the observability / audit pages. */
  listForUser(userId: string, query: AuditLogQuery): Promise<AuditLogDTO[]>;
}
