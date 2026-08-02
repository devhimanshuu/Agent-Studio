import { IExecutionService } from "./interfaces/IExecutionService";
import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { IAuditLogRepository } from "@/repositories/interfaces/IAuditLogRepository";
import { ExecutionDTO, StartExecutionInput } from "@/types/execution";
import { logger } from "@/lib/logger";

export class ExecutionService implements IExecutionService {
  constructor(
    private executionRepo: IExecutionRepository,
    private skillRepo: ISkillRepository,
    private auditRepo: IAuditLogRepository
  ) {}

  async getExecution(id: string): Promise<ExecutionDTO | null> {
    return this.executionRepo.findById(id);
  }

  async getUserExecutions(userId: string): Promise<ExecutionDTO[]> {
    return this.executionRepo.findByUserId(userId);
  }

  async startExecution(input: StartExecutionInput): Promise<ExecutionDTO> {
    logger.info({ userId: input.userId, skillVersionId: input.skillVersionId }, "Initiating skill execution");

    const version = await this.skillRepo.findVersionById(input.skillVersionId);
    if (!version) {
      throw new Error(`Skill version ${input.skillVersionId} not found`);
    }

    const maxSteps = version.maxExecutionSteps || 10;
    const execution = await this.executionRepo.create(input, maxSteps);

    await this.auditRepo.log({
      userId: input.userId,
      executionId: execution.id,
      action: "EXECUTION_STARTED",
      details: { skillVersionId: input.skillVersionId, maxSteps },
    });

    return execution;
  }

  async cancelExecution(id: string): Promise<ExecutionDTO> {
    logger.info({ executionId: id }, "Cancelling execution");
    const updated = await this.executionRepo.updateStatus(id, "CANCELLED", "User requested cancellation");
    await this.auditRepo.log({
      executionId: id,
      action: "EXECUTION_CANCELLED",
      details: { reason: "User request" },
    });
    return updated;
  }
}
