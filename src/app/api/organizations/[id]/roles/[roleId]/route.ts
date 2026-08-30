import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handlers";
import { forbidden, success, badRequest, notFound } from "@/lib/api/responses";
import { CustomRoleService } from "@/services/CustomRoleService";
import { z } from "zod";

const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
  baseRole: z.enum(["MEMBER", "VIEWER"]).optional(),
  isDefault: z.boolean().optional(),
});

const customRoleService = new CustomRoleService();

/**
 * GET /api/organizations/[id]/roles/[roleId]
 * Get a custom role by ID
 */
export const GET = withAuth(async (request, context) => {
  try {
    const urlParts = request.url.split("/");
    const orgIndex = urlParts.indexOf("organizations") + 1;
    const organizationId = urlParts[orgIndex];
    const rolesIndex = urlParts.indexOf("roles");
    const roleId = urlParts[rolesIndex + 1];

    if (!organizationId || !roleId) {
      return badRequest(new Error("Organization ID and Role ID required"));
    }

    // Check if user is member
    const isMember = await customRoleService["prisma"].organizationMember.findFirst({
      where: { userId: context.userId!, organizationId },
    });

    if (!isMember) {
      return forbidden(new Error("Not a member of this organization"));
    }

    const role = await customRoleService.getRoleById(roleId);

    if (!role || role.organizationId !== organizationId) {
      return notFound(new Error("Role not found"));
    }

    return success(role);
  } catch (error) {
    return badRequest(error instanceof Error ? error : new Error("Failed to get role"));
  }
});

/**
 * PUT /api/organizations/[id]/roles/[roleId]
 * Update a custom role
 */
export const PUT = withAuth(async (request, context) => {
  try {
    const urlParts = request.url.split("/");
    const orgIndex = urlParts.indexOf("organizations") + 1;
    const organizationId = urlParts[orgIndex];
    const rolesIndex = urlParts.indexOf("roles");
    const roleId = urlParts[rolesIndex + 1];

    if (!organizationId || !roleId) {
      return badRequest(new Error("Organization ID and Role ID required"));
    }

    // Check if user is admin
    const membership = await customRoleService["prisma"].organizationMember.findFirst({
      where: { userId: context.userId!, organizationId },
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      return forbidden(new Error("Only owners and admins can update roles"));
    }

    const body = await request.json();
    const validatedData = updateRoleSchema.parse(body);

    const role = await customRoleService.updateRole(roleId, validatedData);

    if (!role) {
      return notFound(new Error("Role not found"));
    }

    return success(role);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest(new Error(error.errors.map((e) => e.message).join(", ")));
    }
    if (error instanceof Error && error.message.includes("built-in")) {
      return forbidden(error);
    }
    return badRequest(error instanceof Error ? error : new Error("Failed to update role"));
  }
});

/**
 * DELETE /api/organizations/[id]/roles/[roleId]
 * Delete a custom role
 */
export const DELETE = withAuth(async (request, context) => {
  try {
    const urlParts = request.url.split("/");
    const orgIndex = urlParts.indexOf("organizations") + 1;
    const organizationId = urlParts[orgIndex];
    const rolesIndex = urlParts.indexOf("roles");
    const roleId = urlParts[rolesIndex + 1];

    if (!organizationId || !roleId) {
      return badRequest(new Error("Organization ID and Role ID required"));
    }

    // Check if user is admin
    const membership = await customRoleService["prisma"].organizationMember.findFirst({
      where: { userId: context.userId!, organizationId },
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      return forbidden(new Error("Only owners and admins can delete roles"));
    }

    await customRoleService.deleteRole(roleId);

    return success({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("built-in")) {
      return forbidden(error);
    }
    return badRequest(error instanceof Error ? error : new Error("Failed to delete role"));
  }
});
