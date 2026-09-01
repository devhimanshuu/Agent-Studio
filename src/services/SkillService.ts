import { ISkillService } from "./interfaces/ISkillService";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { IAuditLogRepository } from "@/repositories/interfaces/IAuditLogRepository";
import {
  SkillDTO,
  SkillVersionDTO,
  CreateSkillInput,
  UpdateSkillInput,
  SkillListQuery,
  SkillListResult,
} from "@/types/skill";
import { logger } from "@/lib/logger";

export class SkillService implements ISkillService {
  constructor(
    private skillRepo: ISkillRepository,
    private auditRepo: IAuditLogRepository
  ) {}

  async getSkill(id: string): Promise<SkillDTO | null> {
    return this.skillRepo.findById(id);
  }

  async getSkillForUser(id: string, userId: string): Promise<SkillDTO | null> {
    return this.skillRepo.findByIdForUser(id, userId);
  }

  async getUserSkills(userId: string): Promise<SkillDTO[]> {
    return this.skillRepo.findByUserId(userId);
  }

  async listSkills(userId: string, query: SkillListQuery): Promise<SkillListResult> {
    return this.skillRepo.list(userId, query);
  }

  async createSkill(input: CreateSkillInput): Promise<SkillDTO> {
    logger.info({ userId: input.userId, name: input.name }, "Creating new skill");
    const skill = await this.skillRepo.create(input);
    await this.auditRepo.log({
      userId: input.userId,
      action: "SKILL_CREATED",
      details: { skillId: skill.id, name: skill.name },
    });
    return skill;
  }

  async updateSkill(skillId: string, userId: string, input: UpdateSkillInput): Promise<SkillVersionDTO> {
    const skill = await this.skillRepo.findByIdForUser(skillId, userId);
    if (!skill) {
      throw new Error("Skill not found or you do not have access to it");
    }

    logger.info({ skillId, userId }, "Updating skill draft");
    const updated = await this.skillRepo.updateDraft(skillId, userId, input);
    await this.auditRepo.log({
      userId,
      action: "SKILL_UPDATED",
      details: { skillId, versionNumber: updated.versionNumber },
    });
    return updated;
  }

  async duplicateSkill(skillId: string, userId: string): Promise<SkillDTO> {
    const skill = await this.skillRepo.findByIdForUser(skillId, userId);
    if (!skill) {
      throw new Error("Skill not found or you do not have access to it");
    }

    logger.info({ skillId, userId }, "Duplicating skill");
    const duplicated = await this.skillRepo.duplicate(skillId, userId);
    await this.auditRepo.log({
      userId,
      action: "SKILL_DUPLICATED",
      details: { sourceSkillId: skillId, newSkillId: duplicated.id },
    });
    return duplicated;
  }

  async archiveSkill(skillId: string, userId: string): Promise<SkillDTO> {
    const skill = await this.skillRepo.findByIdForUser(skillId, userId);
    if (!skill) {
      throw new Error("Skill not found or you do not have access to it");
    }

    logger.info({ skillId, userId }, "Archiving skill");
    const archived = await this.skillRepo.archive(skillId, userId);
    await this.auditRepo.log({
      userId,
      action: "SKILL_ARCHIVED",
      details: { skillId },
    });
    return archived;
  }

  async restoreSkill(skillId: string, userId: string): Promise<SkillDTO> {
    const skill = await this.skillRepo.findByIdForUser(skillId, userId);
    if (!skill) {
      throw new Error("Skill not found or you do not have access to it");
    }

    logger.info({ skillId, userId }, "Restoring archived skill");
    const restored = await this.skillRepo.restore(skillId, userId);
    await this.auditRepo.log({
      userId,
      action: "SKILL_RESTORED",
      details: { skillId, newStatus: restored.status },
    });
    return restored;
  }

  async deleteSkill(skillId: string, userId: string): Promise<void> {
    const skill = await this.skillRepo.findByIdForUser(skillId, userId);
    if (!skill) {
      throw new Error("Skill not found or you do not have access to it");
    }

    logger.info({ skillId, userId }, "Deleting draft skill");
    await this.skillRepo.deleteDraft(skillId, userId);
    await this.auditRepo.log({
      userId,
      action: "SKILL_DELETED",
      details: { skillId },
    });
  }

  async publishVersion(skillId: string, userId: string, versionId: string): Promise<SkillVersionDTO> {
    const skill = await this.skillRepo.findByIdForUser(skillId, userId);
    if (!skill) {
      throw new Error("Skill not found or you do not have access to it");
    }

    logger.info({ skillId, userId, versionId }, "Publishing skill version");
    const published = await this.skillRepo.publishVersion(skillId, userId, versionId);
    await this.auditRepo.log({
      userId,
      action: "SKILL_PUBLISHED",
      details: { skillId, versionId, versionNumber: published.versionNumber },
    });
    return published;
  }
}
