/**
 * Organization Role API Routes
 *
 * GET    /api/organizations/[id]/roles/[roleId] - Get role details
 * PUT    /api/organizations/[id]/roles/[roleId] - Update role
 * DELETE /api/organizations/[id]/roles/[roleId] - Delete role
 */

import { auth } from "@clerk/nextjs/server";
import { CustomRoleService } from "@/services/CustomRoleService";
import { unauthorized, forbidden, badRequest, serverError } from "@/lib/api/handlers";
import { logger } from "@/lib/logger";
import { z } from "zod";

const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
});

const customRoleService = new CustomRoleService();

/**
 * GET /api/organizations/[id]/roles/[roleId]
 * Get a custom role by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id: organizationId, roleId } = await params;
    const role = await customRoleService.getById(userId, organizationId, roleId);

    if (!role) {
      return badRequest(new Error("Role not found"));
    }

    return new Response(JSON.stringify({ success: true, data: role }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Not a member")) {
      return forbidden();
    }
    logger.error({ error }, "Failed to get role");
    return serverError(error);
  }
}

/**
 * PUT /api/organizations/[id]/roles/[roleId]
 * Update a custom role
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id: organizationId, roleId } = await params;
    const body = await request.json();
    const validatedData = updateRoleSchema.parse(body);

    const role = await customRoleService.update(userId, organizationId, roleId, validatedData);

    return new Response(JSON.stringify({ success: true, data: role }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest(new Error(error.errors.map((e) => e.message).join(", ")));
    }
    if (error instanceof Error && error.message.includes("built-in")) {
      return forbidden();
    }
    if (error instanceof Error && error.message.includes("Only admins")) {
      return forbidden();
    }
    logger.error({ error }, "Failed to update role");
    return serverError(error);
  }
}

/**
 * DELETE /api/organizations/[id]/roles/[roleId]
 * Delete a custom role
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id: organizationId, roleId } = await params;

    await customRoleService.delete(userId, organizationId, roleId);

    return new Response(JSON.stringify({ success: true, data: { deleted: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("built-in")) {
      return forbidden();
    }
    if (error instanceof Error && error.message.includes("Only admins")) {
      return forbidden();
    }
    logger.error({ error }, "Failed to delete role");
    return serverError(error);
  }
}
