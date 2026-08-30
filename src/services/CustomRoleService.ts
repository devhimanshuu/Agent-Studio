/**
 * Custom Role Service
 *
 * Manages custom role definitions for organizations.
 * Allows creating granular roles beyond the built-in OWNER/ADMIN/MEMBER/VIEWER.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { RBACService, ForbiddenError, OrgRole } from "./RBACService";
import { AuditService } from "./AuditService";

// ────────────── Types ──────────────

export interface CustomRoleDTO {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomRoleInput {
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdateCustomRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
}

// ────────────── Constants ──────────────

// Built-in system role names that cannot be modified/deleted
const SYSTEM_ROLES = ["Owner", "Admin", "Member", "Viewer"];

// Available permissions
export const AVAILABLE_PERMISSIONS = [
  // Organization
  "org:manage",
  
  // Members
  "members:manage",
  "members:read",
  
  // Skills
  "skills:create",
  "skills:read",
  "skills:edit",
  "skills:edit:own",
  "skills:delete",
  "skills:delete:own",
  "skills:execute",
  "skills:publish",
  
  // Executions
  "executions:create",
  "executions:read",
  "executions:read:own",
  "executions:cancel",
  "executions:cancel:own",
  
  // MCP Servers
  "mcp:manage",
  "mcp:read",
  "mcp:create",
  "mcp:delete",
  
  // Vault
  "vault:manage",
  "vault:create",
  "vault:read",
  "vault:read:own",
  "vault:delete",
  "vault:delete:own",
  
  // Audit
  "audit:view",
  "audit:read",
  
  // API Keys
  "api_keys:manage",
  "api_keys:read",
  
  // Roles
  "roles:manage",
  "roles:read",
];

// ────────────── Service ──────────────

export class CustomRoleService {
  private rbacService: RBACService;
  private auditService: AuditService;

  constructor() {
    this.rbacService = new RBACService();
    this.auditService = new AuditService();
  }

  /**
   * List all custom roles for an organization
   */
  async list(
    userId: string,
    organizationId: string
  ): Promise<CustomRoleDTO[]> {
    // Check membership
    const membership = await this.rbacService.getOrgMembership(userId, organizationId);
    if (!membership) {
      throw new ForbiddenError("Not a member of this organization");
    }

    const roles = await prisma.customRole.findMany({
      where: { organizationId },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: [
        { isSystem: "desc" }, // System roles first
        { name: "asc" },
      ],
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions as string[],
      isSystem: role.isSystem,
      memberCount: role._count.members,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  /**
   * Get a custom role by ID
   */
  async getById(
    userId: string,
    organizationId: string,
    roleId: string
  ): Promise<CustomRoleDTO | null> {
    // Check membership
    const membership = await this.rbacService.getOrgMembership(userId, organizationId);
    if (!membership) {
      throw new ForbiddenError("Not a member of this organization");
    }

    const role = await prisma.customRole.findFirst({
      where: { id: roleId, organizationId },
      include: {
        _count: { select: { members: true } },
      },
    });

    if (!role) return null;

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions as string[],
      isSystem: role.isSystem,
      memberCount: role._count.members,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  /**
   * Create a new custom role
   */
  async create(
    userId: string,
    organizationId: string,
    input: CreateCustomRoleInput
  ): Promise<CustomRoleDTO> {
    // Check permission (only admins/owners can create roles)
    const permissions = await this.rbacService.getUserOrgPermissions(userId, organizationId);
    if (!permissions.canManageSettings) {
      throw new ForbiddenError("Only admins and owners can create custom roles");
    }

    // Validate permissions
    const invalidPermissions = input.permissions.filter(
      (p) => !AVAILABLE_PERMISSIONS.includes(p)
    );
    if (invalidPermissions.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPermissions.join(", ")}`);
    }

    // Check name uniqueness within organization
    const existing = await prisma.customRole.findFirst({
      where: { organizationId, name: input.name },
    });
    if (existing) {
      throw new Error(`Role with name "${input.name}" already exists`);
    }

    // Create role
    const role = await prisma.customRole.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        permissions: input.permissions,
        isSystem: false,
      },
    });

    // Log audit event
    await this.auditService.log({
      action: "ROLE_CREATED",
      userId,
      organizationId,
      resourceId: role.id,
      resourceType: "role",
      details: {
        roleName: input.name,
        permissions: input.permissions,
      },
    });

    logger.info({ roleId: role.id, organizationId, userId }, "Custom role created");

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions as string[],
      isSystem: role.isSystem,
      memberCount: 0,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  /**
   * Update a custom role
   */
  async update(
    userId: string,
    organizationId: string,
    roleId: string,
    input: UpdateCustomRoleInput
  ): Promise<CustomRoleDTO> {
    // Check permission
    const permissions = await this.rbacService.getUserOrgPermissions(userId, organizationId);
    if (!permissions.canManageSettings) {
      throw new ForbiddenError("Only admins and owners can update custom roles");
    }

    // Get existing role
    const existing = await prisma.customRole.findFirst({
      where: { id: roleId, organizationId },
    });

    if (!existing) {
      throw new Error("Role not found");
    }

    // Prevent modifying system roles
    if (existing.isSystem) {
      throw new Error("Cannot modify system roles");
    }

    // Validate permissions if provided
    if (input.permissions) {
      const invalidPermissions = input.permissions.filter(
        (p) => !AVAILABLE_PERMISSIONS.includes(p)
      );
      if (invalidPermissions.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPermissions.join(", ")}`);
      }
    }

    // Check name uniqueness if changing name
    if (input.name && input.name !== existing.name) {
      const nameExists = await prisma.customRole.findFirst({
        where: { organizationId, name: input.name, id: { not: roleId } },
      });
      if (nameExists) {
        throw new Error(`Role with name "${input.name}" already exists`);
      }
    }

    // Update role
    const role = await prisma.customRole.update({
      where: { id: roleId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.permissions !== undefined && { permissions: input.permissions }),
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    // Log audit event
    await this.auditService.log({
      action: "ROLE_UPDATED",
      userId,
      organizationId,
      resourceId: roleId,
      resourceType: "role",
      details: {
        oldName: existing.name,
        newName: role.name,
        oldPermissions: existing.permissions,
        newPermissions: role.permissions,
      },
    });

    logger.info({ roleId, organizationId, userId }, "Custom role updated");

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions as string[],
      isSystem: role.isSystem,
      memberCount: role._count.members,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  /**
   * Delete a custom role
   */
  async delete(
    userId: string,
    organizationId: string,
    roleId: string
  ): Promise<void> {
    // Check permission
    const permissions = await this.rbacService.getUserOrgPermissions(userId, organizationId);
    if (!permissions.canManageSettings) {
      throw new ForbiddenError("Only admins and owners can delete custom roles");
    }

    // Get existing role
    const existing = await prisma.customRole.findFirst({
      where: { id: roleId, organizationId },
    });

    if (!existing) {
      throw new Error("Role not found");
    }

    // Prevent deleting system roles
    if (existing.isSystem) {
      throw new Error("Cannot delete system roles");
    }

    // Check if role is in use
    const memberCount = await prisma.organizationMember.count({
      where: { customRoleId: roleId },
    });

    if (memberCount > 0) {
      throw new Error(`Cannot delete role "${existing.name}" - ${memberCount} member(s) are using it. Reassign them first.`);
    }

    // Log audit event before deletion
    await this.auditService.log({
      action: "ROLE_DELETED",
      userId,
      organizationId,
      resourceId: roleId,
      resourceType: "role",
      details: {
        roleName: existing.name,
        permissions: existing.permissions,
      },
    });

    // Delete role
    await prisma.customRole.delete({
      where: { id: roleId },
    });

    logger.info({ roleId, organizationId, userId }, "Custom role deleted");
  }

  /**
   * Assign a custom role to a member
   */
  async assignToMember(
    userId: string,
    organizationId: string,
    targetUserId: string,
    roleId: string
  ): Promise<void> {
    // Check permission
    const permissions = await this.rbacService.getUserOrgPermissions(userId, organizationId);
    if (!permissions.canManageMembers) {
      throw new ForbiddenError("Only admins and owners can assign roles");
    }

    // Verify role exists and belongs to organization
    const role = await prisma.customRole.findFirst({
      where: { id: roleId, organizationId },
    });

    if (!role) {
      throw new Error("Role not found");
    }

    // Verify target user is a member
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
    });

    if (!membership) {
      throw new Error("User is not a member of this organization");
    }

    // Cannot assign role to yourself
    if (userId === targetUserId) {
      throw new Error("Cannot assign role to yourself");
    }

    // Update member's custom role
    await prisma.organizationMember.update({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
      data: { customRoleId: roleId },
    });

    // Log audit event
    await this.auditService.log({
      action: "ROLE_ASSIGNED",
      userId,
      organizationId,
      resourceId: roleId,
      resourceType: "role",
      details: {
        targetUserId,
        roleName: role.name,
      },
    });

    logger.info({ roleId, targetUserId, organizationId, userId }, "Custom role assigned to member");
  }

  /**
   * Remove custom role from a member (revert to default)
   */
  async removeFromMember(
    userId: string,
    organizationId: string,
    targetUserId: string
  ): Promise<void> {
    // Check permission
    const permissions = await this.rbacService.getUserOrgPermissions(userId, organizationId);
    if (!permissions.canManageMembers) {
      throw new ForbiddenError("Only admins and owners can manage role assignments");
    }

    // Verify target user is a member
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
    });

    if (!membership) {
      throw new Error("User is not a member of this organization");
    }

    if (!membership.customRoleId) {
      throw new Error("User does not have a custom role assigned");
    }

    // Remove custom role
    await prisma.organizationMember.update({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
      data: { customRoleId: null },
    });

    // Log audit event
    await this.auditService.log({
      action: "ROLE_REMOVED",
      userId,
      organizationId,
      resourceId: membership.customRoleId,
      resourceType: "role",
      details: {
        targetUserId,
      },
    });

    logger.info({ targetUserId, organizationId, userId }, "Custom role removed from member");
  }

  /**
   * Get available permissions list
   */
  getAvailablePermissions(): string[] {
    return [...AVAILABLE_PERMISSIONS];
  }

  /**
   * Check if a permission is valid
   */
  isValidPermission(permission: string): boolean {
    return AVAILABLE_PERMISSIONS.includes(permission);
  }
}
