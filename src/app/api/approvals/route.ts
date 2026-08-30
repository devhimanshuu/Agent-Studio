import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { respondApprovalSchema } from "@/validators/approvalSchema";
import { unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/api/handlers";
import { rateLimit } from "@/lib/api/rateLimit";
import { apiServices } from "@/lib/api/services";
import { RBACService, ForbiddenError } from "@/services/RBACService";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const { approvalRepo, approvalEngine, approvalHistoryService } = apiServices();
const rbacService = new RBACService();

/**
 * GET /api/approvals — List approval requests
 * Supports optional organization context via X-Organization-Id header
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    // Get organization context if provided
    const organizationId = request.headers.get("X-Organization-Id") || undefined;

    if (organizationId) {
      // Verify membership
      const membership = await rbacService.getOrgMembership(userId, organizationId);
      if (!membership) return forbidden();

      const permissions = await rbacService.getUserOrgPermissions(userId, organizationId);
      
      // Only admins/owners can see all org approvals
      if (!permissions.canManageMembers) {
        return forbidden();
      }

      // Get approvals for organization's executions
      const requests = await prisma.approvalRequest.findMany({
        where: {
          execution: { organizationId },
        },
        orderBy: { requestedAt: "desc" },
      });

      const requestsWithHistory = await Promise.all(
        requests.map(async (r) => ({
          ...r,
          history: await approvalHistoryService.getTimeline(r.id),
        }))
      );

      return NextResponse.json({ success: true, data: requestsWithHistory });
    }

    // Personal approvals
    await approvalRepo.expireStaleForUser(userId).catch(() => 0);
    const requests = await approvalRepo.findByUserId(userId);

    const requestsWithHistory = await Promise.all(
      requests.map(async (r) => ({
        ...r,
        history: await approvalHistoryService.getTimeline(r.id),
      }))
    );

    return NextResponse.json({ success: true, data: requestsWithHistory });
  } catch (error) {
    logger.error({ error }, "Failed to list approvals");
    return serverError(error);
  }
}

/**
 * POST /api/approvals — Respond to approval request
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const limited = rateLimit(`approval:respond:${userId}`);
  if (limited) return limited;

  try {
    const body = await request.json();
    const validated = respondApprovalSchema.parse({ ...body, userId });

    // Check if approval belongs to user or user is org admin
    const approval = await prisma.approvalRequest.findUnique({
      where: { id: validated.approvalId },
      include: { execution: { select: { organizationId: true } } },
    });

    if (!approval) return notFound("Approval request not found");

    // Check ownership or admin permission
    if (approval.userId !== userId) {
      const organizationId = approval.execution?.organizationId;
      if (organizationId) {
        const membership = await rbacService.getOrgMembership(userId, organizationId);
        if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
          return forbidden();
        }
      } else {
        return forbidden();
      }
    }

    if (validated.approved) {
      const result = await approvalEngine.approve(
        validated.approvalId,
        userId,
        validated.idempotencyKey
      );
      return NextResponse.json({ success: true, data: result });
    } else {
      const result = await approvalEngine.reject(
        validated.approvalId,
        userId,
        validated.rejectionReason ?? "Action rejected by reviewer",
        validated.idempotencyKey
      );
      return NextResponse.json({ success: true, data: result });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("access")) return forbidden();
    if (message.includes("not found")) return notFound(message);
    if (error instanceof z.ZodError) return badRequest(error);
    if (error instanceof Error && "issues" in error) {
      return badRequest(error);
    }
    if (error instanceof Error) {
      return badRequest(new Error(error.message));
    }
    if (error instanceof ForbiddenError) return forbidden();
    logger.error({ error }, "Failed to respond to approval");
    return serverError(error);
  }
}
