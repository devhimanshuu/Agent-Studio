/**
 * Organization Roles API Routes
 *
 * GET  /api/organizations/[id]/roles      - List custom roles
 * POST /api/organizations/[id]/roles      - Create custom role
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).min(1),
});

const { customRoleService } = apiServices();

/**
 * GET /api/organizations/[id]/roles
 * List all custom roles for an organization
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id: organizationId } = await params;
    const roles = await customRoleService.list(userId, organizationId);
    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/organizations/[id]/roles
 * Create a new custom role
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id: organizationId } = await params;
    const body = await request.json();
    const validatedData = createRoleSchema.parse(body);

    const role = await customRoleService.create(userId, organizationId, validatedData);

    return NextResponse.json({ success: true, data: role }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
