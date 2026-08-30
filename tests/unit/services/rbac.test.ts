/**
 * Unit tests for RBAC Service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    skill: {
      findUnique: vi.fn(),
    },
    execution: {
      findUnique: vi.fn(),
    },
    mcpServer: {
      findUnique: vi.fn(),
    },
    vaultEntry: {
      findUnique: vi.fn(),
    },
  },
}));

import { RBACService, ForbiddenError } from "@/services/RBACService";
import { prisma } from "@/lib/prisma";

describe("RBACService", () => {
  let rbacService: RBACService;

  beforeEach(() => {
    vi.clearAllMocks();
    rbacService = new RBACService();
  });

  describe("hasOrgRole", () => {
    it("returns true when user has required role", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "ADMIN",
        permissions: [],
      } as any);

      const result = await rbacService.hasOrgRole("user-1", "org-1", "MEMBER");
      expect(result).toBe(true);
    });

    it("returns false when user has lower role", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "VIEWER",
        permissions: [],
      } as any);

      const result = await rbacService.hasOrgRole("user-1", "org-1", "MEMBER");
      expect(result).toBe(false);
    });

    it("returns false when user is not a member", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue(null);

      const result = await rbacService.hasOrgRole("user-1", "org-1", "MEMBER");
      expect(result).toBe(false);
    });
  });

  describe("hasSkillPermission", () => {
    it("returns true for skill owner", async () => {
      vi.mocked(prisma.skill.findUnique).mockResolvedValue({
        userId: "user-1",
        organizationId: null,
      } as any);

      const result = await rbacService.hasSkillPermission("user-1", "skill-1", "SKILL_ADMIN");
      expect(result).toBe(true);
    });

    it("returns true for org admin", async () => {
      vi.mocked(prisma.skill.findUnique).mockResolvedValue({
        userId: "user-2",
        organizationId: "org-1",
      } as any);

      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "ADMIN",
        permissions: [],
      } as any);

      const result = await rbacService.hasSkillPermission("user-1", "skill-1", "SKILL_ADMIN");
      expect(result).toBe(true);
    });

    it("returns false for non-member", async () => {
      vi.mocked(prisma.skill.findUnique).mockResolvedValue({
        userId: "user-2",
        organizationId: "org-1",
      } as any);

      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue(null);

      const result = await rbacService.hasSkillPermission("user-1", "skill-1", "SKILL_VIEWER");
      expect(result).toBe(false);
    });
  });

  describe("requireOrgRole", () => {
    it("returns permissions when user has required role", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "ADMIN",
        permissions: [],
      } as any);

      const permissions = await rbacService.requireOrgRole("user-1", "org-1", "MEMBER");
      expect(permissions.role).toBe("ADMIN");
      expect(permissions.canManageMembers).toBe(true);
    });

    it("throws ForbiddenError when user lacks required role", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "VIEWER",
        permissions: [],
      } as any);

      await expect(
        rbacService.requireOrgRole("user-1", "org-1", "ADMIN")
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("requireSkillPermission", () => {
    it("returns permissions when user has required permission", async () => {
      vi.mocked(prisma.skill.findUnique).mockResolvedValue({
        userId: "user-2",
        organizationId: "org-1",
      } as any);

      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "MEMBER",
        permissions: ["SKILL_EDITOR", "SKILL_EXECUTOR"],
      } as any);

      const permissions = await rbacService.requireSkillPermission(
        "user-1",
        "skill-1",
        "SKILL_EDITOR"
      );
      expect(permissions.isEditor).toBe(true);
    });

    it("throws ForbiddenError when user lacks required permission", async () => {
      vi.mocked(prisma.skill.findUnique).mockResolvedValue({
        userId: "user-2",
        organizationId: "org-1",
      } as any);

      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "VIEWER",
        permissions: [],
      } as any);

      await expect(
        rbacService.requireSkillPermission("user-1", "skill-1", "SKILL_EDITOR")
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("getUserOrgPermissions", () => {
    it("returns correct permissions for OWNER", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "OWNER",
        permissions: [],
      } as any);

      const permissions = await rbacService.getUserOrgPermissions("user-1", "org-1");
      expect(permissions.isOwner).toBe(true);
      expect(permissions.canDeleteOrg).toBe(true);
      expect(permissions.canManageMembers).toBe(true);
    });

    it("returns correct permissions for VIEWER", async () => {
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        role: "VIEWER",
        permissions: [],
      } as any);

      const permissions = await rbacService.getUserOrgPermissions("user-1", "org-1");
      expect(permissions.isOwner).toBe(false);
      expect(permissions.canDeleteOrg).toBe(false);
      expect(permissions.canManageMembers).toBe(false);
      expect(permissions.canCreateSkill).toBe(false);
    });
  });
});
