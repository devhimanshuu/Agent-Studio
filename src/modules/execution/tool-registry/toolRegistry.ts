/**
 * Bounded tool contract.
 *
 * Tools are NOT implemented in this phase — the registry is the pluggable
 * seam the next phase fills (Calculator, Document Search, Record Lookup,
 * Task Creator). The runtime executes ONLY tools registered here.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema describing the accepted `input` shape. */
  parameters: Record<string, unknown>;
  enabled: boolean;
  execute(input: Record<string, unknown>): Promise<unknown>;
}

/**
 * In-memory tool registry. The execution graph resolves every planned tool
 * through this registry and the PermissionChecker — an unregistered or
 * disabled tool is rejected before it can run.
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  registerTool(tool: ToolDefinition): void {
    if (!tool?.name) throw new Error("Cannot register a tool without a name");
    if (this.tools.has(tool.name)) throw new Error(`Tool "${tool.name}" is already registered`);
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ToolDefinition | null {
    return this.tools.get(name) ?? null;
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  listTools(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  /**
   * Executes a registered, enabled tool. Throws when the tool is unknown or
   * disabled — callers (graph nodes) decide how to surface the failure.
   */
  async executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" is not registered`);
    if (!tool.enabled) throw new Error(`Tool "${name}" is disabled`);
    return tool.execute(input);
  }
}
