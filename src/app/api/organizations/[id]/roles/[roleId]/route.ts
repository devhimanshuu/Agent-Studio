/**
 * Organization Role API Routes
 *
 * GET    /api/organizations/[id]/roles/[roleId] - Get role details
 * PUT    /api/organizations/[id]/roles/[roleId] - Update role
 * DELETE /api/organizations/[id]/roles/[roleId] - Delete role
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";
import { z } from "zod";

const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
});

const { customRoleService } = apiServices();

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

    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    return handleApiError(error);
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

    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    return handleApiError(error);
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

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
