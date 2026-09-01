import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { skillService } = apiServices();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const archived = await skillService.archiveSkill(id, userId);
    return NextResponse.json({ success: true, data: archived });
  } catch (error) {
    return handleApiError(error);
  }
}
