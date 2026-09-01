import { NextResponse } from "next/server";
import { createSkillSchema, skillListQuerySchema } from "@/validators/skillSchema";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, forbidden, badRequest, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";
import { rateLimit } from "@/lib/api/rate-limit";
import { parseJsonBody } from "@/lib/api/bodyLimit";

const { skillService, rbacService, skillRepo } = apiServices();

/**
 * GET /api/skills — List skills
 * Supports optional organization context via X-Organization-Id header
 */
export async function GET(request: Request) {
  const rl = await rateLimit(request);
  if (rl) return rl;

  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const parsed = skillListQuerySchema.safeParse({
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortOrder: searchParams.get("sortOrder") ?? undefined,
    });
    if (!parsed.success) return badRequest(parsed.error);

    // Get organization context if provided
    const organizationId = request.headers.get("X-Organization-Id") || searchParams.get("organizationId") || undefined;

    let result;
    if (organizationId) {
      // Verify membership
      const membership = await rbacService.getOrgMembership(userId, organizationId);
      if (!membership) return forbidden();

      // Use repository method instead of inline Prisma queries
      result = await skillRepo.listForOrganization(organizationId, parsed.data);
    } else {
      // List user's personal skills
      result = await skillService.listSkills(userId, parsed.data);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/skills — Create skill
 * Supports optional organization context via X-Organization-Id header
 */
export async function POST(request: Request) {
  const rl = await rateLimit(request);
  if (rl) return rl;

  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { data: body, error: bodyError } = await parseJsonBody<Record<string, unknown>>(request);
    if (bodyError) return bodyError;
    
    // Get organization context if provided
    const organizationId = request.headers.get("X-Organization-Id") || (typeof body.organizationId === 'string' ? body.organizationId : undefined) || undefined;

    // Check permission if organization context
    if (organizationId) {
      const membership = await rbacService.getOrgMembership(userId, organizationId);
      if (!membership) return forbidden();

      const canCreate = await rbacService.hasPermission(userId, organizationId, "skills:create");
      if (!canCreate) {
        return forbidden();
      }
    }

    const validated = createSkillSchema.parse({ ...body, userId });
    
    // Add organizationId if provided
    const skillData = organizationId
      ? { ...validated, organizationId }
      : validated;

    const skill = await skillService.createSkill(skillData);
    return NextResponse.json({ success: true, data: skill }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
