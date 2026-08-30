/**
 * API Key Service
 *
 * Manages per-organization API keys for programmatic access.
 * Keys are hashed before storage - only the prefix and hash are stored.
 */

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { RBACService, ForbiddenError } from "./RBACService";
import { AuditService } from "./AuditService";

// ────────────── Types ──────────────

export interface ApiKeyDTO {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  createdBy: string;
}

export interface CreateApiKeyInput {
  name: string;
  scopes?: string[];
  expiresAt?: Date;
}

export interface ApiKeyWithSecret extends ApiKeyDTO {
  secret: string; // Only returned on creation
}

// ────────────── Constants ──────────────

const KEY_PREFIX = "as"; // Agent Studio prefix
const KEY_LENGTH = 48; // bytes
const KEY_VERSION = 1;

// ────────────── Service ──────────────

export class ApiKeyService {
  private rbacService: RBACService;
  private auditService: AuditService;

  constructor() {
    this.rbacService = new RBACService();
    this.auditService = new AuditService();
  }

  /**
   * Generate a new API key
   * Returns the full key only on creation - never stored or retrievable
   */
  async create(
    userId: string,
    organizationId: string,
    input: CreateApiKeyInput
  ): Promise<ApiKeyWithSecret> {
    // Check permission
    const permissions = await this.rbacService.getUserOrgPermissions(userId, organizationId);
    if (!permissions.canManageSettings) {
      throw new ForbiddenError("Only admins and owners can create API keys");
    }

    // Generate key
    const rawKey = this.generateRawKey();
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);

    // Store key
    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId,
        name: input.name,
        keyHash,
        keyPrefix,
        scopes: input.scopes || ["*"],
        expiresAt: input.expiresAt,
        createdBy: userId,
      },
    });

    // Log audit event
    await this.auditService.logApiKeyCreated({
      userId,
      organizationId,
      keyId: apiKey.id,
      keyName: input.name,
    });

    logger.info({ keyId: apiKey.id, organizationId, userId }, "API key created");

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes as string[],
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      createdBy: apiKey.createdBy,
      secret: rawKey, // Only returned once
    };
  }

  /**
   * List API keys for an organization
   */
  async list(
    userId: string,
    organizationId: string
  ): Promise<ApiKeyDTO[]> {
    // Check membership
    const membership = await this.rbacService.getOrgMembership(userId, organizationId);
    if (!membership) {
      throw new ForbiddenError("Not a member of this organization");
    }

    const keys = await prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes as string[],
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      createdBy: key.createdBy,
    }));
  }

  /**
   * Delete an API key
   */
  async delete(
    userId: string,
    organizationId: string,
    keyId: string
  ): Promise<void> {
    // Check permission
    const permissions = await this.rbacService.getUserOrgPermissions(userId, organizationId);
    if (!permissions.canManageSettings) {
      throw new ForbiddenError("Only admins and owners can delete API keys");
    }

    const key = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!key || key.organizationId !== organizationId) {
      throw new Error("API key not found");
    }

    // Log audit event
    await this.auditService.logApiKeyDeleted({
      userId,
      organizationId,
      keyId,
    });

    await prisma.apiKey.delete({
      where: { id: keyId },
    });

    logger.info({ keyId, organizationId, userId }, "API key deleted");
  }

  /**
   * Validate an API key and return its metadata
   * Used by authentication middleware
   */
  async validateKey(apiKey: string): Promise<{
    valid: boolean;
    organizationId?: string;
    scopes?: string[];
    keyId?: string;
  }> {
    // Extract prefix for quick lookup
    const prefix = apiKey.substring(0, 8);

    // Find keys with matching prefix
    const possibleKeys = await prisma.apiKey.findMany({
      where: { keyPrefix: prefix },
    });

    // Check each possible key
    for (const storedKey of possibleKeys) {
      const hash = this.hashKey(apiKey);
      if (hash === storedKey.keyHash) {
        // Check expiration
        if (storedKey.expiresAt && storedKey.expiresAt < new Date()) {
          return { valid: false };
        }

        // Update lastUsedAt
        await prisma.apiKey.update({
          where: { id: storedKey.id },
          data: { lastUsedAt: new Date() },
        });

        return {
          valid: true,
          organizationId: storedKey.organizationId,
          scopes: storedKey.scopes as string[],
          keyId: storedKey.id,
        };
      }
    }

    return { valid: false };
  }

  /**
   * Revoke all API keys for an organization
   * Used when transferring ownership or security incident
   */
  async revokeAll(
    userId: string,
    organizationId: string
  ): Promise<number> {
    // Only owners can revoke all keys
    const permissions = await this.rbacService.getUserOrgPermissions(userId, organizationId);
    if (!permissions.canDeleteOrg) {
      throw new ForbiddenError("Only owners can revoke all API keys");
    }

    const result = await prisma.apiKey.deleteMany({
      where: { organizationId },
    });

    // Log audit event
    await this.auditService.log({
      action: "API_KEYS_REVOKED",
      userId,
      organizationId,
      resourceType: "api_key",
      details: { count: result.count },
    });

    logger.info({ organizationId, userId, count: result.count }, "All API keys revoked");

    return result.count;
  }

  // ────────────── Helpers ──────────────

  /**
   * Generate a raw API key
   * Format: as_{version}_{random}
   */
  private generateRawKey(): string {
    const random = crypto.randomBytes(KEY_LENGTH).toString("base64url");
    return `${KEY_PREFIX}_${KEY_VERSION}_${random}`.substring(0, 64);
  }

  /**
   * Hash an API key for storage
   * Uses SHA-256 with a salt derived from the key prefix
   */
  private hashKey(key: string): string {
    const prefix = key.substring(0, 8);
    const salt = crypto.createHash("sha256").update(prefix).digest();
    return crypto.createHash("sha256").update(`${salt.toString("hex")}:${key}`).digest("hex");
  }
}
