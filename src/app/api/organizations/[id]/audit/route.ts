/**
 * Organization Audit Logs Route
 *
 * GET /api/organizations/[id]/audit — Get audit logs for organization
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { AuditService } from "@/services/AuditService";
import { RBACService, ForbiddenError } from "@/services/RBACService";
import { unauthorized, forbidden, serverError } from "@/lib/api/handlers";
import { logger } from "@/lib/logger";

const auditService = new AuditService();
const rbacService = new RBACService();

/**
 * GET /api/organizations/[id]/audit — Get audit logs
 * Requires VIEWER role or higher (Viewers can view audit logs)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const url = new URL(request.url);

    // Check membership
    const membership = await rbacService.getOrgMembership(userId, id);
    if (!membership) return forbidden();

    // Parse query parameters
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const action = url.searchParams.get("action") as any;
    const filterUserId = url.searchParams.get("userId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const result = await auditService.getOrganizationLogs(id, {
      limit: Math.min(limit, 500),
      offset,
      action,
      userId: filterUserId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return NextResponse.json({
      success: true,
      data: result.logs,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return forbidden();
    logger.error({ error }, "Failed to get audit logs");
    return serverError(error);
  }
}
