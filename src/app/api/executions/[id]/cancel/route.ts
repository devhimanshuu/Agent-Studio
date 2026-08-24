import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, serverError, notFound } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { executionService } = apiServices();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth first — Clerk errors are never business-logic errors.
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const execution = await executionService.cancelExecutionForUser(id, userId);
    return NextResponse.json({ success: true, data: execution });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not found") || message.includes("access")) {
      return notFound("Execution not found");
    }
    return serverError(error);
  }
}
