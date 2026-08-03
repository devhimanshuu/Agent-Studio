import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { MetricsService } from "@/modules/observability";
import { unauthorized, serverError } from "@/lib/api/handlers";

const executionRepo = new ExecutionRepository();
const metricsService = new MetricsService(executionRepo);

/** Observability widgets: total executions, success/failure rate, avg time, most-used skills/tools, approvals. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const metrics = await metricsService.getMetrics(userId);
    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    return serverError(error);
  }
}
