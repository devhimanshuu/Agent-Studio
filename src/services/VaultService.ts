import { prisma } from "@/lib/prisma";
import {
  encrypt as encryptPayload,
  decryptWithFallback,
  maskSecret,
  getCurrentKeyVersion,
  getKeyVersions,
} from "@/lib/vault/crypto";
import { recordDecryptionFailure } from "@/lib/vault/monitoring";

// ────────────── Types ──────────────

export type VaultCategory = "API_KEY" | "OAUTH_TOKEN" | "DATABASE_URL" | "CONNECTION_STRING" | "PASSWORD" | "CERTIFICATE" | "WEBHOOK_SECRET" | "OTHER";

export interface VaultEntryInput {
  name: string;
  category?: VaultCategory;
  key: string;
  value: string;
  description?: string;
  tags?: string[];
}

interface VaultEntryDTO {
  id: string;
  name: string;
  category: VaultCategory;
  key: string;
  value: string; // masked
  description: string | null;
  tags: string[];
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Internal DB row type (matches Prisma VaultEntry)
interface VaultRow {
  id: string;
  userId: string;
  name: string;
  category: VaultCategory;
  key: string;
  value: string;
  iv: string;
  tag: string;
  keyVersion?: number; // Optional for backward compatibility with pre-rotation entries
  description: string | null;
  tags: string[];
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ────────────── Service ──────────────

export class VaultService {
  /**
   * List all vault entries for a user (values are masked).
   */
  async list(userId: string): Promise<VaultEntryDTO[]> {
    const entries = await prisma.vaultEntry.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }) as unknown as VaultRow[];

    return entries.map((e) => this.toDTO(e));
  }

  /**
   * Get a single vault entry by ID (value is masked).
   */
  async getById(userId: string, id: string): Promise<VaultEntryDTO | null> {
    const entry = await prisma.vaultEntry.findFirst({
      where: { id, userId },
    }) as unknown as VaultRow | null;
    if (!entry) return null;
    return this.toDTO(entry);
  }

  /**
   * Get a vault entry's raw (decrypted) value.
   * Used by the execution engine to inject secrets into skill runs.
   */
  async getRawValue(userId: string, key: string): Promise<string | null> {
    const entry = await prisma.vaultEntry.findFirst({
      where: { userId, key },
    }) as unknown as VaultRow | null;
    if (!entry) return null;

    // Update lastUsedAt
    await prisma.vaultEntry.update({
      where: { id: entry.id },
      data: { lastUsedAt: new Date() },
    });

    // Handle entries without keyVersion (pre-rotation entries)
    const keyVersion = entry.keyVersion ?? 1;
    const { plaintext } = decryptWithFallback(
      entry.value,
      entry.iv,
      entry.tag,
      [keyVersion, ...getKeyVersions().filter(v => v !== keyVersion)]
    );
    return plaintext;
  }

  /**
   * Get multiple raw values by keys (for bulk injection).
   */
  async getRawValues(userId: string, keys: string[]): Promise<Record<string, string>> {
    const entries = await prisma.vaultEntry.findMany({
      where: { userId, key: { in: keys } },
    }) as unknown as VaultRow[];

    const result: Record<string, string> = {};
    const idsToUpdate: string[] = [];

    for (const entry of entries) {
      // Handle entries without keyVersion (pre-rotation entries)
      const keyVersion = entry.keyVersion ?? 1;
      const { plaintext } = decryptWithFallback(
        entry.value,
        entry.iv,
        entry.tag,
        [keyVersion, ...getKeyVersions().filter(v => v !== keyVersion)]
      );
      result[entry.key] = plaintext;
      idsToUpdate.push(entry.id);
    }

    // Batch update lastUsedAt
    if (idsToUpdate.length > 0) {
      await prisma.vaultEntry.updateMany({
        where: { id: { in: idsToUpdate } },
        data: { lastUsedAt: new Date() },
      });
    }

    return result;
  }

