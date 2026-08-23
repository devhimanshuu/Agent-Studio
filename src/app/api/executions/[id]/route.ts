import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, serverError, notFound } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { executionService } = apiServices();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const execution = await executionService.getExecutionForUser(id, userId);
    if (!execution) return notFound("Execution not found");
    return NextResponse.json({ success: true, data: execution });
  } catch (error) {
    return serverError(error);
  }
}
