import { ToolDefinitionRepository } from "@/repositories/ToolDefinitionRepository";
import { BUILT_IN_TOOL_CATALOG, Tool, ToolHealth } from "@/modules/tools";
import { ToolDefinitionDTO } from "@/types/tool";

/**
 * List tool definitions, syncing the built-in catalog into the DB whenever it
 * is SHORT of the catalog (fresh deployments start empty; adding a future
 * built-in tool makes the table short again). Self-healing + additive: the
 * sync is idempotent and only touches diverging rows.
 */
async function listToolDefinitions(): Promise<ToolDefinitionDTO[]> {
  const repo = new ToolDefinitionRepository();
  let definitions = await repo.list();
  if (definitions.length < BUILT_IN_TOOL_CATALOG.length) {
    await repo.syncCatalog(BUILT_IN_TOOL_CATALOG);
    definitions = await repo.list();
  }
  return definitions;
}

/** Look up a single definition by name (after ensuring the catalog exists). */
export async function findToolDefinition(name: string): Promise<ToolDefinitionDTO | null> {
  const definitions = await listToolDefinitions();
  return definitions.find((d) => d.name === name) ?? null;
}

/** Probe tool health (never throws — degrades to unavailable). */
export async function probeHealth(tool: Tool): Promise<ToolHealth> {
  try {
    return await tool.healthCheck();
  } catch {
    return { status: "unavailable", latencyMs: 0, message: "health probe failed" };
  }
}
