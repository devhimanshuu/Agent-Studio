import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, serverError, notFound } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { executionService, historyService } = apiServices();

/** Full execution detail: trace data, structured logs, timeline, and approval events. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const detail = await historyService.getDetail(id, userId);
    if (!detail) return notFound("Execution not found");
    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    return serverError(error);
  }
}
