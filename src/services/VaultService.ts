import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// ────────────── Encryption Config ──────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * Derive an encryption key from the vault master key.
 * `VAULT_MASTER_KEY` MUST be a 64-char hex string in production — booting
 * without it refuses to encrypt/decrypt rather than silently using the public
 * repo constant (which would make every "encrypted" secret world-readable).
 * The fallback exists ONLY for local development.
 */
function getEncryptionKey(): Buffer {
  const masterKey = process.env.VAULT_MASTER_KEY;
  if (masterKey) return crypto.createHash("sha256").update(masterKey).digest();
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "VAULT_MASTER_KEY is required in production — refusing to derive vault keys from the development fallback."
    );
  }
  return crypto.createHash("sha256").update("dev-vault-key-change-in-production-00000000000000000000000000").digest();
}

// ────────────── Encryption / Decryption ──────────────

export function encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return { encrypted, iv: iv.toString("hex"), tag };
}

export function decrypt(encrypted: string, iv: string, tag: string): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Mask a secret value for display: shows first 4 and last 4 chars,
 * with asterisks in between.
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) {
    return value.slice(0, 2) + "*".repeat(Math.max(0, value.length - 2));
  }
  if (value.length <= 16) {
    return value.slice(0, 4) + "*".repeat(value.length - 8) + value.slice(-4);
  }
  return value.slice(0, 4) + "*".repeat(12) + value.slice(-4);
}

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

export interface VaultEntryDTO {
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

    return decrypt(entry.value, entry.iv, entry.tag);
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
      result[entry.key] = decrypt(entry.value, entry.iv, entry.tag);
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

    const { encrypted, iv, tag } = encrypt(input.value);

    const entry = await prisma.vaultEntry.create({
      data: {
        userId,
        name: input.name,
        category: (input.category || "API_KEY") as never,
        key: input.key,
        value: encrypted,
        iv,
        tag,
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

    // Re-encrypt if value changed
    if (input.value !== undefined) {
      const { encrypted, iv, tag } = encrypt(input.value);
      updateData.value = encrypted;
      updateData.iv = iv;
      updateData.tag = tag;
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
    const rawValue = decrypt(entry.value, entry.iv, entry.tag);
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      key: entry.key,
      value: maskSecret(rawValue),
      description: entry.description,
      tags: entry.tags,
      lastUsedAt: entry.lastUsedAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
