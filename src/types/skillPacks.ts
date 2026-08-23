/**
 * 1-Click Skill Packs & Solution Stacks
 *
 * Curated bundles of MCP servers + visual workflow skills that can be
 * installed with a single click. Each pack pre-configures server connections
 * and creates ready-to-use workflow skills.
 */

// ────────────── Pack Metadata ──────────────

export type PackCategory =
  | "devops"
  | "data_analytics"
  | "growth_marketing"
  | "security"
  | "ai_ml"
  | "productivity"
  | "communication"
  | "creative";

export interface SkillPack {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: PackCategory;
  icon: string; // Lucide icon name
  color: string; // Tailwind color for the pack accent
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  estimatedSetupTime: string;

  /** MCP servers included in this pack */
  servers: PackServer[];
  /** Workflow skills included in this pack */
  skills: PackSkill[];

  /** User-facing counts */
  serverCount: number;
  skillCount: number;

  /** Ordering */
  popularity: number;
  isNew: boolean;
}

export interface PackServer {
  /** Display name */
  name: string;
  /** Source to search in the MCP directory */
  directorySource?: string;
  /** Composio toolkit slug (if composio source) */
  composioSlug?: string;
  /** Specific search query for the directory */
  searchQuery: string;
  /** Transport override */
  transport?: "SSE" | "STDIO";
  /** What this server provides */
  description: string;
  /** Category badge */
  category: "SCM" | "CLOUD" | "DATABASE" | "MESSAGING" | "MONITORING" | "ANALYTICS" | "CRM" | "MARKETING" | "AI" | "INFRASTRUCTURE" | "COLLABORATION";
}

export interface PackSkill {
  /** Display name */
  name: string;
  /** Purpose of this skill */
  purpose: string;
  /** Detailed instructions (markdown) */
  instructions: string;
  /** Which tools the skill needs (patterns like mcp_<server>_* or specific names) */
  allowedToolPatterns: string[];
  /** Which servers from this pack are needed (indexes into pack.servers) */
  requiredServerIndices: number[];
  /** Workflow steps */
  steps: PackSkillStep[];
  /** Visual graph definition (optional — if provided, creates a canvas workflow) */
  graphDefinition?: Record<string, unknown>;
}

export interface PackSkillStep {
  order: number;
  action: string;
  description: string;
  nodeType: "agent" | "tool" | "router" | "start" | "end" | "transform" | "http";
  config?: Record<string, unknown>;
}

// ────────────── Installation State ──────────────

export interface PackInstallationState {
  packId: string;
  status: "installing" | "completed" | "partial" | "failed";
  serversInstalled: number;
  serversTotal: number;
  skillsInstalled: number;
  skillsTotal: number;
  errors: string[];
  installedServerIds: string[];
  installedSkillIds: string[];
  startedAt: string;
  completedAt?: string;
}

// ────────────── API Types ──────────────

export interface InstallPackInput {
  packId: string;
  /** Optional: only install specific servers (by index) */
  serverIndices?: number[];
  /** Optional: only install specific skills (by index) */
  skillIndices?: number[];
}

export interface InstallPackResponse {
  success: boolean;
  data: PackInstallationState;
  error?: string;
}

// ────────────── Pack Registry ──────────────

export interface PackRegistry {
  packs: SkillPack[];
  lastUpdated: string;
}

// LocalStorage key for tracking installed packs
export const INSTALLED_PACKS_KEY = "skill-installed-packs";

export interface InstalledPackRecord {
  packId: string;
  installedAt: string;
  serverIds: string[];
  skillIds: string[];
}
