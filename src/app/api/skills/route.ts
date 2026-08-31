import { NextResponse } from "next/server";
import { createSkillSchema, skillListQuerySchema } from "@/validators/skillSchema";
import { SkillService } from "@/services/SkillService";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, forbidden, badRequest, serverError } from "@/lib/api/handlers";
import { RBACService, ForbiddenError } from "@/services/RBACService";
import { PlanLimitsService } from "@/services/PlanLimitsService";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);
const rbacService = new RBACService();
const planLimitsService = new PlanLimitsService();

/**
 * GET /api/skills — List skills
 * Supports optional organization context via X-Organization-Id header
 */
export async function GET(request: Request) {
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

      // Build where clause for search
      const where: import("@prisma/client").Prisma.SkillWhereInput = { organizationId };
      if (parsed.data.search) {
        where.name = { contains: parsed.data.search, mode: "insensitive" };
      }
      if (parsed.data.status) {
        where.status = parsed.data.status;
      }

      // Build order clause
      const orderBy: import("@prisma/client").Prisma.SkillOrderByWithRelationInput = parsed.data.sortBy
        ? { [parsed.data.sortBy]: parsed.data.sortOrder || "desc" }
        : { createdAt: "desc" };

      // List skills for organization
      result = await prisma.skill.findMany({
        where,
        orderBy,
        include: { versions: { where: { status: "DRAFT" }, take: 1 } },
      });
    } else {
      // List user's personal skills
      result = await skillService.listSkills(userId, parsed.data);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, "Failed to list skills");
    return serverError(error);
  }
}

/**
 * POST /api/skills — Create skill
 * Supports optional organization context via X-Organization-Id header
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    
    // Get organization context if provided
    const organizationId = request.headers.get("X-Organization-Id") || body.organizationId || undefined;

    // Check permission if organization context
    if (organizationId) {
      const membership = await rbacService.getOrgMembership(userId, organizationId);
      if (!membership) return forbidden();

      const canCreate = await rbacService.hasPermission(userId, organizationId, "skills:create");
      if (!canCreate) {
        return forbidden();
      }
    }

    // Enforce plan limits if organization context
    if (organizationId) {
      await planLimitsService.enforceLimit(organizationId, "skills");
    }

    const validated = createSkillSchema.parse({ ...body, userId });
    
    // Add organizationId if provided
    const skillData = organizationId
      ? { ...validated, organizationId }
      : validated;

    const skill = await skillService.createSkill(skillData);
    return NextResponse.json({ success: true, data: skill }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof Error && "issues" in error) {
      return badRequest(error); // Zod validation failure → 400
    }
    if (error instanceof ForbiddenError) {
      return forbidden();
    }
    logger.error({ error }, "Failed to create skill");
    return serverError(error); // service/DB failure → 500
  }
}
