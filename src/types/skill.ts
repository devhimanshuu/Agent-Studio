import { AgentGraphDefinition } from "./graph";

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
  /** Visual multi-agent graph — when present the version runs through the graph interpreter. */
  graphDefinition?: AgentGraphDefinition | null;
  changelog?: string | null;
  notes?: string | null;
  createdAt: Date;
  publishedAt?: Date | null;
}

export interface SkillDTO {
  id: string;
  userId: string;
  name: string;
  purpose: string;
  status: SkillStatus;
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
  graphDefinition?: AgentGraphDefinition;
  notes?: string;
}

export interface UpdateSkillInput {
  name?: string;
  purpose?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  instructions?: string;
  examples?: SkillExampleDTO[];
  allowedTools?: string[];
  actionsRequiringApproval?: string[];
  maxExecutionSteps?: number;
  /** Null clears the graph; undefined leaves it unchanged. */
  graphDefinition?: AgentGraphDefinition | null;
  notes?: string;
}

export interface SkillListQuery {
  search?: string;
  status?: SkillStatus;
  sortBy?: "updatedAt" | "name" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface SkillListResult {
  items: SkillDTO[];
  total: number;
}
