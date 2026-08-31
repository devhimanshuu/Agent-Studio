/**
 * RBAC Middleware for API Routes
 *
 * Provides middleware functions for:
 * - Extracting organization context from requests
 * - Enforcing organization-level roles
 * - Enforcing skill-level permissions
 */

import { auth } from "@clerk/nextjs/server";
import { RBACService, ForbiddenError, OrgRole, SkillPermission, OrgPermissionSet, SkillPermissionSet } from "@/services/RBACService";
import { unauthorized, forbidden, badRequest } from "@/lib/api/handlers";
import { prisma } from "@/lib/prisma";

// ────────────── Types ──────────────

export interface OrganizationContext {
  userId: string;
  organizationId: string;
  role: OrgRole;
  permissions: OrgPermissionSet;
}

export interface SkillContext {
  userId: string;
  skillId: string;
  permissions: SkillPermissionSet;
  organizationId?: string;
}

export type RouteHandler = (
  request: Request,
  context?: Record<string, unknown>
) => Promise<Response>;

// ────────────── Organization Context Extraction ──────────────

/**
 * Extract organization ID from request
 * Priority: X-Organization-Id header > query param > default
 */
function extractOrganizationId(request: Request): string | null {
  // Check header first
  const headerOrgId = request.headers.get("X-Organization-Id");
  if (headerOrgId) return headerOrgId;

  // Check query parameter
  const url = new URL(request.url);
  const queryOrgId = url.searchParams.get("organizationId");
  if (queryOrgId) return queryOrgId;

  return null;
}

/**
 * Get default organization for user
 */
async function getDefaultOrganization(userId: string): Promise<string | null> {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" }, // First joined org
  });

  return membership?.organizationId || null;
}

// ────────────── Middleware Functions ──────────────

/**
 * Require authenticated user
 */
export function requireAuth(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: Record<string, unknown> = {}) => {
    const { userId } = await auth();
    if (!userId) {
      return unauthorized();
    }

    return handler(request, { ...context, userId });
  };
}

/**
 * Require organization context
 * Extracts organizationId from request and validates membership
 */
export function requireOrganization(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: Record<string, unknown> = {}) => {
    const { userId } = await auth();
    if (!userId) {
      return unauthorized();
    }

    const rbacService = new RBACService();

    // Extract organization ID
    let organizationId = extractOrganizationId(request);
    
    // If not provided, try to get default
    if (!organizationId) {
      organizationId = await getDefaultOrganization(userId);
    }

    if (!organizationId) {
      return badRequest(new Error("Organization ID required. Provide via X-Organization-Id header or organizationId query parameter."));
    }

    // Validate membership
    const permissions = await rbacService.getUserOrgPermissions(userId, organizationId);
    const membership = await rbacService.getOrgMembership(userId, organizationId);
    
    if (!membership) {
      return forbidden();
    }

    return handler(request, {
      ...context,
      userId,
      organizationId,
      role: membership.role,
      permissions,
    });
  };
}

/**
 * Require specific organization role
 */
export function requireOrgRole(
  role: OrgRole,
  handler: RouteHandler
): RouteHandler {
  return requireOrganization(async (request: Request, context: Record<string, unknown> = {}) => {
    const rbacService = new RBACService();
    const { userId, organizationId } = context as { userId: string; organizationId: string };

    try {
      await rbacService.requireOrgRole(userId, organizationId, role);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return forbidden();
      }
      throw error;
    }

    return handler(request, context);
  });
}

/**
 * Require skill permission
 */
export function requireSkillPermission(
  permission: SkillPermission,
  handler: RouteHandler
): RouteHandler {
  return requireAuth(async (request: Request, context: Record<string, unknown> = {}) => {
    const rbacService = new RBACService();
    const { userId } = context as { userId: string };

    // Extract skill ID from URL or body
    const url = new URL(request.url);
    const skillIdMatch = url.pathname.match(/\/skills\/([^/]+)/);
    const skillId = skillIdMatch?.[1];

    if (!skillId) {
      return badRequest(new Error("Skill ID required in URL path"));
    }

    try {
      const skillPermissions = await rbacService.requireSkillPermission(
        userId,
        skillId,
        permission
      );

      // Get organization context if skill belongs to an org
      const skill = await prisma.skill.findUnique({
        where: { id: skillId },
        select: { organizationId: true },
      });

      return handler(request, {
        ...context,
        skillId,
        skillPermissions,
        organizationId: skill?.organizationId,
      });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return forbidden();
      }
      throw error;
    }
  });
}

/**
 * Optional organization context
 * If organizationId is provided, validate membership; otherwise proceed without
 */
export function optionalOrganization(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: Record<string, unknown> = {}) => {
    const { userId } = await auth();
    if (!userId) {
      return unauthorized();
    }

    const rbacService = new RBACService();
    const organizationId = extractOrganizationId(request);

    if (organizationId) {
      const membership = await rbacService.getOrgMembership(userId, organizationId);
      if (!membership) {
        return forbidden();
      }

      const permissions = await rbacService.getUserOrgPermissions(userId, organizationId);

      return handler(request, {
        ...context,
        userId,
        organizationId,
        role: membership.role,
        permissions,
      });
    }

    return handler(request, { ...context, userId });
  };
}

/**
 * Check if user has permission (non-throwing)
 */
export async function checkPermission(
  userId: string,
  organizationId: string | undefined,
  resourceType: "skill" | "execution" | "mcp_server" | "vault_entry",
  resourceId: string,
  action: "read" | "write" | "delete" | "execute"
): Promise<boolean> {
  const rbacService = new RBACService();

  if (!organizationId) {
    // No organization context - only owner has access
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
      default:
        return false;
    }
  }

  return rbacService.canAccessResource(
    userId,
    organizationId,
    resourceType,
    resourceId,
    action
  );
}
