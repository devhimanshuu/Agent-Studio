/**
 * Role-Based Access Control (RBAC) Service
 *
 * Provides fine-grained permission checking for:
 * - Organization-level roles (Owner, Admin, Member, Viewer)
 * - Skill-level permissions (Admin, Editor, Executor, Viewer)
 * - Resource access control
 */

import { prisma } from "@/lib/prisma";

// ────────────── Types ──────────────

export type OrgRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

// Custom role prefix to distinguish from built-in roles
export const CUSTOM_ROLE_PREFIX = "custom:";

export type SkillPermission = 
  | "SKILL_ADMIN" 
  | "SKILL_EDITOR" 
  | "SKILL_EXECUTOR" 
  | "SKILL_VIEWER";

export interface OrgPermissionSet {
  role: OrgRole;
  isOwner: boolean;
  isAdmin: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
  canDeleteOrg: boolean;
  canCreateSkill: boolean;
  canExecuteSkill: boolean;
  canViewAuditLog: boolean;
}

export interface SkillPermissionSet {
  permissions: SkillPermission[];
  isAdmin: boolean;
  isEditor: boolean;
  isExecutor: boolean;
  isViewer: boolean;
  canEdit: boolean;
  canExecute: boolean;
  canDelete: boolean;
}

export interface OrganizationContext {
  organizationId: string;
  role: OrgRole;
  permissions: OrgPermissionSet;
}

// ────────────── Role Hierarchy ──────────────

const ORG_ROLE_HIERARCHY: Record<OrgRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

const SKILL_PERMISSION_HIERARCHY: Record<SkillPermission, number> = {
  SKILL_ADMIN: 4,
  SKILL_EDITOR: 3,
  SKILL_EXECUTOR: 2,
  SKILL_VIEWER: 1,
};

// ────────────── Base Role → Permission Mapping ──────────────

/**
 * Maps each built-in org role to the set of granular permission strings it implies.
 * Uses the same vocabulary as AVAILABLE_PERMISSIONS in CustomRoleService.
 * OWNER gets wildcard "*" (all permissions).
 */
const BASE_ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: ["*"],
  ADMIN: [
    "org:manage",
    "members:manage", "members:read",
    "skills:create", "skills:read", "skills:edit", "skills:delete", "skills:execute", "skills:publish",
    "executions:create", "executions:read", "executions:cancel",
    "mcp:manage", "mcp:read", "mcp:create", "mcp:delete",
    "vault:manage", "vault:create", "vault:read", "vault:delete",
    "audit:view", "audit:read",
    "api_keys:manage", "api_keys:read",
    "roles:manage", "roles:read",
  ],
  MEMBER: [
    "members:read",
    "skills:create", "skills:read", "skills:edit:own", "skills:delete:own", "skills:execute",
    "executions:create", "executions:read:own", "executions:cancel:own",
    "mcp:read", "mcp:create",
    "vault:create", "vault:read:own", "vault:delete:own",
    "roles:read",
  ],
  VIEWER: [
    "members:read",
    "skills:read",
    "executions:read",
    "mcp:read",
    "roles:read",
  ],
};

// ────────────── Permission Sets ──────────────

function buildOrgPermissionSet(role: OrgRole): OrgPermissionSet {
  return {
    role,
    isOwner: role === "OWNER",
    isAdmin: role === "OWNER" || role === "ADMIN",
    canManageMembers: role === "OWNER" || role === "ADMIN",
    canManageSettings: role === "OWNER" || role === "ADMIN",
    canDeleteOrg: role === "OWNER",
    canCreateSkill: role !== "VIEWER",
    canExecuteSkill: role !== "VIEWER",
    canViewAuditLog: role === "OWNER" || role === "ADMIN",
  };
}

function buildSkillPermissionSet(permissions: SkillPermission[]): SkillPermissionSet {
  const highestPermission = permissions.reduce(
    (highest, perm) => 
      SKILL_PERMISSION_HIERARCHY[perm] > SKILL_PERMISSION_HIERARCHY[highest] 
        ? perm 
        : highest,
    permissions[0] || "SKILL_VIEWER"
  );

  return {
    permissions,
    isAdmin: permissions.includes("SKILL_ADMIN"),
    isEditor: permissions.includes("SKILL_EDITOR") || permissions.includes("SKILL_ADMIN"),
    isExecutor: permissions.includes("SKILL_EXECUTOR") || permissions.includes("SKILL_EDITOR") || permissions.includes("SKILL_ADMIN"),
    isViewer: permissions.includes("SKILL_VIEWER") || permissions.length > 0,
    canEdit: highestPermission === "SKILL_ADMIN" || highestPermission === "SKILL_EDITOR",
    canExecute: highestPermission !== "SKILL_VIEWER",
    canDelete: highestPermission === "SKILL_ADMIN",
  };
}

