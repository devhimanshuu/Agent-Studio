import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { SkillRepository } from "@/repositories/SkillRepository";
import { VersionComparisonService } from "@/modules/comparison";
import { unauthorized, serverError, badRequest, notFound, forbidden } from "@/lib/api/handlers";

const skillRepo = new SkillRepository();
const comparisonService = new VersionComparisonService(skillRepo);

/**
 * GET /api/compare?versionA=<id>&versionB=<id>
 * Compares two versions of the same skill. Ownership-scoped.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const url = new URL(request.url);
    const versionA = url.searchParams.get("versionA");
    const versionB = url.searchParams.get("versionB");
    if (!versionA || !versionB) {
      return badRequest(new Error("versionA and versionB query params are required"));
    }

    const diff = await comparisonService.compare(versionA, versionB, userId);
    return NextResponse.json({ success: true, data: diff });
  } catch (error) {
    if (error instanceof Error) {
      // Ownership violations first — the service throws a combined
      // "not found or you do not have access" message, and the access case must
      // win so probing another user's versions returns 403, never 404.
      if (error.message.includes("access")) return forbidden();
      if (error.message.includes("not found")) return notFound(error.message);
      // Comparing versions of two different skills is a client input error
      // (400) — before this mapping it fell through to a 500.
      if (error.message.includes("same skill")) return badRequest(error);
    }
    return serverError(error);
  }
}
