import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { AuditService } from "@/modules/audit";
import { unauthorized, badRequest, handleApiError, isValidIsoDate } from "@/lib/api/handlers";
import { AuditQuery } from "@/types/observability";

const auditRepo = new AuditLogRepository();
const auditService = new AuditService(auditRepo);

/**
 * GET /api/audit            → filtered audit trail
 * GET /api/audit?export=1   → JSON export payload
 * Filters: search, action, from, to, limit
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const url = new URL(request.url);
    const isExport = url.searchParams.get("export") === "1";
    const limitRaw = url.searchParams.get("limit");

    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");

    const query: AuditQuery = {
      search: url.searchParams.get("search") ?? undefined,
      action: url.searchParams.get("action") ?? undefined,
      from: fromRaw ?? undefined,
      to: toRaw ?? undefined,
      limit: limitRaw ? Number(limitRaw) : undefined,
    };
    if (limitRaw && (Number.isNaN(query.limit) || (query.limit ?? 0) < 1)) {
      return badRequest(new Error("limit must be a positive number"));
    }
    // Invalid date filters used to produce Invalid Date → Prisma 500.
    if ((fromRaw && !isValidIsoDate(fromRaw)) || (toRaw && !isValidIsoDate(toRaw))) {
      return badRequest(new Error("from/to must be valid ISO dates"));
    }

    const data = isExport
      ? await auditService.export(userId, query)
      : await auditService.list(userId, query);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}
