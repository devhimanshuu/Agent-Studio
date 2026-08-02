export type ToolType = "READ" | "WRITE";

export interface ToolDefinitionDTO {
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: ToolType;
  parameters: Record<string, unknown>; // JSON Schema
  requiresAuth: boolean;
  isSystem: boolean;
  createdAt: Date;
}
