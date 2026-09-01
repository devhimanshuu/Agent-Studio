import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { VersionComparisonService } from "@/modules/comparison";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { skillRepo } = apiServices();
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
    return handleApiError(error);
  }
}
