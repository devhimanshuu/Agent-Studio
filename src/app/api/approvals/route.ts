import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { respondApprovalSchema } from "@/validators/approvalSchema";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/handlers";
import { rateLimit } from "@/lib/api/rateLimit";
import { apiServices } from "@/lib/api/services";
import { prisma } from "@/lib/prisma";

const { approvalRepo, approvalEngine, approvalHistoryService, rbacService } = apiServices();

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
      if (!membership) return handleApiError(new Error("access denied"));

      const permissions = await rbacService.getUserOrgPermissions(userId, organizationId);
      
      // Only admins/owners can see all org approvals
      if (!permissions.canManageMembers) {
        return handleApiError(new Error("access denied"));
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
    return handleApiError(error);
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

    if (!approval) throw new Error("Approval request not found");

    // Check ownership or admin permission
    if (approval.userId !== userId) {
      const organizationId = approval.execution?.organizationId;
      if (organizationId) {
        const membership = await rbacService.getOrgMembership(userId, organizationId);
        if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
          return handleApiError(new Error("access denied"));
        }
      } else {
        return handleApiError(new Error("access denied"));
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
    return handleApiError(error);
  }
}
