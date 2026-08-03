export type ToolType = "READ" | "WRITE";

/** High-level bucket used by the tools dashboard + catalog. */
export type ToolCategory = "COMPUTE" | "SEARCH" | "DATA" | "TASK";

export interface ToolDefinitionDTO {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category?: ToolCategory | null;
  type: ToolType;
  parameters: Record<string, unknown>; // JSON Schema
  requiresAuth: boolean;
  requiresApproval: boolean;
  isSystem: boolean;
  createdAt: Date;
}

/** Metadata row used to (re)sync the `tool_definitions` catalog from the
 * built-in tool module. Kept in the types layer so repositories never import
 * from `modules/`. */
export interface ToolCatalogItem {
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  type: ToolType;
  parameters: Record<string, unknown>;
  requiresAuth: boolean;
  requiresApproval: boolean;
  isSystem: boolean;
}
