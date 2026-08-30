import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handlers";
import { forbidden, success, badRequest, notFound } from "@/lib/api/responses";
import { CustomRoleService } from "@/services/CustomRoleService";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).min(1),
  baseRole: z.enum(["MEMBER", "VIEWER"]).optional(),
  isDefault: z.boolean().optional(),
});

const customRoleService = new CustomRoleService();

/**
 * GET /api/organizations/[id]/roles
 * List all custom roles for an organization
 */
export const GET = withAuth(async (request, context) => {
  try {
    const organizationId = request.url.split("/organizations/")[1]?.split("/")[0];

    if (!organizationId) {
      return badRequest(new Error("Organization ID required"));
    }

    // Check if user is member
    const isMember = await customRoleService["prisma"].organizationMember.findFirst({
      where: { userId: context.userId!, organizationId },
    });

    if (!isMember) {
      return forbidden(new Error("Not a member of this organization"));
    }

    const roles = await customRoleService.listRoles(organizationId);

    return success(roles);
  } catch (error) {
    return badRequest(error instanceof Error ? error : new Error("Failed to list roles"));
  }
});

/**
 * POST /api/organizations/[id]/roles
 * Create a new custom role
 */
export const POST = withAuth(async (request, context) => {
  try {
    const organizationId = request.url.split("/organizations/")[1]?.split("/")[0];

    if (!organizationId) {
      return badRequest(new Error("Organization ID required"));
    }

    const body = await request.json();
    const validatedData = createRoleSchema.parse(body);

    const role = await customRoleService.createRole({
      organizationId,
      ...validatedData,
      createdBy: context.userId!,
    });

    return success(role);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest(new Error(error.errors.map((e) => e.message).join(", ")));
    }
    if (error instanceof Error && error.message.includes("already exists")) {
      return badRequest(error);
    }
    return badRequest(error instanceof Error ? error : new Error("Failed to create role"));
  }
});
