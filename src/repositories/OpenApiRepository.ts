import { Prisma } from "@prisma/client";
import { IOpenApiRepository } from "./interfaces/IOpenApiRepository";
import {
  CreateOpenApiIntegrationInput,
  OpenApiAuthConfig,
  OpenApiAuthType,
  OpenApiEndpointDefinition,
  OpenApiIntegrationDTO,
  OpenApiStatus,
  UpdateOpenApiIntegrationInput,
} from "@/types/openapi";
import { prisma } from "@/lib/prisma";
import { ensureUserExists } from "@/lib/user";

export class OpenApiRepository implements IOpenApiRepository {
  async findById(id: string): Promise<OpenApiIntegrationDTO | null> {
    if (!prisma.openApiIntegration) return null;
    try {
      const row = await prisma.openApiIntegration.findUnique({ where: { id } });
      return row ? this.map(row) : null;
    } catch {
      return null;
    }
  }

  async findByIdForUser(id: string, userId: string): Promise<OpenApiIntegrationDTO | null> {
    if (!prisma.openApiIntegration) return null;
    try {
      const row = await prisma.openApiIntegration.findFirst({ where: { id, userId } });
      return row ? this.map(row) : null;
    } catch {
      return null;
    }
  }

  async findByUserId(userId: string): Promise<OpenApiIntegrationDTO[]> {
    if (!prisma.openApiIntegration) return [];
    try {
      const rows = await prisma.openApiIntegration.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((row) => this.map(row));
    } catch {
      return [];
    }
  }

  async create(input: CreateOpenApiIntegrationInput): Promise<OpenApiIntegrationDTO> {
    const row = await prisma.$transaction(async (tx) => {
      await ensureUserExists(input.userId, tx);
      return tx.openApiIntegration.create({
        data: {
          userId: input.userId,
          name: input.name,
          description: input.description ?? null,
          specUrl: input.specUrl ?? null,
          rawSpec: (input.rawSpec ?? {}) as unknown as Prisma.InputJsonValue,
          baseUrl: input.baseUrl,
          authType: input.authType ?? "NONE",
          authConfig: (input.authConfig ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
          endpoints: (input.endpoints ?? []) as unknown as Prisma.InputJsonValue,
          status: "CONNECTED",
        },
      });
    });
    return this.map(row);
  }

  async update(id: string, userId: string, input: UpdateOpenApiIntegrationInput): Promise<OpenApiIntegrationDTO> {
    const existing = await prisma.openApiIntegration.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("OpenAPI integration not found or you do not have access to it");

    const row = await prisma.openApiIntegration.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl }),
        ...(input.authType !== undefined && { authType: input.authType }),
        ...(input.authConfig !== undefined && {
          authConfig: (input.authConfig as Prisma.InputJsonValue) ?? Prisma.DbNull,
        }),
        ...(input.endpoints !== undefined && {
          endpoints: input.endpoints as unknown as Prisma.InputJsonValue,
        }),
      },
    });
    return this.map(row);
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.openApiIntegration.deleteMany({ where: { id, userId } });
  }

  async updateStatus(id: string, status: OpenApiStatus, lastError?: string | null): Promise<OpenApiIntegrationDTO> {
    const row = await prisma.openApiIntegration.update({
      where: { id },
      data: {
        status,
        ...(lastError !== undefined ? { lastError } : {}),
      },
    });
    return this.map(row);
  }

  async updateEndpoints(
    id: string,
    userId: string,
    endpoints: OpenApiEndpointDefinition[]
  ): Promise<OpenApiIntegrationDTO> {
    const existing = await prisma.openApiIntegration.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("OpenAPI integration not found or you do not have access to it");

    const row = await prisma.openApiIntegration.update({
      where: { id },
      data: {
        endpoints: endpoints as unknown as Prisma.InputJsonValue,
        status: "CONNECTED",
        lastError: null,
      },
    });
    return this.map(row);
  }

  private map(row: Prisma.OpenApiIntegrationGetPayload<{}>): OpenApiIntegrationDTO {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      specUrl: row.specUrl,
      rawSpec: (row.rawSpec as Record<string, unknown>) ?? {},
      baseUrl: row.baseUrl,
      authType: row.authType as OpenApiAuthType,
      authConfig: (row.authConfig as OpenApiAuthConfig) ?? null,
      endpoints: (row.endpoints as unknown as OpenApiEndpointDefinition[]) ?? [],
      status: row.status as OpenApiStatus,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
