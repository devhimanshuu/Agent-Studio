import { NextResponse } from "next/server";
import { createSkillSchema, skillListQuerySchema } from "@/validators/skillSchema";
import { SkillService } from "@/services/SkillService";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";

const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const parsed = skillListQuerySchema.safeParse({
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortOrder: searchParams.get("sortOrder") ?? undefined,
    });
    if (!parsed.success) return badRequest(parsed.error);

    const result = await skillService.listSkills(userId, parsed.data);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    const validated = createSkillSchema.parse({ ...body, userId });
    const skill = await skillService.createSkill(validated);
    return NextResponse.json({ success: true, data: skill }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof Error && "issues" in error) {
      return badRequest(error); // Zod validation failure → 400
    }
    return serverError(error); // service/DB failure → 500
  }
}
