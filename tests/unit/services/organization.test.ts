/**
 * Unit tests for Organization Service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organizationMember: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    invitation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { OrganizationService } from "@/services/OrganizationService";
import { prisma } from "@/lib/prisma";

describe("OrganizationService", () => {
  let orgService: OrganizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    orgService = new OrganizationService();
  });

  describe("create", () => {
    it("creates organization with owner membership", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.organization.create).mockResolvedValue({
        id: "org-1",
        name: "Test Org",
        slug: "test-org",
        plan: "free",
        billingEmail: null,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { members: 1 },
      } as any);

      const result = await orgService.create("user-1", {
        name: "Test Org",
      });

      expect(result.name).toBe("Test Org");
      expect(result.slug).toBe("test-org");
      expect(result.memberCount).toBe(1);
    });

    it("throws error for duplicate slug", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: "existing-org",
      } as any);

      await expect(
        orgService.create("user-1", { name: "Test Org", slug: "test-org" })
      ).rejects.toThrow("already exists");
    });
  });

  describe("inviteMember", () => {
    it("creates invitation successfully", async () => {
      vi.mocked(prisma.organizationMember.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.invitation.create).mockResolvedValue({
        id: "inv-1",
        email: "new@example.com",
        role: "MEMBER",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      } as any);

      // Mock RBAC check
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "ADMIN",
        permissions: [],
      } as any);

      const result = await orgService.inviteMember("user-1", "org-1", {
        email: "new@example.com",
        role: "MEMBER",
      });

      expect(result.email).toBe("new@example.com");
      expect(result.role).toBe("MEMBER");
    });

    it("throws error for existing member", async () => {
      vi.mocked(prisma.organizationMember.findFirst).mockResolvedValue({
        id: "member-1",
      } as any);
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "ADMIN",
        permissions: [],
      } as any);

      await expect(
        orgService.inviteMember("user-1", "org-1", {
          email: "existing@example.com",
        })
      ).rejects.toThrow("already a member");
    });
  });

  describe("acceptInvitation", () => {
    it("accepts valid invitation", async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue({
        id: "inv-1",
        organizationId: "org-1",
        email: "user@example.com",
        role: "MEMBER",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
      } as any);

      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.organizationMember.create).mockResolvedValue({
        id: "member-1",
        userId: "user-1",
        role: "MEMBER",
        joinedAt: new Date(),
        user: { name: "Test User", email: "user@example.com" },
      } as any);
      vi.mocked(prisma.invitation.update).mockResolvedValue({} as any);

      const result = await orgService.acceptInvitation("user-1", "valid-token");

      expect(result.role).toBe("MEMBER");
    });

    it("throws error for expired invitation", async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue({
        id: "inv-1",
        expiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
      } as any);

      await expect(
        orgService.acceptInvitation("user-1", "expired-token")
      ).rejects.toThrow("expired");
    });
  });

  describe("updateMemberRole", () => {
    it("updates role successfully", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValueOnce({
        role: "ADMIN",
        permissions: [],
      } as any);

      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValueOnce({
        userId: "user-2",
        role: "MEMBER",
        user: { name: "Other User" },
      } as any);

      vi.mocked(prisma.organizationMember.update).mockResolvedValue({
        userId: "user-2",
        role: "ADMIN",
        joinedAt: new Date(),
        user: { name: "Other User" },
      } as any);

      const result = await orgService.updateMemberRole(
        "user-1",
        "org-1",
        "user-2",
        "ADMIN"
      );

      expect(result.role).toBe("ADMIN");
    });

    it("prevents non-owner from promoting to owner", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValueOnce({
        role: "ADMIN",
        permissions: [],
      } as any);

      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValueOnce({
        userId: "user-2",
        role: "MEMBER",
      } as any);

      await expect(
        orgService.updateMemberRole("user-1", "org-1", "user-2", "OWNER")
      ).rejects.toThrow("Only owners can promote to owner");
    });
  });

  describe("removeMember", () => {
    it("removes member successfully", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValueOnce({
        role: "ADMIN",
        permissions: [],
      } as any);

      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValueOnce({
        userId: "user-2",
        role: "MEMBER",
      } as any);

      vi.mocked(prisma.organizationMember.delete).mockResolvedValue({} as any);

      await orgService.removeMember("user-1", "org-1", "user-2");

      expect(prisma.organizationMember.delete).toHaveBeenCalled();
    });

    it("prevents removing yourself", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "ADMIN",
        permissions: [],
      } as any);

      await expect(
        orgService.removeMember("user-1", "org-1", "user-1")
      ).rejects.toThrow("Cannot remove yourself");
    });

    it("prevents non-owner from removing owner", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValueOnce({
        role: "ADMIN",
        permissions: [],
      } as any);

      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValueOnce({
        userId: "user-2",
        role: "OWNER",
      } as any);

      await expect(
        orgService.removeMember("user-1", "org-1", "user-2")
      ).rejects.toThrow("Only owners can remove other owners");
    });
  });
});
