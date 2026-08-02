import { Prisma } from "@prisma/client";
import { ISkillRepository } from "./interfaces/ISkillRepository";
import { SkillDTO, SkillVersionDTO, SkillExampleDTO, CreateSkillInput } from "@/types/skill";
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

    return {
      ...skill,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
      versions: skill.versions.map(this.mapVersion),
    };
  }

  async findByUserId(userId: string): Promise<SkillDTO[]> {
    const skills = await prisma.skill.findMany({
      where: { userId },
      include: {
        versions: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return skills.map((skill) => ({
      ...skill,
      versions: skill.versions.map(this.mapVersion),
    }));
  }

  async create(input: CreateSkillInput): Promise<SkillDTO> {
    const skill = await prisma.skill.create({
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
          },
        },
      },
      include: {
        versions: true,
      },
    });

    const firstVersion = skill.versions[0];
    await prisma.skill.update({
      where: { id: skill.id },
      data: { currentDraftId: firstVersion.id },
    });

    return {
      ...skill,
      currentDraftId: firstVersion.id,
      versions: skill.versions.map(this.mapVersion),
    };
  }

  async updateDraft(skillId: string, versionData: Partial<SkillVersionDTO>): Promise<SkillVersionDTO> {
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill || !skill.currentDraftId) throw new Error("Draft skill version not found");

    const updated = await prisma.skillVersion.update({
      where: { id: skill.currentDraftId },
      data: {
        ...(versionData.inputSchema && { inputSchema: versionData.inputSchema as unknown as Prisma.InputJsonValue }),
        ...(versionData.outputSchema && { outputSchema: versionData.outputSchema as unknown as Prisma.InputJsonValue }),
        ...(versionData.instructions !== undefined && { instructions: versionData.instructions }),
        ...(versionData.examples && { examples: versionData.examples as unknown as Prisma.InputJsonValue }),
        ...(versionData.allowedTools && { allowedTools: versionData.allowedTools as unknown as Prisma.InputJsonValue }),
        ...(versionData.actionsRequiringApproval && { actionsRequiringApproval: versionData.actionsRequiringApproval as unknown as Prisma.InputJsonValue }),
        ...(versionData.maxExecutionSteps !== undefined && { maxExecutionSteps: versionData.maxExecutionSteps }),
      },
    });

    return this.mapVersion(updated);
  }

  async publishVersion(skillId: string, versionId: string): Promise<SkillVersionDTO> {
    const published = await prisma.skillVersion.update({
      where: { id: versionId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    await prisma.skill.update({
      where: { id: skillId },
      data: { publishedVersionId: versionId },
    });

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
    return versions.map(this.mapVersion);
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
      createdAt: v.createdAt,
      publishedAt: v.publishedAt,
    };
  }
}
