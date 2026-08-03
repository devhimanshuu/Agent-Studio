import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { startExecutionSchema } from "@/validators/executionSchema";
import { ExecutionService } from "@/services/ExecutionService";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";
import { ExecutionError } from "@/modules/execution/executor/errors";

const executionRepo = new ExecutionRepository();
const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const executionService = new ExecutionService(executionRepo, skillRepo, auditRepo);

export async function GET(_request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return unauthorized();

    const executions = await executionService.getUserExecutions(userId);
    return NextResponse.json({ success: true, data: executions });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return unauthorized();

    const body = await request.json();
    const validated = startExecutionSchema.parse({ ...body, userId });
    const execution = await executionService.startExecution(validated);
    return NextResponse.json({ success: true, data: execution }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return badRequest(error); // Zod validation failure → 400
    }
    // Domain validation failures (invalid skill/version/input) → 400.
    if (error instanceof ExecutionError) {
      return badRequest(new Error(error.message));
    }
    // Anything else (DB, unexpected) → 500 with a generic message.
    return serverError(error);
  }
}
