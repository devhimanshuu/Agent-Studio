import {
  SkillDTO,
  SkillVersionDTO,
  CreateSkillInput,
  UpdateSkillInput,
  SkillListQuery,
  SkillListResult,
} from "@/types/skill";

export interface ISkillService {
  getSkill(id: string): Promise<SkillDTO | null>;
  getSkillForUser(id: string, userId: string): Promise<SkillDTO | null>;
  getUserSkills(userId: string): Promise<SkillDTO[]>;
  listSkills(userId: string, query: SkillListQuery): Promise<SkillListResult>;
  createSkill(input: CreateSkillInput): Promise<SkillDTO>;
  updateSkill(skillId: string, userId: string, input: UpdateSkillInput): Promise<SkillVersionDTO>;
  duplicateSkill(skillId: string, userId: string): Promise<SkillDTO>;
  archiveSkill(skillId: string, userId: string): Promise<SkillDTO>;
  deleteSkill(skillId: string, userId: string): Promise<void>;
  publishVersion(skillId: string, userId: string, versionId: string): Promise<SkillVersionDTO>;
}
