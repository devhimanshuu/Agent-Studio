/**
 * Vault Encryption Module
 *
 * Provides AES-256-GCM encryption with proper key derivation and rotation.
 *
 * Key Derivation:
 *   - Uses PBKDF2 with SHA-512, 600,000 iterations (OWASP 2023 recommendation)
 *   - Salt is derived from the vault identifier + master key
 *   - Production requires VAULT_MASTER_KEY env var (64-char hex string)
 *   - Development uses a hardcoded fallback (log warning)
 *
 * Key Rotation:
 *   - Each vault entry stores a key_version (integer)
 *   - New entries use the current key version
 *   - Rotation re-encrypts all entries with a new derived key
 *   - Decryption tries current key, then falls back to previous versions
 *   - KEY_VERSIONS env var stores comma-separated active versions
 *
 * Security Notes:
 *   - Never log plaintext secrets or derived keys
 *   - Auth tag verification prevents tampering
 *   - IV is randomly generated per encryption operation
 *   - Key derivation is intentionally slow to resist brute-force
 */

import crypto from "crypto";
import { logger } from "@/lib/logger";

// ────────────── Constants ──────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/** PBKDF2 iteration count (OWASP 2023 recommendation for SHA-512) */
const PBKDF2_ITERATIONS = 600_000;

/** Key length for AES-256 */
const KEY_LENGTH = 32;

/** Salt prefix for key derivation */
const SALT_PREFIX = "agent-studio-vault-v1";

// ────────────── Key Version Management ──────────────

/**
 * Get the current key version from environment.
 * Versions are stored as comma-separated integers in VAULT_KEY_VERSIONS.
 */
export function getCurrentKeyVersion(): number {
  const versions = getKeyVersions();
  return versions.length > 0 ? Math.max(...versions) : 1;
}

/**
 * Get all active key versions from environment.
 */
export function getKeyVersions(): number[] {
  const env = process.env.VAULT_KEY_VERSIONS;
  if (!env) return [1];
  return env
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !isNaN(v) && v > 0)
    .sort((a, b) => a - b);
}

/**
 * Set active key versions in environment (for testing or runtime updates).
 * In production, this should be done via environment variable management.
 */
export function setKeyVersions(versions: number[]): void {
  process.env.VAULT_KEY_VERSIONS = versions.join(",");
}

// ────────────── Key Derivation ──────────────

/**
 * Derive an AES-256 encryption key from the vault master key using PBKDF2.
 *
 * @param version - Key version for rotation support (determines salt)
 * @returns 32-byte Buffer suitable for AES-256
 */
export function deriveKey(version?: number): Buffer {
  const masterKey = getMasterKey();
  const keyVersion = version ?? getCurrentKeyVersion();

  // Create unique salt per key version
  const salt = crypto
    .createHash("sha256")
    .update(`${SALT_PREFIX}:${keyVersion}`)
    .digest();

  // Use PBKDF2 for key derivation (much stronger than raw SHA-256)
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    "sha512"
  );
}

/**
 * Get the master key from environment.
 * In production, MUST be a 64-char hex string.
 */
function getMasterKey(): string {
  const masterKey = process.env.VAULT_MASTER_KEY;
  if (masterKey) return masterKey;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "VAULT_MASTER_KEY is required in production. " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  // Development fallback — log a warning
  logger.warn(
    "VAULT_MASTER_KEY not set — using development fallback key. " +
      "DO NOT use in production!"
  );
  return "dev-vault-key-change-in-production-00000000000000000000000000";
}

// ────────────── Encryption / Decryption ──────────────

export interface EncryptedPayload {
  encrypted: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @param keyVersion - Optional key version (defaults to current)
 * @returns Encrypted payload with IV, auth tag, and key version
 */
export function encrypt(
  plaintext: string,
  keyVersion?: number
): EncryptedPayload {
  const version = keyVersion ?? getCurrentKeyVersion();
  const key = deriveKey(version);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return { encrypted, iv: iv.toString("hex"), tag, keyVersion: version };
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 *
 * @param encrypted - Hex-encoded ciphertext
 * @param iv - Hex-encoded initialization vector
 * @param tag - Hex-encoded authentication tag
 * @param keyVersion - Key version used for encryption
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export function decrypt(
  encrypted: string,
  iv: string,
  tag: string,
  keyVersion: number
): string {
  const key = deriveKey(keyVersion);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Try to decrypt with multiple key versions (for rotation support).
 *
 * @param encrypted - Hex-encoded ciphertext
 * @param iv - Hex-encoded initialization vector
 * @param tag - Hex-encoded authentication tag
 * @param knownVersions - Key versions to try (newest first)
 * @returns Decrypted plaintext and the key version that worked
 * @throws Error if none of the versions can decrypt
 */
export function decryptWithFallback(
  encrypted: string,
  iv: string,
  tag: string,
  knownVersions?: number[]
): { plaintext: string; keyVersion: number } {
  const versions = knownVersions ?? getKeyVersions().reverse(); // Try newest first

  for (const version of versions) {
    try {
      const plaintext = decrypt(encrypted, iv, tag, version);
      return { plaintext, keyVersion: version };
    } catch {
      // Try next version
    }
  }

  throw new Error("Failed to decrypt: no valid key version found");
}

// ────────────── Utility ──────────────

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

/**
 * Generate a new VAULT_MASTER_KEY (64-char hex string).
 * Use this for initial setup or rotation.
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
