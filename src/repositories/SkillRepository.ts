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
import { ensureUserExists } from "@/lib/user";
import { AgentGraphDefinition } from "@/types/graph";

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
    const skill = await prisma.$transaction(
      async (tx) => {
        await ensureUserExists(input.userId, tx);
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
                graphDefinition: (input.graphDefinition ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
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
      },
      { maxWait: 5000, timeout: 10000 }
    );

    return this.mapSkill(skill);
  }

  /**
   * Updates the current draft. If the skill's current draft is missing or no
   * longer a DRAFT (i.e. it was published), a fresh Draft version is cloned
   * from the latest version first — published versions stay immutable.
   * Skill-level fields (name/purpose) are synced on the Skill row.
   */
  async updateDraft(skillId: string, userId: string, input: UpdateSkillInput): Promise<SkillVersionDTO> {
    const updated = await prisma.$transaction(
      async (tx) => {
        const skill = await tx.skill.findFirst({ where: { id: skillId, userId } });
        if (!skill) throw new Error("Skill not found");
        if (skill.status === "ARCHIVED") {
          throw new Error("Archived skills cannot be edited. Restore or duplicate them instead.");
        }

        let draftId = skill.currentDraftId;
        const draft = draftId
          ? await tx.skillVersion.findUnique({ where: { id: draftId } })
          : null;

        if (!draft || draft.status !== "DRAFT") {
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
              graphDefinition: (latest?.graphDefinition ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
              notes: latest?.notes ?? null,
            },
          });
          await tx.skill.update({
            where: { id: skillId },
            data: { currentDraftId: created.id },
          });
          draftId = created.id;
        }

        const updatedVersion = await tx.skillVersion.update({
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
            // graphDefinition supports explicit null (clear the graph) unlike
            // other fields which only update when truthy.
            ...(input.graphDefinition !== undefined && {
              graphDefinition: (input.graphDefinition ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
            }),
            ...(input.notes !== undefined && { notes: input.notes }),
          },
        });

        await tx.skill.update({
          where: { id: skillId },
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.purpose !== undefined && { purpose: input.purpose }),
            updatedAt: new Date(),
          },
        });

        return updatedVersion;
      },
      { maxWait: 5000, timeout: 10000 }
    );

    return this.mapVersion(updated);
  }

  async duplicate(skillId: string, userId: string): Promise<SkillDTO> {
    const skill = await prisma.skill.findFirst({
      where: { id: skillId, userId },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });
    if (!skill) throw new Error("Skill not found");

    const source = skill.versions[0];

    const duplicated = await prisma.$transaction(
      async (tx) => {
        await ensureUserExists(userId, tx);
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
                graphDefinition: (source?.graphDefinition ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
                notes: source?.notes ?? null,
              },
            },
          },
          include: { versions: true },
        });

        const firstVersion = created.versions[0];
        if (firstVersion) {
          return tx.skill.update({
            where: { id: created.id },
            data: { currentDraftId: firstVersion.id },
            include: { versions: true },
          });
        }
        return created;
      },
      { maxWait: 5000, timeout: 10000 }
    );

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

    const published = await prisma.$transaction(
      async (tx) => {
        const result = await tx.skillVersion.updateMany({
          where: { id: versionId, skillId, status: "DRAFT" },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        });

        if (result.count === 0) {
          throw new Error("Only draft versions can be published");
        }

        await tx.skill.update({
          where: { id: skillId },
          data: { publishedVersionId: versionId, status: "PUBLISHED", currentDraftId: null },
        });

        const row = await tx.skillVersion.findUnique({ where: { id: versionId } });
        if (!row) throw new Error("Version not found for this skill");
        return row;
      },
      { maxWait: 5000, timeout: 10000 }
    );

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
      graphDefinition: (v.graphDefinition as AgentGraphDefinition | null) ?? null,
      changelog: v.changelog,
      notes: v.notes,
      createdAt: v.createdAt,
      publishedAt: v.publishedAt,
    };
  }
}
