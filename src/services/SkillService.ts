import { ISkillService } from "./interfaces/ISkillService";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { IAuditLogRepository } from "@/repositories/interfaces/IAuditLogRepository";
import { SkillDTO, SkillVersionDTO, CreateSkillInput } from "@/types/skill";
import { logger } from "@/lib/logger";

export class SkillService implements ISkillService {
  constructor(
    private skillRepo: ISkillRepository,
    private auditRepo: IAuditLogRepository
  ) {}

  async getSkill(id: string): Promise<SkillDTO | null> {
    return this.skillRepo.findById(id);
  }

  async getUserSkills(userId: string): Promise<SkillDTO[]> {
    return this.skillRepo.findByUserId(userId);
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

  async updateDraft(skillId: string, versionData: Partial<SkillVersionDTO>): Promise<SkillVersionDTO> {
    logger.info({ skillId }, "Updating skill draft");
    return this.skillRepo.updateDraft(skillId, versionData);
  }

  async publishVersion(skillId: string, versionId: string): Promise<SkillVersionDTO> {
    logger.info({ skillId, versionId }, "Publishing skill version");
    const published = await this.skillRepo.publishVersion(skillId, versionId);
    await this.auditRepo.log({
      action: "SKILL_VERSION_PUBLISHED",
      details: { skillId, versionId, versionNumber: published.versionNumber },
    });
    return published;
  }
}
