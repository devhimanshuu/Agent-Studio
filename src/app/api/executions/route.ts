import { NextResponse } from "next/server";
import { startExecutionSchema } from "@/validators/executionSchema";
import { ExecutionService } from "@/services/ExecutionService";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";

const executionRepo = new ExecutionRepository();
const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const executionService = new ExecutionService(executionRepo, skillRepo, auditRepo);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "demo-user-id";
  const executions = await executionService.getUserExecutions(userId);
  return NextResponse.json({ success: true, data: executions });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = startExecutionSchema.parse(body);
    const execution = await executionService.startExecution(validated);
    return NextResponse.json({ success: true, data: execution }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to start execution" }, { status: 400 });
  }
}
