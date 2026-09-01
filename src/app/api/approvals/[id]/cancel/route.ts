import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { unauthorized, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const cancelSchema = z.object({
  idempotencyKey: z.string().min(1, "Idempotency key is required"),
});

const { approvalEngine } = apiServices();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth first — Clerk errors are never business-logic errors.
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id: approvalId } = await params;
    const body = await request.json();
    const validated = cancelSchema.parse(body);

    const result = await approvalEngine.cancelPending(approvalId, userId, validated.idempotencyKey);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}