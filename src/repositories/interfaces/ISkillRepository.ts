import {
  SkillDTO,
  SkillVersionDTO,
  CreateSkillInput,
  UpdateSkillInput,
  SkillListQuery,
  SkillListResult,
} from "@/types/skill";


export interface ISkillRepository {
  findById(id: string): Promise<SkillDTO | null>;
  /** Scoped to the owning user — returns null when the skill belongs to someone else. */
  findByIdForUser(id: string, userId: string): Promise<SkillDTO | null>;
  findByUserId(userId: string): Promise<SkillDTO[]>;
  list(userId: string, query: SkillListQuery): Promise<SkillListResult>;
  listForOrganization(organizationId: string, query: SkillListQuery): Promise<SkillListResult>;
  create(input: CreateSkillInput): Promise<SkillDTO>;
  updateDraft(skillId: string, userId: string, input: UpdateSkillInput): Promise<SkillVersionDTO>;
  duplicate(skillId: string, userId: string): Promise<SkillDTO>;
  archive(skillId: string, userId: string): Promise<SkillDTO>;
  restore(skillId: string, userId: string): Promise<SkillDTO>;
  deleteDraft(skillId: string, userId: string): Promise<void>;
  publishVersion(skillId: string, userId: string, versionId: string): Promise<SkillVersionDTO>;
  findVersionById(versionId: string): Promise<SkillVersionDTO | null>;
  findVersionsBySkillId(skillId: string): Promise<SkillVersionDTO[]>;
}
