import React from "react";
import { auth } from "@clerk/nextjs/server";
import { DashboardStatsService } from "@/services/DashboardStatsService";
import { DashboardClientView } from "@/components/dashboard/DashboardClientView";

export default async function DashboardPage() {
  const { userId } = await auth();
  const dashboardStatsService = new DashboardStatsService();

  const initialStats = await dashboardStatsService.getDashboardStats(userId || "", "7d");

  return <DashboardClientView initialStats={initialStats} />;
}
