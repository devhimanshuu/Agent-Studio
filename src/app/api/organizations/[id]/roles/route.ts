/**
 * Organization Roles API Routes
 *
 * GET  /api/organizations/[id]/roles      - List custom roles
 * POST /api/organizations/[id]/roles      - Create custom role
 */

import { auth } from "@clerk/nextjs/server";
import { CustomRoleService } from "@/services/CustomRoleService";
import { unauthorized, forbidden, badRequest, serverError } from "@/lib/api/handlers";
import { logger } from "@/lib/logger";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).min(1),
});

const customRoleService = new CustomRoleService();

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
    return new Response(JSON.stringify({ success: true, data: roles }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Not a member")) {
      return forbidden();
    }
    logger.error({ error }, "Failed to list roles");
    return serverError(error);
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

    return new Response(JSON.stringify({ success: true, data: role }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest(new Error(error.errors.map((e) => e.message).join(", ")));
    }
    if (error instanceof Error && error.message.includes("already exists")) {
      return badRequest(error);
    }
    if (error instanceof Error && error.message.includes("Only admins")) {
      return forbidden();
    }
    logger.error({ error }, "Failed to create role");
    return serverError(error);
  }
}
