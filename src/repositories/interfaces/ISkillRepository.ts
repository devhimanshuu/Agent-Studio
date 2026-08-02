import { SkillDTO, SkillVersionDTO, CreateSkillInput } from "@/types/skill";

export interface ISkillRepository {
  findById(id: string): Promise<SkillDTO | null>;
  findByUserId(userId: string): Promise<SkillDTO[]>;
  create(input: CreateSkillInput): Promise<SkillDTO>;
  updateDraft(skillId: string, versionData: Partial<SkillVersionDTO>): Promise<SkillVersionDTO>;
  publishVersion(skillId: string, versionId: string): Promise<SkillVersionDTO>;
  findVersionById(versionId: string): Promise<SkillVersionDTO | null>;
  findVersionsBySkillId(skillId: string): Promise<SkillVersionDTO[]>;
}
