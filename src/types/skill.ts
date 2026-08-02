export type SkillStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface SkillExampleDTO {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  description?: string;
}

export interface SkillVersionDTO {
  id: string;
  skillId: string;
  versionNumber: number;
  status: SkillStatus;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  instructions: string;
  examples: SkillExampleDTO[];
  allowedTools: string[];
  actionsRequiringApproval: string[];
  maxExecutionSteps: number;
  changelog?: string | null;
  createdAt: Date;
  publishedAt?: Date | null;
}

export interface SkillDTO {
  id: string;
  userId: string;
  name: string;
  purpose: string;
  currentDraftId?: string | null;
  publishedVersionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  currentDraft?: SkillVersionDTO | null;
  publishedVersion?: SkillVersionDTO | null;
  versions?: SkillVersionDTO[];
}

export interface CreateSkillInput {
  userId: string;
  name: string;
  purpose: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  instructions?: string;
  examples?: SkillExampleDTO[];
  allowedTools?: string[];
  actionsRequiringApproval?: string[];
  maxExecutionSteps?: number;
}
