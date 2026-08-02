export interface AuditLogDTO {
  id: string;
  userId?: string | null;
  executionId?: string | null;
  action: string;
  details: Record<string, unknown>;
  ipAddress?: string | null;
  timestamp: Date;
}

export interface IAuditLogRepository {
  log(entry: Omit<AuditLogDTO, "id" | "timestamp">): Promise<AuditLogDTO>;
  findByUserId(userId: string): Promise<AuditLogDTO[]>;
}
