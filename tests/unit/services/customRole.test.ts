import { describe, it, expect, beforeEach, vi } from "vitest";
import { CustomRoleService } from "@/services/CustomRoleService";

// Mock Prisma
const mockPrisma = vi.hoisted(() => ({
  customRole: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  organizationMember: {
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

describe("CustomRoleService", () => {
  let service: CustomRoleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CustomRoleService();
  });

  describe("getAvailablePermissions", () => {
    it("returns list of available permissions", () => {
      const permissions = service.getAvailablePermissions();
      expect(permissions).toContain("skills:create");
      expect(permissions).toContain("skills:read");
      expect(permissions).toContain("members:manage");
      expect(permissions).toContain("org:manage");
    });
  });

  describe("isValidPermission", () => {
    it("returns true for valid permissions", () => {
      expect(service.isValidPermission("skills:create")).toBe(true);
      expect(service.isValidPermission("members:manage")).toBe(true);
    });

    it("returns false for invalid permissions", () => {
      expect(service.isValidPermission("invalid:permission")).toBe(false);
      expect(service.isValidPermission("skills")).toBe(false);
    });
  });

  describe("create", () => {
    it("creates a custom role for admin user", async () => {
      const mockRole = {
        id: "role-1",
        organizationId: "org-1",
        name: "Tester",
        description: "Can test skills",
        permissions: ["skills:execute", "skills:read"],
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { members: 0 },
      };

      // Mock RBAC check - admin user
      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageSettings: true }),
      });

      // Mock audit service
      vi.spyOn(service as any, "auditService", "get").mockReturnValue({
        log: vi.fn().mockResolvedValue(undefined),
      });

      mockPrisma.customRole.findFirst.mockResolvedValue(null);
      mockPrisma.customRole.create.mockResolvedValue(mockRole);

      const result = await service.create("user-1", "org-1", {
        name: "Tester",
        description: "Can test skills",
        permissions: ["skills:execute", "skills:read"],
      });

      expect(result.name).toBe("Tester");
      expect(result.permissions).toEqual(["skills:execute", "skills:read"]);
      expect(mockPrisma.customRole.create).toHaveBeenCalled();
    });

    it("throws error if role name already exists", async () => {
      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageSettings: true }),
      });

      mockPrisma.customRole.findFirst.mockResolvedValue({ id: "existing-role" });

      await expect(
        service.create("user-1", "org-1", {
          name: "Tester",
          permissions: ["skills:read"],
        })
      ).rejects.toThrow("already exists");
    });

    it("throws ForbiddenError for non-admin users", async () => {
      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageSettings: false }),
      });

      await expect(
        service.create("user-1", "org-1", {
          name: "Tester",
          permissions: ["skills:read"],
        })
      ).rejects.toThrow("Only admins and owners can create custom roles");
    });

    it("throws error for invalid permissions", async () => {
      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageSettings: true }),
      });

      await expect(
        service.create("user-1", "org-1", {
          name: "Tester",
          permissions: ["invalid:permission"],
        })
      ).rejects.toThrow("Invalid permissions");
    });
  });

  describe("list", () => {
    it("lists all custom roles for an organization", async () => {
      const mockRoles = [
        {
          id: "role-1",
          name: "Tester",
          permissions: ["skills:execute"],
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { members: 2 },
        },
        {
          id: "role-2",
          name: "Viewer",
          permissions: ["skills:read"],
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { members: 10 },
        },
      ];

      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getOrgMembership: vi.fn().mockResolvedValue({ role: "MEMBER" }),
      });

      mockPrisma.customRole.findMany.mockResolvedValue(mockRoles);

      const result = await service.list("user-1", "org-1");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Tester");
      expect(result[1].isSystem).toBe(true);
    });

    it("throws ForbiddenError for non-members", async () => {
      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getOrgMembership: vi.fn().mockResolvedValue(null),
      });

      await expect(service.list("user-1", "org-1")).rejects.toThrow("Not a member");
    });
  });

  describe("getById", () => {
    it("returns role if found", async () => {
      const mockRole = {
        id: "role-1",
        name: "Tester",
        permissions: ["skills:execute"],
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { members: 2 },
      };

      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getOrgMembership: vi.fn().mockResolvedValue({ role: "MEMBER" }),
      });

      mockPrisma.customRole.findFirst.mockResolvedValue(mockRole);

      const result = await service.getById("user-1", "org-1", "role-1");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Tester");
    });

    it("returns null if not found", async () => {
      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getOrgMembership: vi.fn().mockResolvedValue({ role: "MEMBER" }),
      });

      mockPrisma.customRole.findFirst.mockResolvedValue(null);

      const result = await service.getById("user-1", "org-1", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("updates role name and permissions", async () => {
      const existingRole = {
        id: "role-1",
        name: "Tester",
        permissions: ["skills:execute"],
        isSystem: false,
      };

      const updatedRole = {
        ...existingRole,
        name: "Advanced Tester",
        permissions: ["skills:execute", "skills:edit"],
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { members: 2 },
      };

      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageSettings: true }),
      });

      vi.spyOn(service as any, "auditService", "get").mockReturnValue({
        log: vi.fn().mockResolvedValue(undefined),
      });

      mockPrisma.customRole.findFirst
        .mockResolvedValueOnce(existingRole)
        .mockResolvedValueOnce(null);
      mockPrisma.customRole.update.mockResolvedValue(updatedRole);

      const result = await service.update("user-1", "org-1", "role-1", {
        name: "Advanced Tester",
        permissions: ["skills:execute", "skills:edit"],
      });

      expect(result.name).toBe("Advanced Tester");
    });

    it("throws error for system roles", async () => {
      const systemRole = {
        id: "role-1",
        name: "Admin",
        permissions: ["org:manage"],
        isSystem: true,
      };

      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageSettings: true }),
      });

      mockPrisma.customRole.findFirst.mockResolvedValue(systemRole);

      await expect(
        service.update("user-1", "org-1", "role-1", { name: "New Name" })
      ).rejects.toThrow("Cannot modify system roles");
    });
  });

  describe("delete", () => {
    it("deletes a custom role", async () => {
      const mockRole = {
        id: "role-1",
        name: "Tester",
        permissions: ["skills:execute"],
        isSystem: false,
      };

      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageSettings: true }),
      });

      vi.spyOn(service as any, "auditService", "get").mockReturnValue({
        log: vi.fn().mockResolvedValue(undefined),
      });

      mockPrisma.customRole.findFirst.mockResolvedValue(mockRole);
      mockPrisma.organizationMember.count.mockResolvedValue(0);
      mockPrisma.customRole.delete.mockResolvedValue(mockRole);

      await service.delete("user-1", "org-1", "role-1");

      expect(mockPrisma.customRole.delete).toHaveBeenCalledWith({
        where: { id: "role-1" },
      });
    });

    it("throws error if role is in use", async () => {
      const mockRole = {
        id: "role-1",
        name: "Tester",
        permissions: ["skills:execute"],
        isSystem: false,
      };

      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageSettings: true }),
      });

      mockPrisma.customRole.findFirst.mockResolvedValue(mockRole);
      mockPrisma.organizationMember.count.mockResolvedValue(5);

      await expect(service.delete("user-1", "org-1", "role-1")).rejects.toThrow(
        "Cannot delete role"
      );
    });

    it("throws error for system roles", async () => {
      const systemRole = {
        id: "role-1",
        name: "Admin",
        permissions: ["org:manage"],
        isSystem: true,
      };

      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageSettings: true }),
      });

      mockPrisma.customRole.findFirst.mockResolvedValue(systemRole);

      await expect(service.delete("user-1", "org-1", "role-1")).rejects.toThrow(
        "Cannot delete system roles"
      );
    });
  });

  describe("assignToMember", () => {
    it("assigns a custom role to a member", async () => {
      const mockRole = {
        id: "role-1",
        name: "Tester",
        organizationId: "org-1",
      };

      const mockMembership = {
        organizationId: "org-1",
        userId: "target-user",
        role: "MEMBER",
        customRoleId: null,
      };

      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageMembers: true }),
      });

      vi.spyOn(service as any, "auditService", "get").mockReturnValue({
        log: vi.fn().mockResolvedValue(undefined),
      });

      mockPrisma.customRole.findFirst.mockResolvedValue(mockRole);
      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.organizationMember.update.mockResolvedValue({});

      await service.assignToMember("admin-1", "org-1", "target-user", "role-1");

      expect(mockPrisma.organizationMember.update).toHaveBeenCalledWith({
        where: { organizationId_userId: { organizationId: "org-1", userId: "target-user" } },
        data: { customRoleId: "role-1" },
      });
    });

    it("throws error if assigning to yourself", async () => {
      const mockRole = {
        id: "role-1",
        name: "Tester",
        organizationId: "org-1",
      };

      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageMembers: true }),
      });

      mockPrisma.customRole.findFirst.mockResolvedValue(mockRole);
      mockPrisma.organizationMember.findUnique.mockResolvedValue({ userId: "admin-1" });

      await expect(
        service.assignToMember("admin-1", "org-1", "admin-1", "role-1")
      ).rejects.toThrow("Cannot assign role to yourself");
    });
  });

  describe("removeFromMember", () => {
    it("removes custom role from a member", async () => {
      const mockMembership = {
        organizationId: "org-1",
        userId: "target-user",
        customRoleId: "role-1",
      };

      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageMembers: true }),
      });

      vi.spyOn(service as any, "auditService", "get").mockReturnValue({
        log: vi.fn().mockResolvedValue(undefined),
      });

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.organizationMember.update.mockResolvedValue({});

      await service.removeFromMember("admin-1", "org-1", "target-user");

      expect(mockPrisma.organizationMember.update).toHaveBeenCalledWith({
        where: { organizationId_userId: { organizationId: "org-1", userId: "target-user" } },
        data: { customRoleId: null },
      });
    });

    it("throws error if user has no custom role", async () => {
      const mockMembership = {
        organizationId: "org-1",
        userId: "target-user",
        customRoleId: null,
      };

      vi.spyOn(service as any, "rbacService", "get").mockReturnValue({
        getUserOrgPermissions: vi.fn().mockResolvedValue({ canManageMembers: true }),
      });

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);

      await expect(
        service.removeFromMember("admin-1", "org-1", "target-user")
      ).rejects.toThrow("User does not have a custom role assigned");
    });
  });
});
