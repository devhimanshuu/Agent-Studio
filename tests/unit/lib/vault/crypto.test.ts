/**
 * Unit tests for vault encryption module.
 *
 * Tests key derivation, encryption/decryption, key rotation,
 * and security properties.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encrypt,
  decrypt,
  decryptWithFallback,
  deriveKey,
  maskSecret,
  generateMasterKey,
  getCurrentKeyVersion,
  getKeyVersions,
  setKeyVersions,
} from "@/lib/vault/crypto";

describe("Vault Crypto", () => {
  // Save and restore environment
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set up test environment
    process.env.VAULT_MASTER_KEY = generateMasterKey();
    process.env.VAULT_KEY_VERSIONS = "1";
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  // ────────────── Key Generation ──────────────

  describe("generateMasterKey", () => {
    it("generates a 64-character hex string", () => {
      const key = generateMasterKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    });

    it("generates unique keys each time", () => {
      const key1 = generateMasterKey();
      const key2 = generateMasterKey();
      expect(key1).not.toBe(key2);
    });
  });

  // ────────────── Key Derivation ──────────────

  describe("deriveKey", () => {
    it("derives a 32-byte key", () => {
      const key = deriveKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it("derives deterministic keys from same input", () => {
      const key1 = deriveKey(1);
      const key2 = deriveKey(1);
      expect(key1.equals(key2)).toBe(true);
    });

    it("derives different keys for different versions", () => {
      const key1 = deriveKey(1);
      const key2 = deriveKey(2);
      expect(key1.equals(key2)).toBe(false);
    });

    it("derives different keys with different master keys", () => {
      process.env.VAULT_MASTER_KEY = generateMasterKey();
      const key1 = deriveKey(1);

      process.env.VAULT_MASTER_KEY = generateMasterKey();
      const key2 = deriveKey(1);

      expect(key1.equals(key2)).toBe(false);
    });
  });

  // ────────────── Encryption / Decryption ──────────────

  describe("encrypt/decrypt", () => {
    it("encrypts and decrypts plaintext correctly", () => {
      const plaintext = "my-secret-api-key-12345";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag, encrypted.keyVersion);

      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertext for same plaintext (random IV)", () => {
      const plaintext = "same-secret";
      const enc1 = encrypt(plaintext);
      const enc2 = encrypt(plaintext);

      // Different IVs produce different ciphertexts
      expect(enc1.encrypted).not.toBe(enc2.encrypted);
      expect(enc1.iv).not.toBe(enc2.iv);

      // But both decrypt to the same plaintext
      expect(decrypt(enc1.encrypted, enc1.iv, enc1.tag, enc1.keyVersion)).toBe(plaintext);
      expect(decrypt(enc2.encrypted, enc2.iv, enc2.tag, enc2.keyVersion)).toBe(plaintext);
    });

    it("includes key version in encrypted payload", () => {
      const plaintext = "test";
      const encrypted = encrypt(plaintext, 3);

      expect(encrypted.keyVersion).toBe(3);
    });

    it("fails to decrypt with wrong key version", () => {
      const plaintext = "secret";
      const encrypted = encrypt(plaintext, 1);

      expect(() => {
        decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag, 2);
      }).toThrow();
    });

    it("fails to decrypt with tampered ciphertext", () => {
      const plaintext = "secret";
      const encrypted = encrypt(plaintext);

      // Tamper with ciphertext
      const tampered = encrypted.encrypted.slice(0, -2) + "ff";
      expect(() => {
        decrypt(tampered, encrypted.iv, encrypted.tag, encrypted.keyVersion);
      }).toThrow();
    });

    it("fails to decrypt with tampered auth tag", () => {
      const plaintext = "secret";
      const encrypted = encrypt(plaintext);

      // Tamper with auth tag
      const tampered = encrypted.tag.slice(0, -2) + "ff";
      expect(() => {
        decrypt(encrypted.encrypted, encrypted.iv, tampered, encrypted.keyVersion);
      }).toThrow();
    });

    it("handles empty string", () => {
      const plaintext = "";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag, encrypted.keyVersion);

      expect(decrypted).toBe(plaintext);
    });

    it("handles unicode characters", () => {
      const plaintext = "🔑 secret-كلمة-סיסמה-秘密";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag, encrypted.keyVersion);

      expect(decrypted).toBe(plaintext);
    });

    it("handles long strings", () => {
      const plaintext = "x".repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag, encrypted.keyVersion);

      expect(decrypted).toBe(plaintext);
    });
  });

  // ────────────── Key Rotation ──────────────

  describe("Key Rotation", () => {
    it("decryptWithFallback tries multiple versions", () => {
      // Encrypt with version 1
      const plaintext = "rotation-test";
      const encrypted = encrypt(plaintext, 1);

      // Add version 1 and 2 to active versions
      setKeyVersions([1, 2]);

      // Should decrypt with version 1
      const result = decryptWithFallback(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.tag,
        [2, 1] // Try newest first
      );

      expect(result.plaintext).toBe(plaintext);
      expect(result.keyVersion).toBe(1);
    });

    it("decryptWithFallback fails if no version works", () => {
      const plaintext = "test";
      const encrypted = encrypt(plaintext, 1);

      // Only try version 2 (which wasn't used)
      expect(() => {
        decryptWithFallback(
          encrypted.encrypted,
          encrypted.iv,
          encrypted.tag,
          [2]
        );
      }).toThrow("Failed to decrypt");
    });

    it("re-encryption with new version works", async () => {
      // This test involves multiple PBKDF2 derivations which are slow
      const plaintext = "re-encrypt-test";

      // Encrypt with version 1
      const enc1 = encrypt(plaintext, 1);

      // Decrypt with version 1
      const dec1 = decrypt(enc1.encrypted, enc1.iv, enc1.tag, 1);
      expect(dec1).toBe(plaintext);

      // Re-encrypt with version 2
      const enc2 = encrypt(dec1, 2);

      // Decrypt with version 2
      const dec2 = decrypt(enc2.encrypted, enc2.iv, enc2.tag, 2);
      expect(dec2).toBe(plaintext);

      // Old version can't decrypt new encryption
      expect(() => {
        decrypt(enc2.encrypted, enc2.iv, enc2.tag, 1);
      }).toThrow();
    }, 10000); // 10 second timeout for PBKDF2 operations
  });

  // ────────────── Key Version Management ──────────────

  describe("Key Version Management", () => {
    it("getCurrentKeyVersion returns max version", () => {
      setKeyVersions([1, 3, 2]);
      expect(getCurrentKeyVersion()).toBe(3);
    });

    it("getKeyVersions returns sorted versions", () => {
      setKeyVersions([3, 1, 2]);
      expect(getKeyVersions()).toEqual([1, 2, 3]);
    });

    it("defaults to version 1 if no versions set", () => {
      delete process.env.VAULT_KEY_VERSIONS;
      expect(getCurrentKeyVersion()).toBe(1);
      expect(getKeyVersions()).toEqual([1]);
    });
  });

  // ────────────── Masking ──────────────

  describe("maskSecret", () => {
    it("masks short strings (<=8 chars)", () => {
      // Shows first 2 chars, masks rest
      expect(maskSecret("abcdef")).toBe("ab****");
    });

    it("masks medium strings (9-16 chars)", () => {
      // Shows first 4 and last 4, masks middle
      expect(maskSecret("abcdefghijklmnop")).toBe("abcd********mnop");
    });

    it("masks long strings (>16 chars)", () => {
      // Shows first 4 and last 4, masks 12 chars
      expect(maskSecret("abcdefghijklmnopqrst")).toBe("abcd************qrst");
    });

    it("handles very short strings", () => {
      expect(maskSecret("ab")).toBe("ab");
      expect(maskSecret("a")).toBe("a");
    });

    it("handles exactly 8 characters", () => {
      // 8 chars shows first 2 + 6 asterisks
      expect(maskSecret("12345678")).toBe("12******");
    });
  });

  // ────────────── Production Safety ──────────────

  describe("Production Safety", () => {
    it("throws in production without VAULT_MASTER_KEY", () => {
      process.env.NODE_ENV = "production";
      delete process.env.VAULT_MASTER_KEY;

      expect(() => deriveKey()).toThrow("VAULT_MASTER_KEY is required in production");
    });

    it("uses fallback in development without VAULT_MASTER_KEY", () => {
      process.env.NODE_ENV = "development";
      delete process.env.VAULT_MASTER_KEY;

      // Should not throw
      const key = deriveKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });
  });
});
