import { IToolDefinitionRepository } from "./interfaces/IToolDefinitionRepository";
import { prisma } from "@/lib/prisma";

export class ToolDefinitionRepository implements IToolDefinitionRepository {
  async count(): Promise<number> {
    return prisma.toolDefinition.count();
  }
}
