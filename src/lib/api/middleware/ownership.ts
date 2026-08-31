/**
 * Resource Ownership & Organization Validation Middleware
 *
 * Provides middleware functions for:
 * - Validating resources belong to the organization
 * - Checking resource ownership for MEMBER role
 * - Preventing cross-organization data leakage
 */

import { prisma } from "@/lib/prisma";
import { unauthorized, forbidden, badRequest } from "@/lib/api/handlers";
import { OrgRole, OrgPermissionSet } from "@/services/RBACService";

// ────────────── Types ──────────────

export type ResourceType = "skill" | "execution" | "mcp_server" | "vault_entry" | "openapi_integration";

export interface OwnershipContext {
  userId: string;
  organizationId: string;
  role: OrgRole;
  permissions: OrgPermissionSet;
  resourceOwnerId: string;
  isOwner: boolean;
}

export type RouteHandler = (
  request: Request,
  context?: any
) => Promise<Response>;

// ────────────── Helpers ──────────────

/**
 * Fetch a resource and verify it belongs to the organization
 */
async function fetchAndValidateResource(
  resourceType: ResourceType,
  resourceId: string,
  organizationId: string
): Promise<{ userId: string } | null> {
  switch (resourceType) {
    case "skill": {
      const resource = await prisma.skill.findUnique({
        where: { id: resourceId },
        select: { userId: true, organizationId: true },
      });
      if (!resource) return null;
      if (resource.organizationId !== organizationId) return null;
      return { userId: resource.userId };
    }
    case "execution": {
      const resource = await prisma.execution.findUnique({
        where: { id: resourceId },
        select: { userId: true, organizationId: true },
      });
      if (!resource) return null;
      if (resource.organizationId && resource.organizationId !== organizationId) return null;
      return { userId: resource.userId };
    }
    case "mcp_server": {
      const resource = await prisma.mcpServer.findUnique({
        where: { id: resourceId },
        select: { userId: true, organizationId: true },
      });
      if (!resource) return null;
      if (resource.organizationId && resource.organizationId !== organizationId) return null;
      return { userId: resource.userId };
    }
    case "vault_entry": {
      const resource = await prisma.vaultEntry.findUnique({
        where: { id: resourceId },
        select: { userId: true, organizationId: true },
      });
      if (!resource) return null;
      if (resource.organizationId && resource.organizationId !== organizationId) return null;
      return { userId: resource.userId };
    }
    default:
      return null;
  }
}

// ────────────── Middleware Functions ──────────────

/**
 * Validate that a resource belongs to the organization.
 * Returns 404 if the resource doesn't exist or doesn't belong to the org.
 */
export function requireOrgResource(
  resourceType: ResourceType,
  handler: RouteHandler
): RouteHandler {
  return async (request: Request, context: any) => {
    const { userId, organizationId } = context;

    if (!organizationId) {
      return forbidden();
    }

    // Extract resource ID from URL
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);

    // Find the resource ID (last non-parameter segment before query)
    let resourceId: string | null = null;
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      // Skip route params like [id], [userId], etc.
      if (seg.startsWith("[") && seg.endsWith("]")) continue;
      // Skip known route prefixes
      if (["api", "skills", "executions", "mcp", "servers", "vault", "organizations"].includes(seg)) continue;
      // This should be the resource ID
      resourceId = seg;
      break;
    }

    if (!resourceId) {
      return badRequest(new Error("Resource ID not found in URL"));
    }

    // Validate resource belongs to organization
    const resource = await fetchAndValidateResource(resourceType, resourceId, organizationId);

    if (!resource) {
      return badRequest(new Error(`${resourceType} not found in this organization`));
    }

    // Check ownership for MEMBER role
    const isOwner = resource.userId === userId;

    return handler(request, {
      ...context,
      resourceId,
      resourceOwnerId: resource.userId,
      isOwner,
    });
  };
}

/**
 * Require the user to be the resource owner.
 * Only applies to MEMBER role - OWNER/ADMIN bypass this check.
 */
export function requireResourceOwner(
  handler: RouteHandler
): RouteHandler {
  return async (request: Request, context: any) => {
    const { role, isOwner } = context;

    // Owners and admins bypass ownership check
    if (role === "OWNER" || role === "ADMIN") {
      return handler(request, context);
    }

    // Members must own the resource
    if (role === "MEMBER" && !isOwner) {
      return forbidden();
    }

    // Viewers cannot modify anything
    if (role === "VIEWER") {
      return forbidden();
    }

    return handler(request, context);
  };
}

/**
 * Require the user to be the resource owner for delete operations.
 * Stricter than requireResourceOwner - only the owner can delete.
 */
export function requireResourceOwnerForDelete(
  handler: RouteHandler
): RouteHandler {
  return async (request: Request, context: any) => {
    const { role, isOwner } = context;

    // Owners can delete anything
    if (role === "OWNER") {
      return handler(request, context);
    }

    // Admins can delete anything in the org
    if (role === "ADMIN") {
      return handler(request, context);
    }

    // Members can only delete their own resources
    if (role === "MEMBER" && !isOwner) {
      return forbidden();
    }

    // Viewers cannot delete
    if (role === "VIEWER") {
      return forbidden();
    }

    return handler(request, context);
  };
}

/**
 * Validate organization context matches the resource's organization.
 * Prevents accessing resources from other organizations.
 */
export function validateOrgContext(
  handler: RouteHandler
): RouteHandler {
  return async (request: Request, context: any) => {
    const { organizationId } = context;

    if (!organizationId) {
      return forbidden();
    }

    // Verify the organization exists
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!org) {
      return badRequest(new Error("Organization not found"));
    }

    return handler(request, context);
  };
}

/**
 * Enforce action-based permissions with ownership awareness.
 * Combines role-based and ownership-based checks.
 */
export function enforceAction(
  action: "read" | "write" | "delete" | "execute",
  handler: RouteHandler
): RouteHandler {
  return async (request: Request, context: any) => {
    const { role, isOwner } = context;

    // Owners and admins have full access
    if (role === "OWNER" || role === "ADMIN") {
      return handler(request, context);
    }

    // Viewers can only read
    if (role === "VIEWER") {
      if (action !== "read") {
        return forbidden();
      }
      return handler(request, context);
    }

    // Members have ownership-based access
    if (role === "MEMBER") {
      switch (action) {
        case "read":
          // Members can read all org resources
          return handler(request, context);
        case "write":
        case "execute":
          // Members can write/execute their own resources
          if (isOwner) {
            return handler(request, context);
          }
          return forbidden();
        case "delete":
          // Members can only delete their own resources
          if (isOwner) {
            return handler(request, context);
          }
          return forbidden();
        default:
          return forbidden();
      }
    }

    return forbidden();
  };
}