  /**
   * Create a new vault entry.
   */
  async create(userId: string, input: VaultEntryInput): Promise<VaultEntryDTO> {
    // Check for duplicate key
    const existing = await prisma.vaultEntry.findFirst({
      where: { userId, key: input.key },
    });
    if (existing) {
      throw new Error(`A vault entry with key "${input.key}" already exists`);
    }

    const keyVersion = getCurrentKeyVersion();
    const { encrypted, iv, tag } = encryptPayload(input.value, keyVersion);

    const entry = await prisma.vaultEntry.create({
      data: {
        userId,
        name: input.name,
        category: (input.category || "API_KEY") as never,
        key: input.key,
        value: encrypted,
        iv,
        tag,
        keyVersion,
        description: input.description || null,
        tags: input.tags || [],
      },
    }) as unknown as VaultRow;

    return this.toDTO(entry);
  }

  /**
   * Update an existing vault entry.
   */
  async update(
    userId: string,
    id: string,
    input: Partial<VaultEntryInput>
  ): Promise<VaultEntryDTO> {
    const existing = await prisma.vaultEntry.findFirst({
      where: { id, userId },
    }) as unknown as VaultRow | null;
    if (!existing) {
      throw new Error("Vault entry not found");
    }

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.tags !== undefined) updateData.tags = input.tags;

    // Re-encrypt if value changed (use current key version)
    if (input.value !== undefined) {
      const keyVersion = getCurrentKeyVersion();
      const { encrypted, iv, tag } = encryptPayload(input.value, keyVersion);
      updateData.value = encrypted;
      updateData.iv = iv;
      updateData.tag = tag;
      updateData.keyVersion = keyVersion;
    }

    // Check key uniqueness if changing
    if (input.key !== undefined && input.key !== existing.key) {
      const dup = await prisma.vaultEntry.findFirst({
        where: { userId, key: input.key, id: { not: id } },
      });
      if (dup) {
        throw new Error(`A vault entry with key "${input.key}" already exists`);
      }
      updateData.key = input.key;
    }

    const entry = await prisma.vaultEntry.update({
      where: { id },
      data: updateData,
    }) as unknown as VaultRow;

    return this.toDTO(entry);
  }

  /**
   * Delete a vault entry.
   */
  async delete(userId: string, id: string): Promise<void> {
    const existing = await prisma.vaultEntry.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new Error("Vault entry not found");
    }

    await prisma.vaultEntry.delete({ where: { id } });
  }

  /**
   * Search vault entries by name, key, or tags.
   */
  async search(userId: string, query: string): Promise<VaultEntryDTO[]> {
    const entries = await prisma.vaultEntry.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { key: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { tags: { has: query } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    }) as unknown as VaultRow[];

    return entries.map((e) => this.toDTO(e));
  }

  /**
   * Get vault entries that match a list of required keys
   * (used to check which secrets a skill needs).
   */
  async getMatchingEntries(
    userId: string,
    requiredKeys: string[]
  ): Promise<{ found: VaultEntryDTO[]; missing: string[] }> {
    const entries = await prisma.vaultEntry.findMany({
      where: { userId, key: { in: requiredKeys } },
    }) as unknown as VaultRow[];

    const foundKeys = new Set(entries.map((e) => e.key));
    const missing = requiredKeys.filter((k) => !foundKeys.has(k));

    return {
      found: entries.map((e) => this.toDTO(e)),
      missing,
    };
  }

  /**
   * Export vault entries (encrypted) for backup.
   */
  async export(userId: string): Promise<VaultRow[]> {
    return prisma.vaultEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }) as unknown as VaultRow[];
  }

  /**
   * Convert a DB entry to a DTO with masked value.
   */
  private toDTO(entry: VaultRow): VaultEntryDTO {
    // A single corrupted ciphertext/iv/tag row must not take down the whole
    // list — surface it as an unreadable entry (still safe: never the raw
    // value) instead of throwing and 500ing every other entry with it.
    let maskedValue: string;
    try {
      // Handle entries without keyVersion (pre-rotation entries)
      const keyVersion = entry.keyVersion ?? 1;
      const { plaintext } = decryptWithFallback(
        entry.value,
        entry.iv,
        entry.tag,
        [keyVersion, ...getKeyVersions().filter(v => v !== keyVersion)]
      );
      maskedValue = maskSecret(plaintext);
    } catch (err) {
      // Record failure for monitoring
      recordDecryptionFailure({
        entryId: entry.id,
        key: entry.key,
        error: err,
        keyVersion: entry.keyVersion,
      });
      maskedValue = "••• (unreadable — corrupted or re-keyed)";
    }

    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      key: entry.key,
      value: maskedValue,
      description: entry.description,
      tags: entry.tags,
      lastUsedAt: entry.lastUsedAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
