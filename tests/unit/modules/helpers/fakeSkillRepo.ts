import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import {
  SkillDTO,
  SkillVersionDTO,
  CreateSkillInput,
  UpdateSkillInput,
  SkillListQuery,
  SkillListResult,
} from "@/types/skill";

export class FakeSkillRepo implements ISkillRepository {
  skills = new Map<string, SkillDTO>();
  versions = new Map<string, SkillVersionDTO>();
  private skillSeq = 0;
  private versionSeq = 0;

  addSkill(skill: SkillDTO): void {
    this.skills.set(skill.id, skill);
  }

  addVersion(version: SkillVersionDTO): void {
    this.versions.set(version.id, version);
    const skill = this.skills.get(version.skillId);
    if (skill) {
      skill.versions = [...(skill.versions ?? []), version];
    }
  }

  async findById(id: string): Promise<SkillDTO | null> {
    return this.skills.get(id) ?? null;
  }

  async findByIdForUser(id: string, userId: string): Promise<SkillDTO | null> {
    const s = this.skills.get(id);
    return s && s.userId === userId ? s : null;
  }

  async findByUserId(userId: string): Promise<SkillDTO[]> {
    return [...this.skills.values()].filter((s) => s.userId === userId);
  }

  async list(userId: string, _query: SkillListQuery): Promise<SkillListResult> {
    const items = [...this.skills.values()].filter((s) => s.userId === userId);
    return { items, total: items.length };
  }

  async listForOrganization(organizationId: string, _query: SkillListQuery): Promise<SkillListResult> {
    const items = [...this.skills.values()].filter((s) => s.organizationId === organizationId);
    return { items, total: items.length };
  }

  async create(input: CreateSkillInput): Promise<SkillDTO> {
    this.skillSeq += 1;
    this.versionSeq += 1;
    const skillId = `skill-${this.skillSeq}`;
    const versionId = `version-${this.versionSeq}`;
    const now = new Date();
    const version: SkillVersionDTO = {
      id: versionId,
      skillId,
      versionNumber: 1,
      status: "DRAFT",
      inputSchema: input.inputSchema ?? {},
      outputSchema: input.outputSchema ?? {},
      instructions: input.instructions ?? "",
      examples: input.examples ?? [],
      allowedTools: input.allowedTools ?? [],
      actionsRequiringApproval: input.actionsRequiringApproval ?? [],
      maxExecutionSteps: input.maxExecutionSteps ?? 10,
      notes: input.notes ?? null,
      createdAt: now,
    };
    this.versions.set(versionId, version);
    const skill: SkillDTO = {
      id: skillId,
      userId: input.userId,
      name: input.name,
      purpose: input.purpose,
      status: "DRAFT",
      currentDraftId: versionId,
      createdAt: now,
      updatedAt: now,
      currentDraft: version,
      versions: [version],
    };
    this.skills.set(skillId, skill);
    return skill;
  }

  async updateDraft(skillId: string, _userId: string, input: UpdateSkillInput): Promise<SkillVersionDTO> {
    const skill = this.skills.get(skillId);
    if (!skill || !skill.currentDraftId) throw new Error("Skill not found");
    const draft = this.versions.get(skill.currentDraftId)!;
    if (input.name !== undefined) skill.name = input.name;
    if (input.purpose !== undefined) skill.purpose = input.purpose;
    Object.assign(draft, {
      ...(input.inputSchema !== undefined && { inputSchema: input.inputSchema }),
      ...(input.outputSchema !== undefined && { outputSchema: input.outputSchema }),
      ...(input.instructions !== undefined && { instructions: input.instructions }),
      ...(input.examples !== undefined && { examples: input.examples }),
      ...(input.allowedTools !== undefined && { allowedTools: input.allowedTools }),
      ...(input.actionsRequiringApproval !== undefined && { actionsRequiringApproval: input.actionsRequiringApproval }),
      ...(input.maxExecutionSteps !== undefined && { maxExecutionSteps: input.maxExecutionSteps }),
      ...(input.notes !== undefined && { notes: input.notes }),
    });
    skill.updatedAt = new Date();
    return draft;
  }

  async duplicate(skillId: string, userId: string): Promise<SkillDTO> {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error("Skill not found");
    const version = skill.versions?.[0] ?? this.versions.get(skill.currentDraftId ?? "");
    return this.create({
      userId,
      name: `${skill.name} (Copy)`,
      purpose: skill.purpose,
      inputSchema: version?.inputSchema ?? {},
      outputSchema: version?.outputSchema ?? {},
      instructions: version?.instructions ?? "",
      examples: version?.examples ?? [],
      allowedTools: version?.allowedTools ?? [],
      actionsRequiringApproval: version?.actionsRequiringApproval ?? [],
      maxExecutionSteps: version?.maxExecutionSteps ?? 10,
      notes: version?.notes ?? undefined,
    });
  }

  async archive(skillId: string, _userId: string): Promise<SkillDTO> {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error("Skill not found");
    skill.status = "ARCHIVED";
    return skill;
  }

  async restore(skillId: string, _userId: string): Promise<SkillDTO> {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error("Skill not found");
    skill.status = skill.publishedVersionId ? "PUBLISHED" : "DRAFT";
    return skill;
  }

  async deleteDraft(skillId: string, _userId: string): Promise<void> {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error("Skill not found");
    if (skill.status === "PUBLISHED" || skill.publishedVersionId) {
      throw new Error("Published skills cannot be deleted. Archive them instead.");
    }
    this.skills.delete(skillId);
  }

  async publishVersion(skillId: string, _userId: string, versionId: string): Promise<SkillVersionDTO> {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error("Skill not found");
    const version = this.versions.get(versionId);
    if (!version || version.skillId !== skillId) throw new Error("Version not found for this skill");
    version.status = "PUBLISHED";
    version.publishedAt = new Date();
    skill.status = "PUBLISHED";
    skill.publishedVersionId = versionId;
    skill.currentDraftId = null;
    return version;
  }

  async findVersionById(versionId: string): Promise<SkillVersionDTO | null> {
    return this.versions.get(versionId) ?? null;
  }

  async findVersionsBySkillId(skillId: string): Promise<SkillVersionDTO[]> {
    return [...this.versions.values()].filter((v) => v.skillId === skillId);
  }
}
