import { IVersionService, VersionDiffDTO } from "./interfaces/IVersionService";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { SkillVersionDTO } from "@/types/skill";

export class VersionService implements IVersionService {
  constructor(private skillRepo: ISkillRepository) {}

  async getVersionHistory(skillId: string): Promise<SkillVersionDTO[]> {
    return this.skillRepo.findVersionsBySkillId(skillId);
  }

  async compareVersions(versionIdA: string, versionIdB: string): Promise<VersionDiffDTO> {
    const vA = await this.skillRepo.findVersionById(versionIdA);
    const vB = await this.skillRepo.findVersionById(versionIdB);

    if (!vA || !vB) {
      throw new Error("One or both skill versions not found for comparison");
    }

    const changes: VersionDiffDTO["changes"] = [];

    const fieldsToCompare: (keyof SkillVersionDTO)[] = [
      "instructions",
      "allowedTools",
      "actionsRequiringApproval",
      "maxExecutionSteps",
      "inputSchema",
      "outputSchema",
    ];

    for (const field of fieldsToCompare) {
      const valA = JSON.stringify(vA[field]);
      const valB = JSON.stringify(vB[field]);
      if (valA !== valB) {
        changes.push({
          field,
          oldValue: vA[field],
          newValue: vB[field],
        });
      }
    }

    return {
      versionA: vA,
      versionB: vB,
      changes,
    };
  }
}
