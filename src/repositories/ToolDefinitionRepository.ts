import { Prisma } from "@prisma/client";
import { IToolDefinitionRepository } from "./interfaces/IToolDefinitionRepository";
import { ToolCatalogItem, ToolDefinitionDTO } from "@/types/tool";
import { prisma } from "@/lib/prisma";

export class ToolDefinitionRepository implements IToolDefinitionRepository {
  async list(): Promise<ToolDefinitionDTO[]> {
    const rows = await prisma.toolDefinition.findMany({ orderBy: { name: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      description: row.description,
      category: (row.category as ToolDefinitionDTO["category"]) ?? null,
      type: row.type,
      parameters: row.parameters as Record<string, unknown>,
      requiresAuth: row.requiresAuth,
      requiresApproval: row.requiresApproval,
      isSystem: row.isSystem,
      createdAt: row.createdAt,
    }));
  }

  async count(): Promise<number> {
    return prisma.toolDefinition.count();
  }

  /** Idempotent upsert of the built-in catalog — safe to run on every app
   * start / page load; only diverging rows are touched. */
  async syncCatalog(items: ToolCatalogItem[]): Promise<number> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.toolDefinition.upsert({
          where: { name: item.name },
          update: {
            displayName: item.displayName,
            description: item.description,
            category: item.category,
            type: item.type,
            parameters: item.parameters as unknown as Prisma.InputJsonValue,
            requiresApproval: item.requiresApproval,
            requiresAuth: item.requiresAuth,
            isSystem: item.isSystem,
          },
          create: {
            name: item.name,
            displayName: item.displayName,
            description: item.description,
            category: item.category,
            type: item.type,
            parameters: item.parameters as unknown as Prisma.InputJsonValue,
            requiresApproval: item.requiresApproval,
            requiresAuth: item.requiresAuth,
            isSystem: item.isSystem,
          },
        })
      )
    );
    return prisma.toolDefinition.count();
  }
}
