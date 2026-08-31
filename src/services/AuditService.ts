/**
 * Audit Service
 *
 * Logs permission changes and security-relevant events for compliance.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ────────────── Types ──────────────

export type AuditAction =
  | "ORG_CREATED"
  | "ORG_UPDATED"
  | "ORG_DELETED"
  | "MEMBER_INVITED"
  | "MEMBER_JOINED"
  | "MEMBER_REMOVED"
  | "MEMBER_ROLE_CHANGED"
  | "API_KEY_CREATED"
  | "API_KEY_DELETED"
  | "API_KEY_USED"
  | "API_KEYS_REVOKED"
  | "SKILL_PERMISSION_CHANGED"
  | "INVITATION_CANCELLED"
  | "INVITATION_ACCEPTED"
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "ROLE_DELETED"
  | "ROLE_ASSIGNED"
  | "ROLE_REMOVED";

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  organizationId?: string;
  resourceId?: string;
  resourceType?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

// ────────────── Service ──────────────

export class AuditService {
  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId || null,
          organizationId: entry.organizationId || null,
          action: entry.action,
          details: {
            resourceId: entry.resourceId,
            resourceType: entry.resourceType,
            ...entry.details,
          },
          ipAddress: entry.ipAddress || null,
        },
      });

      // Also log to application logger for monitoring
      logger.info(
        {
          action: entry.action,
          userId: entry.userId,
          organizationId: entry.organizationId,
          resourceId: entry.resourceId,
        },
        "Audit event logged"
      );
    } catch (error) {
      // Don't let audit logging failures break the main flow
      logger.error({ error, action: entry.action }, "Failed to log audit event");
    }
  }

  /**
   * Get audit logs for an organization
   */
  async getOrganizationLogs(
    organizationId: string,
    options?: {
      limit?: number;
      offset?: number;
      action?: AuditAction;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const where: import("@prisma/client").Prisma.AuditLogWhereInput = { organizationId };

    if (options?.action) {
      where.action = options.action;
    }

    if (options?.userId) {
      where.userId = options.userId;
    }

    if (options?.startDate || options?.endDate) {
      where.timestamp = {
        ...(options.startDate && { gte: options.startDate }),
        ...(options.endDate && { lte: options.endDate }),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: options?.limit || 100,
        skip: options?.offset || 0,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get audit logs for a user across all organizations
   */
  async getUserLogs(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      organizationId?: string;
    }
  ) {
    const where: import("@prisma/client").Prisma.AuditLogWhereInput = { userId };

    if (options?.organizationId) {
      where.organizationId = options.organizationId;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: options?.limit || 100,
        skip: options?.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  // ────────────── Convenience Methods ──────────────

  async logMemberInvited(params: {
    userId: string;
    organizationId: string;
    targetEmail: string;
    role: string;
    ipAddress?: string;
  }) {
    return this.log({
      action: "MEMBER_INVITED",
      userId: params.userId,
      organizationId: params.organizationId,
      resourceType: "member",
      details: {
        targetEmail: params.targetEmail,
        role: params.role,
      },
      ipAddress: params.ipAddress,
    });
  }

  async logMemberJoined(params: {
    userId: string;
    organizationId: string;
    role: string;
    ipAddress?: string;
  }) {
    return this.log({
      action: "MEMBER_JOINED",
      userId: params.userId,
      organizationId: params.organizationId,
      resourceType: "member",
      details: { role: params.role },
      ipAddress: params.ipAddress,
    });
  }

  async logMemberRemoved(params: {
    userId: string;
    organizationId: string;
    targetUserId: string;
    ipAddress?: string;
  }) {
    return this.log({
      action: "MEMBER_REMOVED",
      userId: params.userId,
      organizationId: params.organizationId,
      resourceId: params.targetUserId,
      resourceType: "member",
      ipAddress: params.ipAddress,
    });
  }

  async logMemberRoleChanged(params: {
    userId: string;
    organizationId: string;
    targetUserId: string;
    oldRole: string;
    newRole: string;
    ipAddress?: string;
  }) {
    return this.log({
      action: "MEMBER_ROLE_CHANGED",
      userId: params.userId,
      organizationId: params.organizationId,
      resourceId: params.targetUserId,
      resourceType: "member",
      details: {
        oldRole: params.oldRole,
        newRole: params.newRole,
      },
      ipAddress: params.ipAddress,
    });
  }

  async logApiKeyCreated(params: {
    userId: string;
    organizationId: string;
    keyId: string;
    keyName: string;
    ipAddress?: string;
  }) {
    return this.log({
      action: "API_KEY_CREATED",
      userId: params.userId,
      organizationId: params.organizationId,
      resourceId: params.keyId,
      resourceType: "api_key",
      details: { keyName: params.keyName },
      ipAddress: params.ipAddress,
    });
  }

  async logApiKeyDeleted(params: {
    userId: string;
    organizationId: string;
    keyId: string;
    ipAddress?: string;
  }) {
    return this.log({
      action: "API_KEY_DELETED",
      userId: params.userId,
      organizationId: params.organizationId,
      resourceId: params.keyId,
      resourceType: "api_key",
      ipAddress: params.ipAddress,
    });
  }

  async logSkillPermissionChanged(params: {
    userId: string;
    organizationId: string;
    skillId: string;
    targetUserId: string;
    permissions: string[];
    ipAddress?: string;
  }) {
    return this.log({
      action: "SKILL_PERMISSION_CHANGED",
      userId: params.userId,
      organizationId: params.organizationId,
      resourceId: params.skillId,
      resourceType: "skill",
      details: {
        targetUserId: params.targetUserId,
        permissions: params.permissions,
      },
      ipAddress: params.ipAddress,
    });
  }
}
