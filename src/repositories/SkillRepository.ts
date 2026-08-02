import { Prisma } from "@prisma/client";
import { ISkillRepository } from "./interfaces/ISkillRepository";
import {
  SkillDTO,
  SkillVersionDTO,
  SkillExampleDTO,
  CreateSkillInput,
  UpdateSkillInput,
  SkillListQuery,
  SkillListResult,
} from "@/types/skill";
import { prisma } from "@/lib/prisma";

export class SkillRepository implements ISkillRepository {
  async findById(id: string): Promise<SkillDTO | null> {
    const skill = await prisma.skill.findUnique({
      where: { id },
      include: {
        versions: true,
      },
    });

    if (!skill) return null;
    return this.mapSkill(skill);
  }

  async findByIdForUser(id: string, userId: string): Promise<SkillDTO | null> {
    const skill = await prisma.skill.findFirst({
      where: { id, userId },
      include: {
        versions: true,
      },
    });

    if (!skill) return null;
    return this.mapSkill(skill);
  }

  async findByUserId(userId: string): Promise<SkillDTO[]> {
    const skills = await prisma.skill.findMany({
      where: { userId },
      include: {
        versions: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return skills.map((skill) => this.mapSkill(skill));
  }

  async list(userId: string, query: SkillListQuery): Promise<SkillListResult> {
    const where: Prisma.SkillWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
      ...(query.search && {
        name: { contains: query.search, mode: "insensitive" },
      }),
    };

    const sortBy = query.sortBy ?? "updatedAt";
    const sortOrder = query.sortOrder ?? "desc";

    const [items, total] = await Promise.all([
      prisma.skill.findMany({
        where,
        include: { versions: true },
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.skill.count({ where }),
    ]);

    return { items: items.map((s) => this.mapSkill(s)), total };
  }

  async create(input: CreateSkillInput): Promise<SkillDTO> {
    // Create the skill + first draft and set the currentDraftId pointer
    // atomically so a crash between the two writes can't orphan a skill.
    const skill = await prisma.$transaction(async (tx) => {
      const created = await tx.skill.create({
        data: {
          userId: input.userId,
          name: input.name,
          purpose: input.purpose,
          versions: {
            create: {
              versionNumber: 1,
              status: "DRAFT",
              inputSchema: (input.inputSchema ?? {}) as unknown as Prisma.InputJsonValue,
              outputSchema: (input.outputSchema ?? {}) as unknown as Prisma.InputJsonValue,
              instructions: input.instructions ?? "",
              examples: (input.examples ?? []) as unknown as Prisma.InputJsonValue,
              allowedTools: (input.allowedTools ?? []) as unknown as Prisma.InputJsonValue,
              actionsRequiringApproval: (input.actionsRequiringApproval ?? []) as unknown as Prisma.InputJsonValue,
              maxExecutionSteps: input.maxExecutionSteps ?? 10,
              notes: input.notes ?? null,
            },
          },
        },
        include: {
          versions: true,
        },
      });

      const firstVersion = created.versions[0];
      if (firstVersion) {
        // Return the updated row so the response includes the currentDraftId
        // pointer (the `created` snapshot above is stale, pre-update).
        return tx.skill.update({
          where: { id: created.id },
          data: { currentDraftId: firstVersion.id },
          include: { versions: true },
        });
      }
      return created;
    });

    return this.mapSkill(skill);
  }

  /**
   * Updates the current draft. If the skill's current draft is missing or no
   * longer a DRAFT (i.e. it was published), a fresh Draft version is cloned
   * from the latest version first — published versions stay immutable.
   * Skill-level fields (name/purpose) are synced on the Skill row.
   */
  async updateDraft(skillId: string, userId: string, input: UpdateSkillInput): Promise<SkillVersionDTO> {
    const skill = await prisma.skill.findFirst({ where: { id: skillId, userId } });
    if (!skill) throw new Error("Skill not found");

    let draftId = skill.currentDraftId;
    const draft = draftId
      ? await prisma.skillVersion.findUnique({ where: { id: draftId } })
      : null;

    if (!draft || draft.status !== "DRAFT") {
      // Rotate a new draft from the most recent version (published or draft).
      // Wrapped in a transaction so the new version + currentDraftId pointer
      // commit atomically — a crash between the two writes would otherwise
      // leave the skill pointing at a stale draft.
      draftId = await prisma.$transaction(async (tx) => {
        const latest = await tx.skillVersion.findFirst({
          where: { skillId },
          orderBy: { versionNumber: "desc" },
        });
        const nextNumber = (latest?.versionNumber ?? 0) + 1;
        const created = await tx.skillVersion.create({
          data: {
            skillId,
            versionNumber: nextNumber,
            status: "DRAFT",
            inputSchema: (latest?.inputSchema ?? {}) as unknown as Prisma.InputJsonValue,
            outputSchema: (latest?.outputSchema ?? {}) as unknown as Prisma.InputJsonValue,
            instructions: latest?.instructions ?? "",
            examples: (latest?.examples ?? []) as unknown as Prisma.InputJsonValue,
            allowedTools: (latest?.allowedTools ?? []) as unknown as Prisma.InputJsonValue,
            actionsRequiringApproval: (latest?.actionsRequiringApproval ?? []) as unknown as Prisma.InputJsonValue,
            maxExecutionSteps: latest?.maxExecutionSteps ?? 10,
            notes: latest?.notes ?? null,
          },
        });
        await tx.skill.update({
          where: { id: skillId },
          data: { currentDraftId: created.id },
        });
        return created.id;
      });
    }

    const updated = await prisma.skillVersion.update({
      where: { id: draftId! },
      data: {
        ...(input.inputSchema && { inputSchema: input.inputSchema as unknown as Prisma.InputJsonValue }),
        ...(input.outputSchema && { outputSchema: input.outputSchema as unknown as Prisma.InputJsonValue }),
        ...(input.instructions !== undefined && { instructions: input.instructions }),
        ...(input.examples && { examples: input.examples as unknown as Prisma.InputJsonValue }),
        ...(input.allowedTools && { allowedTools: input.allowedTools as unknown as Prisma.InputJsonValue }),
        ...(input.actionsRequiringApproval && {
          actionsRequiringApproval: input.actionsRequiringApproval as unknown as Prisma.InputJsonValue,
        }),
        ...(input.maxExecutionSteps !== undefined && { maxExecutionSteps: input.maxExecutionSteps }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });

    // Keep the top-level skill name/purpose in sync with the draft, and always
    // bump updatedAt so recently edited skills surface in updatedAt sorting.
    await prisma.skill.update({
      where: { id: skillId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.purpose !== undefined && { purpose: input.purpose }),
        updatedAt: new Date(),
      },
    });

    return this.mapVersion(updated);
  }

  async duplicate(skillId: string, userId: string): Promise<SkillDTO> {
    const skill = await prisma.skill.findFirst({
      where: { id: skillId, userId },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });
    if (!skill) throw new Error("Skill not found");

    const source = skill.versions[0];

    const duplicated = await prisma.$transaction(async (tx) => {
      const created = await tx.skill.create({
        data: {
          userId,
          name: `${skill.name} (Copy)`,
          purpose: skill.purpose,
          versions: {
            create: {
              versionNumber: 1,
              status: "DRAFT",
              inputSchema: (source?.inputSchema ?? {}) as unknown as Prisma.InputJsonValue,
              outputSchema: (source?.outputSchema ?? {}) as unknown as Prisma.InputJsonValue,
              instructions: source?.instructions ?? "",
              examples: (source?.examples ?? []) as unknown as Prisma.InputJsonValue,
              allowedTools: (source?.allowedTools ?? []) as unknown as Prisma.InputJsonValue,
              actionsRequiringApproval: (source?.actionsRequiringApproval ?? []) as unknown as Prisma.InputJsonValue,
              maxExecutionSteps: source?.maxExecutionSteps ?? 10,
              notes: source?.notes ?? null,
            },
          },
        },
        include: { versions: true },
      });

      const firstVersion = created.versions[0];
      if (firstVersion) {
        // Return the updated row so the response includes the currentDraftId
        // pointer (the `created` snapshot above is stale, pre-update).
        return tx.skill.update({
          where: { id: created.id },
          data: { currentDraftId: firstVersion.id },
          include: { versions: true },
        });
      }
      return created;
    });

    return this.mapSkill(duplicated);
  }

  async archive(skillId: string, userId: string): Promise<SkillDTO> {
    const skill = await prisma.skill.findFirst({ where: { id: skillId, userId } });
    if (!skill) throw new Error("Skill not found");

    const updated = await prisma.skill.update({
      where: { id: skillId },
      data: { status: "ARCHIVED" },
      include: { versions: true },
    });
    return this.mapSkill(updated);
  }

  async deleteDraft(skillId: string, userId: string): Promise<void> {
    const skill = await prisma.skill.findFirst({ where: { id: skillId, userId } });
    if (!skill) throw new Error("Skill not found");
    if (skill.status === "PUBLISHED" || skill.publishedVersionId) {
      throw new Error("Published skills cannot be deleted. Archive them instead.");
    }
    await prisma.skill.delete({ where: { id: skillId } });
  }

  async publishVersion(skillId: string, userId: string, versionId: string): Promise<SkillVersionDTO> {
    const skill = await prisma.skill.findFirst({ where: { id: skillId, userId } });
    if (!skill) throw new Error("Skill not found");
    if (skill.status === "ARCHIVED") {
      throw new Error("Archived skills cannot be published");
    }

    const version = await prisma.skillVersion.findUnique({ where: { id: versionId } });
    if (!version || version.skillId !== skillId) {
      throw new Error("Version not found for this skill");
    }
    if (version.status !== "DRAFT") {
      throw new Error("Only draft versions can be published");
    }

    // Publish the version and flip the skill atomically. Clearing currentDraftId
    // is critical: the published version is immutable and must stop being
    // reported as the editable draft, otherwise the UI shows "DRAFT" on the
    // published version and the same version can be re-published endlessly.
    const [published] = await prisma.$transaction([
      prisma.skillVersion.update({
        where: { id: versionId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      }),
      prisma.skill.update({
        where: { id: skillId },
        data: { publishedVersionId: versionId, status: "PUBLISHED", currentDraftId: null },
      }),
    ]);

    return this.mapVersion(published);
  }

  async findVersionById(versionId: string): Promise<SkillVersionDTO | null> {
    const version = await prisma.skillVersion.findUnique({ where: { id: versionId } });
    return version ? this.mapVersion(version) : null;
  }

  async findVersionsBySkillId(skillId: string): Promise<SkillVersionDTO[]> {
    const versions = await prisma.skillVersion.findMany({
      where: { skillId },
      orderBy: { versionNumber: "desc" },
    });
    return versions.map((v) => this.mapVersion(v));
  }

  private mapSkill(s: Prisma.SkillGetPayload<{ include: { versions: true } }>): SkillDTO {
    const versions = (s.versions || []).map((v) => this.mapVersion(v));
    return {
      id: s.id,
      userId: s.userId,
      name: s.name,
      purpose: s.purpose,
      status: s.status,
      currentDraftId: s.currentDraftId,
      publishedVersionId: s.publishedVersionId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      currentDraft: versions.find((v) => v.id === s.currentDraftId) ?? null,
      publishedVersion: versions.find((v) => v.id === s.publishedVersionId) ?? null,
      versions,
    };
  }

  private mapVersion(v: Prisma.SkillVersionGetPayload<{}>): SkillVersionDTO {
    return {
      id: v.id,
      skillId: v.skillId,
      versionNumber: v.versionNumber,
      status: v.status,
      inputSchema: v.inputSchema as Record<string, unknown>,
      outputSchema: v.outputSchema as Record<string, unknown>,
      instructions: v.instructions,
      examples: v.examples as unknown as SkillExampleDTO[],
      allowedTools: v.allowedTools as string[],
      actionsRequiringApproval: v.actionsRequiringApproval as string[],
      maxExecutionSteps: v.maxExecutionSteps,
      changelog: v.changelog,
      notes: v.notes,
      createdAt: v.createdAt,
      publishedAt: v.publishedAt,
    };
  }
}