/**
 * Overlay custom role permissions onto base OrgPermissionSet (additive).
 * Custom permissions can grant additional capabilities but never revoke base role ones.
 */
function overlayCustomPermissions(
  base: OrgPermissionSet,
  customPerms: string[]
): OrgPermissionSet {
  if (customPerms.length === 0) return base;

  return {
    ...base,
    canManageMembers: base.canManageMembers || customPerms.includes("members:manage"),
    canManageSettings: base.canManageSettings || customPerms.includes("org:manage"),
    // canDeleteOrg stays from base only — too dangerous for custom roles
    canCreateSkill: base.canCreateSkill || customPerms.includes("skills:create"),
    canExecuteSkill:
      base.canExecuteSkill ||
      customPerms.includes("skills:execute") ||
      customPerms.includes("executions:create"),
    canViewAuditLog:
      base.canViewAuditLog ||
      customPerms.includes("audit:view") ||
      customPerms.includes("audit:read"),
  };
}

// ────────────── Error Classes ──────────────

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// ────────────── Service ──────────────

export class RBACService {
  // ── Per-request caches (avoid redundant DB round-trips within a single request) ──
  private superAdminCache = new Map<string, boolean>();
  private membershipCache = new Map<string, { role: OrgRole; permissions: string[]; customRoleId: string | null } | null>();
  private effectivePermsCache = new Map<string, { role: OrgRole; permissions: string[] }>();

  /** Clear all per-request caches. Call at the end of each API request if needed. */
  clearCaches(): void {
    this.superAdminCache.clear();
    this.membershipCache.clear();
    this.effectivePermsCache.clear();
  }

  /**
   * Get custom role permissions for an organization
   */
  private async getCustomRolePermissions(
    organizationId: string,
    roleId: string
  ): Promise<string[]> {
    const customRole = await prisma.customRole.findUnique({
      where: { id: roleId },
    });

    if (!customRole || customRole.organizationId !== organizationId) {
      return [];
    }

    return (customRole.permissions as string[]) || [];
  }

  /**
   * Get effective permissions for a user (base role + custom role permissions).
   * Cached per (userId, organizationId) to avoid redundant lookups within a request.
   */
  private async getEffectivePermissions(
    userId: string,
    organizationId: string
  ): Promise<{ role: OrgRole; permissions: string[] }> {
    const cacheKey = `${userId}:${organizationId}`;
    const cached = this.effectivePermsCache.get(cacheKey);
    if (cached) return cached;

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    if (!membership) return { role: "VIEWER", permissions: [] };

    const baseRole = membership.role as OrgRole;
    let customPermissions: string[] = [];

    // If user has a custom role assigned, fetch its permissions
    if (membership.customRoleId) {
      customPermissions = await this.getCustomRolePermissions(
        organizationId,
        membership.customRoleId
      );
    }

    const result = {
      role: baseRole,
      permissions: [
        ...(membership.permissions as string[] || []),
        ...customPermissions,
      ],
    };

    this.effectivePermsCache.set(cacheKey, result);
    return result;
  }

