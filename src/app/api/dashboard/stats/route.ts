import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, serverError } from "@/lib/api/handlers";
import { DashboardStatsService } from "@/services/DashboardStatsService";
import { TimeRangeFilter } from "@/types/dashboard";

const dashboardStatsService = new DashboardStatsService();

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get("timeRange") as TimeRangeFilter | null;
    const timeRange: TimeRangeFilter =
      rangeParam && ["24h", "7d", "30d", "all"].includes(rangeParam) ? rangeParam : "7d";

    const stats = await dashboardStatsService.getDashboardStats(userId, timeRange);
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    return serverError(error);
  }
}
