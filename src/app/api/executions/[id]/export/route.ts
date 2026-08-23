import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, serverError, notFound } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { executionService, historyService } = apiServices();

/**
 * JSON export of a full execution report: trace data, structured logs,
 * timeline events, and approval records. The client saves it as a file.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const report = await historyService.exportExecution(id, userId);
    if (!report) return notFound("Execution not found");
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return serverError(error);
  }
}
