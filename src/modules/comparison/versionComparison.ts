import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { SkillVersionDTO } from "@/types/skill";
import { VersionDiffResult } from "@/types/observability";

/**
 * Compares two skill versions with a rich, human-readable diff.
 * Ownership-scoped: both versions must belong to the requesting user.
 */
export class VersionComparisonService {
  constructor(private skillRepo: ISkillRepository) {}

  async compare(
    versionIdA: string,
    versionIdB: string,
    userId: string
  ): Promise<VersionDiffResult> {
    const [vA, vB] = await Promise.all([
      this.skillRepo.findVersionById(versionIdA),
      this.skillRepo.findVersionById(versionIdB),
    ]);
    if (!vA || !vB) throw new Error("One or both skill versions not found");
    if (vA.skillId !== vB.skillId) {
      throw new Error("Versions must belong to the same skill");
    }

    // Ownership: resolve the skill and confirm it belongs to the user.
    const skill = await this.skillRepo.findByIdForUser(vA.skillId, userId);
    if (!skill) throw new Error("Skill not found or you do not have access to it");

    const changes: VersionDiffResult["changes"] = [];
    const fields: { field: string; key: keyof SkillVersionDTO }[] = [
      { field: "Instructions", key: "instructions" },
      { field: "Input Schema", key: "inputSchema" },
      { field: "Output Schema", key: "outputSchema" },
      { field: "Examples", key: "examples" },
      { field: "Allowed Tools", key: "allowedTools" },
      { field: "Approval Actions", key: "actionsRequiringApproval" },
      { field: "Max Steps", key: "maxExecutionSteps" },
      { field: "Notes", key: "notes" },
      { field: "Changelog", key: "changelog" },
    ];

    for (const { field, key } of fields) {
      const rawA = vA[key];
      const rawB = vB[key];
      // Track absence (null/undefined) separately from the display value —
      // a field genuinely set to "" must not be classified as "added"/"removed"
      // just because it normalizes to the same placeholder as a missing field.
      const wasAbsent = rawA === null || rawA === undefined;
      const isAbsent = rawB === null || rawB === undefined;
      const oldValue = wasAbsent ? "" : rawA;
      const newValue = isAbsent ? "" : rawB;
      const same = JSON.stringify(oldValue) === JSON.stringify(newValue);
      if (same) continue;

      changes.push({
        field,
        kind: wasAbsent ? "added" : isAbsent ? "removed" : "modified",
        oldValue,
        newValue,
      });
    }

    return {
      skillId: skill.id,
      skillName: skill.name,
      versionA: { id: vA.id, versionNumber: vA.versionNumber, status: vA.status, createdAt: vA.createdAt },
      versionB: { id: vB.id, versionNumber: vB.versionNumber, status: vB.status, createdAt: vB.createdAt },
      changes,
      identical: changes.length === 0,
    };
  }
}
