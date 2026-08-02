import { SkillVersionDTO } from "@/types/skill";

export interface VersionDiffDTO {
  versionA: SkillVersionDTO;
  versionB: SkillVersionDTO;
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

export interface IVersionService {
  getVersionHistory(skillId: string): Promise<SkillVersionDTO[]>;
  compareVersions(versionIdA: string, versionIdB: string): Promise<VersionDiffDTO>;
}
