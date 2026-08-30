/**
 * Unit tests for Audit Service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { AuditService } from "@/services/AuditService";
import { prisma } from "@/lib/prisma";

describe("AuditService", () => {
  let auditService: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    auditService = new AuditService();
  });

  describe("log", () => {
    it("creates audit log entry", async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await auditService.log({
        action: "MEMBER_INVITED",
        userId: "user-1",
        organizationId: "org-1",
        resourceType: "member",
        details: { targetEmail: "test@example.com", role: "MEMBER" },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          organizationId: "org-1",
          action: "MEMBER_INVITED",
          details: expect.objectContaining({
            resourceType: "member",
            targetEmail: "test@example.com",
            role: "MEMBER",
          }),
        }),
      });
    });

    it("does not throw on audit log failure", async () => {
      vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("DB error"));

      // Should not throw
      await expect(
        auditService.log({
          action: "MEMBER_INVITED",
          userId: "user-1",
          organizationId: "org-1",
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("getOrganizationLogs", () => {
    it("returns logs with pagination", async () => {
      const mockLogs = [
        { id: "log-1", action: "MEMBER_INVITED", timestamp: new Date() },
        { id: "log-2", action: "MEMBER_JOINED", timestamp: new Date() },
      ];

      vi.mocked(prisma.auditLog.findMany).mockResolvedValue(mockLogs as any);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(2);

      const result = await auditService.getOrganizationLogs("org-1", {
        limit: 10,
        offset: 0,
      });

      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(2);
    });

    it("filters by action", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

      await auditService.getOrganizationLogs("org-1", {
        action: "MEMBER_INVITED",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: "MEMBER_INVITED",
          }),
        })
      );
    });

    it("filters by date range", async () => {
      const startDate = new Date("2026-01-01");
      const endDate = new Date("2026-12-31");

      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

      await auditService.getOrganizationLogs("org-1", {
        startDate,
        endDate,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });
  });

  describe("convenience methods", () => {
    it("logMemberInvited creates correct audit entry", async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await auditService.logMemberInvited({
        userId: "admin-1",
        organizationId: "org-1",
        targetEmail: "new@example.com",
        role: "MEMBER",
        ipAddress: "192.168.1.1",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "MEMBER_INVITED",
          userId: "admin-1",
          organizationId: "org-1",
          details: expect.objectContaining({
            targetEmail: "new@example.com",
            role: "MEMBER",
          }),
          ipAddress: "192.168.1.1",
        }),
      });
    });

    it("logMemberRoleChanged includes old and new role", async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await auditService.logMemberRoleChanged({
        userId: "admin-1",
        organizationId: "org-1",
        targetUserId: "user-2",
        oldRole: "MEMBER",
        newRole: "ADMIN",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "MEMBER_ROLE_CHANGED",
          details: expect.objectContaining({
            oldRole: "MEMBER",
            newRole: "ADMIN",
          }),
        }),
      });
    });

    it("logApiKeyCreated includes key name", async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await auditService.logApiKeyCreated({
        userId: "admin-1",
        organizationId: "org-1",
        keyId: "key-123",
        keyName: "CI/CD Key",
      });

      expect(prisma.auditLog.create).toHaveBeenCalled();
      const callArgs = vi.mocked(prisma.auditLog.create).mock.calls[0][0];
      expect(callArgs.data.action).toBe("API_KEY_CREATED");
      // resourceId is inside details, not at top level
      expect(callArgs.data.details).toMatchObject({
        resourceId: "key-123",
        keyName: "CI/CD Key",
      });
    });
  });
});
