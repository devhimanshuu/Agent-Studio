import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ExecutionService } from "@/services/ExecutionService";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { unauthorized, serverError, notFound } from "@/lib/api/handlers";

const executionRepo = new ExecutionRepository();
const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const executionService = new ExecutionService(executionRepo, skillRepo, auditRepo);

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
