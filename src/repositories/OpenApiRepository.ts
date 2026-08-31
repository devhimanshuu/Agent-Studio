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
import { decrypt, encrypt } from "@/lib/vault/crypto";
import { mergeRedactedAuthConfig, redactAuthConfig } from "@/lib/secrets";

/**
 * Encrypted envelope stored in the `authConfig` JSON column. Bearer tokens /
 * API keys are AES-256-GCM encrypted with the Vault master key — previously
 * this column held plaintext secrets while the schema comment claimed
 * "Encrypted/stored".
 */
interface EncryptedAuthEnvelope {
  __enc: true;
  data: string;
  iv: string;
  tag: string;
  keyVersion?: number;
}

function isEnvelope(value: unknown): value is EncryptedAuthEnvelope {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as EncryptedAuthEnvelope).__enc === true &&
      typeof (value as EncryptedAuthEnvelope).data === "string"
  );
}

function sealAuthConfig(config: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!config || Object.keys(config).length === 0) return Prisma.DbNull;
  const { encrypted, iv, tag, keyVersion } = encrypt(JSON.stringify(config));
  return { __enc: true, data: encrypted, iv, tag, keyVersion } as unknown as Prisma.InputJsonValue;
}

function unsealAuthConfig(raw: unknown): Record<string, unknown> | null {
  if (!isEnvelope(raw)) return (raw as Record<string, unknown>) ?? null;
  try {
    return JSON.parse(decrypt(raw.data, raw.iv, raw.tag, raw.keyVersion ?? 1)) as Record<string, unknown>;
  } catch {
    // Wrong VAULT_MASTER_KEY or corrupted row — fail closed to no-auth rather
    // than leaking anything.
    return null;
  }
}

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

  /** Decrypted auth config for one user-owned integration — execution paths ONLY. */
  async getRawAuthConfigForUser(id: string, userId: string): Promise<OpenApiAuthConfig | null> {
    if (!prisma.openApiIntegration) return null;
    try {
      const row = await prisma.openApiIntegration.findFirst({
        where: { id, userId },
        select: { authConfig: true },
      });
      return (unsealAuthConfig(row?.authConfig) as OpenApiAuthConfig) ?? null;
    } catch {
      return null;
    }
  }

  async findByUserId(userId: string, limit?: number): Promise<OpenApiIntegrationDTO[]> {
    if (!prisma.openApiIntegration) return [];
    try {
      const rows = await prisma.openApiIntegration.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        ...(limit && limit > 0 ? { take: Math.min(limit, 200) } : {}),
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
          authConfig: sealAuthConfig(input.authConfig as unknown as Record<string, unknown>),
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

    let sealed: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined;
    if (input.authConfig !== undefined) {
      const existingPlain = unsealAuthConfig(existing.authConfig);
      const merged = input.authConfig
        ? mergeRedactedAuthConfig(existingPlain, input.authConfig as Partial<OpenApiAuthConfig> as Partial<Record<string, unknown>> & Record<string, unknown>)
        : null;
      sealed = merged
        ? sealAuthConfig(merged)
        : Prisma.DbNull;
    }

    const row = await prisma.openApiIntegration.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl }),
        ...(input.authType !== undefined && { authType: input.authType }),
        ...(sealed !== undefined && {
          authConfig: sealed as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
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
      // DTO carries the MASKED config — secret fields are `__REDACTED__`
      // sentinels that the update path treats as "keep existing".
      authConfig: redactAuthConfig(unsealAuthConfig(row.authConfig)) as OpenApiAuthConfig | null,
      endpoints: (row.endpoints as unknown as OpenApiEndpointDefinition[]) ?? [],
      status: row.status as OpenApiStatus,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
