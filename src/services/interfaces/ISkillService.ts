import { SkillDTO, SkillVersionDTO, CreateSkillInput } from "@/types/skill";

export interface ISkillService {
  getSkill(id: string): Promise<SkillDTO | null>;
  getUserSkills(userId: string): Promise<SkillDTO[]>;
  createSkill(input: CreateSkillInput): Promise<SkillDTO>;
  updateDraft(skillId: string, versionData: Partial<SkillVersionDTO>): Promise<SkillVersionDTO>;
  publishVersion(skillId: string, versionId: string): Promise<SkillVersionDTO>;
}
