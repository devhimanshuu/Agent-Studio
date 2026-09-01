import { NextResponse } from "next/server";
import { publishSkillSchema } from "@/validators/skillSchema";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";

const { skillService } = apiServices();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = publishSkillSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error);

    const published = await skillService.publishVersion(id, userId, parsed.data.versionId);
    return NextResponse.json({ success: true, data: published });
  } catch (error) {
    return handleApiError(error);
  }
}