  private async isSuperAdmin(userId: string): Promise<boolean> {
    if (!userId) return false;
    const cached = this.superAdminCache.get(userId);
    if (cached !== undefined) return cached;
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      const isAdmin = user?.role === "ADMIN";
      this.superAdminCache.set(userId, isAdmin);
      return isAdmin;
    } catch {
      this.superAdminCache.set(userId, false);
      return false;
    }
  }

  /**
   * Check if user has a specific permission (supports both built-in and custom)
   */
  async hasPermission(
    userId: string,
    organizationId: string,
    permission: string
  ): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) return true;
    const { role, permissions } = await this.getEffectivePermissions(userId, organizationId);

    // 1. Check base role implied permissions via unified mapping
    const rolePerms = BASE_ROLE_PERMISSIONS[role] || [];
    if (rolePerms.includes("*") || rolePerms.includes(permission)) return true;

    // 2. Support :own inheritance (e.g., skills:edit implies skills:edit:own)
    const ownVariant = `${permission}:own`;
    if (permission !== ownVariant && rolePerms.includes(permission.replace(/:own$/, ""))) return true;

    // 3. Check custom role permissions
    if (permissions.includes(permission)) return true;

    // 4. Legacy org:* namespace backward compatibility
    const orgPerms = buildOrgPermissionSet(role);
    if (this.checkOrgPermission(orgPerms, permission)) return true;

    return false;
  }

  /**
   * Check organization permission set against a permission string
   */
  private checkOrgPermission(perms: OrgPermissionSet, permission: string): boolean {
    switch (permission) {
      case "org:manage_members": return perms.canManageMembers;
      case "org:manage_settings": return perms.canManageSettings;
      case "org:delete": return perms.canDeleteOrg;
      case "org:create_skill": return perms.canCreateSkill;
      case "org:execute_skill": return perms.canExecuteSkill;
      case "org:view_audit": return perms.canViewAuditLog;
      case "org:admin": return perms.isAdmin;
      case "org:owner": return perms.isOwner;
      default: return false;
    }
  }

  /**
   * Get user's organization membership.
   * Cached per (userId, organizationId) to avoid redundant lookups.
   */
  async getOrgMembership(
    userId: string,
    organizationId: string
  ): Promise<{ role: OrgRole; permissions: SkillPermission[] } | null> {
    const cacheKey = `membership:${userId}:${organizationId}`;
    const cached = this.membershipCache.get(cacheKey);
    if (cached === null) return null;
    if (cached) {
      return { role: cached.role, permissions: cached.permissions as SkillPermission[] };
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    if (!membership) {
      this.membershipCache.set(cacheKey, null);
      return null;
    }

    const result = {
      role: membership.role as OrgRole,
      permissions: (membership.permissions as SkillPermission[]) || [],
    };

    this.membershipCache.set(cacheKey, { ...result, customRoleId: membership.customRoleId });
    return result;
  }

  /**
   * Check if user has organization-level role
   */
  async hasOrgRole(
    userId: string,
    organizationId: string,
    requiredRole: OrgRole
  ): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) return true;
    const membership = await this.getOrgMembership(userId, organizationId);
    if (!membership) return false;

    const userLevel = ORG_ROLE_HIERARCHY[membership.role] ?? 0;
    const requiredLevel = ORG_ROLE_HIERARCHY[requiredRole] ?? 0;

    return userLevel >= requiredLevel;
  }

  /**
   * Check if user has skill-level permission
   */
  async hasSkillPermission(
    userId: string,
    skillId: string,
    requiredPermission: SkillPermission
  ): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) return true;
    // First check if user is skill owner
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      select: { userId: true, organizationId: true },
    });

    if (!skill) return false;

    // Owner always has full permissions
    if (skill.userId === userId) return true;

    // If skill belongs to an organization, check org membership
    if (skill.organizationId) {
      const membership = await this.getOrgMembership(userId, skill.organizationId);
      if (!membership) return false;

      // Org admins and owners have full skill permissions
      if (membership.role === "OWNER" || membership.role === "ADMIN") {
        return true;
      }

      // Check specific skill permissions
      const userPermissions = membership.permissions;
      const userLevel = userPermissions.length > 0
        ? Math.max(...userPermissions.map(p => SKILL_PERMISSION_HIERARCHY[p]))
        : 0;
      const requiredLevel = SKILL_PERMISSION_HIERARCHY[requiredPermission];

      return userLevel >= requiredLevel;
    }

    // No organization - only owner has access
    return false;
  }

  /**
   * Get all permissions for a user in an organization
   */
  async getUserOrgPermissions(
    userId: string,
    organizationId: string
  ): Promise<OrgPermissionSet> {
    const { role, permissions: customPerms } = await this.getEffectivePermissions(
      userId,
      organizationId
    );

    const basePerms = buildOrgPermissionSet(role);

    // Overlay custom role permissions (additive — custom roles can grant,
    // never revoke, capabilities beyond the base role)
    return overlayCustomPermissions(basePerms, customPerms);
  }

  /**
   * Get all permissions for a user on a specific skill
   */
  async getUserSkillPermissions(
    userId: string,
    skillId: string
  ): Promise<SkillPermissionSet> {
    if (await this.isSuperAdmin(userId)) {
      return buildSkillPermissionSet([
        "SKILL_ADMIN",
        "SKILL_EDITOR",
        "SKILL_EXECUTOR",
        "SKILL_VIEWER",
      ]);
    }

    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      select: { userId: true, organizationId: true },
    });

    if (!skill) {
      return buildSkillPermissionSet([]);
    }

    // Owner gets all permissions
    if (skill.userId === userId) {
      return buildSkillPermissionSet([
        "SKILL_ADMIN",
        "SKILL_EDITOR",
        "SKILL_EXECUTOR",
        "SKILL_VIEWER",
      ]);
    }

    // Check organization permissions
    if (skill.organizationId) {
      const membership = await this.getOrgMembership(userId, skill.organizationId);
      if (!membership) {
        return buildSkillPermissionSet([]);
      }

      // Org admins/owners get full permissions
      if (membership.role === "OWNER" || membership.role === "ADMIN") {
        return buildSkillPermissionSet([
          "SKILL_ADMIN",
          "SKILL_EDITOR",
          "SKILL_EXECUTOR",
          "SKILL_VIEWER",
        ]);
      }

      return buildSkillPermissionSet(membership.permissions as SkillPermission[]);
    }

    return buildSkillPermissionSet([]);
  }

  /**
   * Enforce organization role or throw ForbiddenError
   */
  async requireOrgRole(
    userId: string,
    organizationId: string,
    requiredRole: OrgRole
  ): Promise<OrgPermissionSet> {
    if (await this.isSuperAdmin(userId)) {
      return buildOrgPermissionSet("OWNER");
    }

    const membership = await this.getOrgMembership(userId, organizationId);
    if (!membership) {
      throw new ForbiddenError("Not a member of this organization");
    }

    const userLevel = ORG_ROLE_HIERARCHY[membership.role] ?? 0;
    const requiredLevel = ORG_ROLE_HIERARCHY[requiredRole] ?? 0;

    if (userLevel < requiredLevel) {
      throw new ForbiddenError(
        `Requires ${requiredRole} role in organization (current: ${membership.role})`
      );
    }

    return buildOrgPermissionSet(membership.role);
  }

  /**
   * Enforce skill permission or throw ForbiddenError
   */
  async requireSkillPermission(
    userId: string,
    skillId: string,
    permission: SkillPermission
  ): Promise<SkillPermissionSet> {
    if (await this.isSuperAdmin(userId)) {
      return buildSkillPermissionSet([
        "SKILL_ADMIN",
        "SKILL_EDITOR",
        "SKILL_EXECUTOR",
        "SKILL_VIEWER",
      ]);
    }

    const permissions = await this.getUserSkillPermissions(userId, skillId);
    
    const hasPermission = this.checkSkillPermission(permissions, permission);
    if (!hasPermission) {
      throw new ForbiddenError(
        `Requires ${permission} permission on skill`
      );
    }

    return permissions;
  }

  /**
   * Check if permission set includes required permission
   */
  private checkSkillPermission(
    permissions: SkillPermissionSet,
    required: SkillPermission
  ): boolean {
    switch (required) {
      case "SKILL_ADMIN":
        return permissions.isAdmin;
      case "SKILL_EDITOR":
        return permissions.isEditor;
      case "SKILL_EXECUTOR":
        return permissions.isExecutor;
      case "SKILL_VIEWER":
        return permissions.isViewer;
      default:
        return false;
    }
  }

  /**
   * Get organization context from request
   */
  async getOrganizationContext(
    userId: string,
    organizationId?: string
  ): Promise<OrganizationContext | null> {
    if (!organizationId) return null;

    const membership = await this.getOrgMembership(userId, organizationId);
    if (!membership) {
      if (await this.isSuperAdmin(userId)) {
        return {
          organizationId,
          role: "OWNER",
          permissions: buildOrgPermissionSet("OWNER"),
        };
      }
      return null;
    }

    return {
      organizationId,
      role: membership.role,
      permissions: buildOrgPermissionSet(membership.role),
    };
  }

  /**
   * List user's organization memberships
   */
  async listUserOrganizations(userId: string) {
    return prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
      },
    });
  }

  /**
   * Check if user can access resource in organization
   */
  async canAccessResource(
    userId: string,
    organizationId: string,
    resourceType: "skill" | "execution" | "mcp_server" | "vault_entry",
    resourceId: string,
    action: "read" | "write" | "delete" | "execute"
  ): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) return true;
    // Handle personal resources (no organization context)
    if (!organizationId) {
      return this.isResourceOwner(userId, resourceType, resourceId);
    }

    const membership = await this.getOrgMembership(userId, organizationId);
    if (!membership) return false;

    // Owners and admins have full access
    if (membership.role === "OWNER" || membership.role === "ADMIN") {
      return true;
    }

    // Viewers can read all org resources but cannot write/delete/execute
    if (membership.role === "VIEWER") {
      return action === "read";
    }

    // Members can read and write their own resources
    if (membership.role === "MEMBER") {
      // Check resource ownership
      const isOwner = await this.isResourceOwner(userId, resourceType, resourceId);
      if (action === "delete") return isOwner;
      if (action === "write") return isOwner;
      return true; // Can read all org resources
    }

    return false;
  }

  /**
   * Check if user owns a specific resource
   */
  private async isResourceOwner(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    switch (resourceType) {
      case "skill": {
        const skill = await prisma.skill.findUnique({
          where: { id: resourceId },
          select: { userId: true },
        });
        return skill?.userId === userId;
      }
      case "execution": {
        const execution = await prisma.execution.findUnique({
          where: { id: resourceId },
          select: { userId: true },
        });
        return execution?.userId === userId;
      }
      case "mcp_server": {
        const server = await prisma.mcpServer.findUnique({
          where: { id: resourceId },
          select: { userId: true },
        });
        return server?.userId === userId;
      }
      case "vault_entry": {
        const entry = await prisma.vaultEntry.findUnique({
          where: { id: resourceId },
          select: { userId: true },
        });
        return entry?.userId === userId;
      }
      default:
        return false;
    }
  }
}
