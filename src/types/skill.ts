import { AgentGraphDefinition } from "./graph";
import { ApprovalPolicy } from "./approval";

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
  /** Optional policy overrides (always/never/tool-based/skill-based) evaluated
   * before the plan flag / tool contract. Absent means DEFAULT_APPROVAL_POLICY. */
  approvalPolicy?: ApprovalPolicy | null;
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
  organizationId?: string | null;
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
  organizationId?: string | null;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  instructions?: string;
  examples?: SkillExampleDTO[];
  allowedTools?: string[];
  actionsRequiringApproval?: string[];
  approvalPolicy?: ApprovalPolicy;
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
  /** Null clears the policy override (falls back to DEFAULT_APPROVAL_POLICY); undefined leaves it unchanged. */
  approvalPolicy?: ApprovalPolicy | null;
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
