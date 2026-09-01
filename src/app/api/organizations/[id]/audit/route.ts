/**
 * Organization Audit Logs Route
 *
 * GET /api/organizations/[id]/audit — Get audit logs for organization
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { AuditAction } from "@/services/AuditService";
import { unauthorized, forbidden, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { auditService, rbacService } = apiServices();

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

    // Check membership and audit permission (ADMIN/OWNER or custom role with audit:view)
    const permissions = await rbacService.getUserOrgPermissions(userId, id);
    if (!permissions.canViewAuditLog) return forbidden();

    // Parse query parameters
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const action = (url.searchParams.get("action") as AuditAction | null) || undefined;
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
    return handleApiError(error);
  }
}
