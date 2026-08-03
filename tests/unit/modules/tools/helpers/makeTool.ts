import { Tool } from "@/modules/tools";

/** Minimal valid Tool for tests — override any field. The id follows the name
 * automatically (registry requires id === name) unless both are overridden. */
export function makeTool(overrides: Partial<Tool> = {}): Tool {
  const name = overrides.name ?? "test_tool";
  return {
    id: name,
    name,
    displayName: "Test Tool",
    description: "A stub tool for tests",
    category: "COMPUTE",
    type: "READ",
    inputSchema: {},
    outputSchema: {},
    requiresApproval: false,
    enabled: true,
    validate: () => [],
    healthCheck: async () => ({ status: "healthy" as const, latencyMs: 0 }),
    execute: async () => ({ ok: true }),
    ...overrides,
  };
}
