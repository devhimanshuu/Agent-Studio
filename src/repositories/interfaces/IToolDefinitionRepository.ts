import { ToolCatalogItem, ToolDefinitionDTO } from "@/types/tool";

export interface IToolDefinitionRepository {
  /** All tool definitions in the system registry. */
  list(): Promise<ToolDefinitionDTO[]>;
  /** Number of tool definitions in the system registry. */
  count(): Promise<number>;
  /** Idempotent upsert of the built-in tool catalog. Returns the new count. */
  syncCatalog(items: ToolCatalogItem[]): Promise<number>;
}
