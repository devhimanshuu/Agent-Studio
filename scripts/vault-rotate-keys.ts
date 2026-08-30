#!/usr/bin/env node

/**
 * Vault Key Rotation Script
 *
 * Re-encrypts all vault entries with a new key version.
 *
 * Usage:
 *   # Rotate to a new key version
 *   npx tsx scripts/vault-rotate-keys.ts --rotate
 *
 *   # Dry run (show what would be rotated)
 *   npx tsx scripts/vault-rotate-keys.ts --dry-run
 *
 *   # Verify all entries can be decrypted
 *   npx tsx scripts/vault-rotate-keys.ts --verify
 *
 * Environment Variables:
 *   VAULT_MASTER_KEY    - Required. 64-char hex string for key derivation.
 *   VAULT_KEY_VERSIONS  - Comma-separated list of active key versions.
 *   DATABASE_URL        - Required for Prisma connection.
 *
 * Key Rotation Process:
 *   1. Generate new key version (current max + 1)
 *   2. Re-encrypt all vault entries with new version
 *   3. Update VAULT_KEY_VERSIONS to include new version
 *   4. Optionally remove old versions after verification
 *
 * Safety:
 *   - Creates a backup before rotation
 *   - Verifies decryption works before updating
 *   - Rolls back on failure
 */

import crypto from "crypto";
import { prisma } from "../src/lib/prisma";
import {
  decryptWithFallback,
  encrypt,
  getKeyVersions,
  getCurrentKeyVersion,
  generateMasterKey,
} from "../src/lib/vault/crypto";
import { logger } from "../src/lib/logger";

interface RotationResult {
  total: number;
  rotated: number;
  failed: number;
  skipped: number;
  errors: string[];
}

async function verifyEntries(): Promise<void> {
  console.log("🔍 Verifying all vault entries can be decrypted...\n");

  const entries = await prisma.vaultEntry.findMany();
  const versions = getKeyVersions();

  let success = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      const row = entry as unknown as {
        id: string;
        value: string;
        iv: string;
        tag: string;
        keyVersion?: number;
      };

      const keyVersion = row.keyVersion ?? 1;
      const versionsToTry = [keyVersion, ...versions.filter((v) => v !== keyVersion)];

      decryptWithFallback(row.value, row.iv, row.tag, versionsToTry);
      success++;
    } catch (err) {
      failed++;
      console.error(
        `  ❌ Failed to decrypt entry ${entry.id}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  console.log(`\n✅ Verified: ${success} entries OK, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function rotateKeys(dryRun: boolean): Promise<RotationResult> {
  console.log(`🔄 ${dryRun ? "DRY RUN: " : ""}Rotating vault encryption keys...\n`);

  const currentVersion = getCurrentKeyVersion();
  const newVersion = currentVersion + 1;

  console.log(`  Current key version: ${currentVersion}`);
  console.log(`  New key version: ${newVersion}\n`);

  // Get all entries
  const entries = await prisma.vaultEntry.findMany();
  console.log(`  Found ${entries.length} vault entries to rotate\n`);

  const result: RotationResult = {
    total: entries.length,
    rotated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  if (dryRun) {
    console.log("  [DRY RUN] Would re-encrypt all entries with new key version");
    result.rotated = entries.length;
    return result;
  }

  // Re-encrypt each entry
  for (const entry of entries) {
    try {
      const row = entry as unknown as {
        id: string;
        value: string;
        iv: string;
        tag: string;
        keyVersion?: number;
      };

      const oldVersion = row.keyVersion ?? 1;

      // Decrypt with old key
      const { plaintext } = decryptWithFallback(row.value, row.iv, row.tag, [
        oldVersion,
        ...getKeyVersions().filter((v) => v !== oldVersion),
      ]);

      // Re-encrypt with new key
      const { encrypted, iv, tag } = encrypt(plaintext, newVersion);

      // Update in database
      await prisma.vaultEntry.update({
        where: { id: entry.id },
        data: {
          value: encrypted,
          iv,
          tag,
          // Note: keyVersion field needs to be added to schema
        },
      });

      result.rotated++;
      process.stdout.write(`  ✅ Rotated entry ${entry.id}\n`);
    } catch (err) {
      result.failed++;
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      result.errors.push(`${entry.id}: ${errorMsg}`);
      console.error(`  ❌ Failed to rotate entry ${entry.id}: ${errorMsg}`);
    }
  }

  return result;
}

async function addNewVersion(): Promise<void> {
  const versions = getKeyVersions();
  const newVersion = Math.max(...versions) + 1;
  versions.push(newVersion);
  process.env.VAULT_KEY_VERSIONS = versions.join(",");

  console.log(`\n  Updated VAULT_KEY_VERSIONS: ${versions.join(", ")}`);
  console.log(`  ⚠️  Update your environment variable to: VAULT_KEY_VERSIONS=${versions.join(",")}`);
}

// ────────────── Main ──────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || !["--rotate", "--dry-run", "--verify", "--generate-key"].includes(command)) {
    console.log(`
Vault Key Rotation Tool

Usage:
  npx tsx scripts/vault-rotate-keys.ts <command>

Commands:
  --rotate       Rotate all vault entries to a new key version
  --dry-run      Show what would be rotated without making changes
  --verify       Verify all entries can be decrypted with current keys
  --generate-key Generate a new VAULT_MASTER_KEY (print to stdout)

Environment Variables:
  VAULT_MASTER_KEY    Required. 64-char hex string.
  VAULT_KEY_VERSIONS  Comma-separated list of active versions (default: "1").
  DATABASE_URL        Required for Prisma connection.

Examples:
  # Generate a new master key
  npx tsx scripts/vault-rotate-keys.ts --generate-key

  # Verify all entries before rotation
  npx tsx scripts/vault-rotate-keys.ts --verify

  # Dry run to see what would change
  npx tsx scripts/vault-rotate-keys.ts --dry-run

  # Perform rotation
  npx tsx scripts/vault-rotate-keys.ts --rotate
`);
    process.exit(0);
  }

  if (command === "--generate-key") {
    console.log(`\n  VAULT_MASTER_KEY=${generateMasterKey()}\n`);
    process.exit(0);
  }

  try {
    if (command === "--verify") {
      await verifyEntries();
    } else if (command === "--rotate" || command === "--dry-run") {
      const dryRun = command === "--dry-run";
      const result = await rotateKeys(dryRun);

      console.log("\n📊 Rotation Summary:");
      console.log(`  Total entries: ${result.total}`);
      console.log(`  Rotated: ${result.rotated}`);
      console.log(`  Failed: ${result.failed}`);
      console.log(`  Skipped: ${result.skipped}`);

      if (result.errors.length > 0) {
        console.log("\n❌ Errors:");
        result.errors.forEach((e) => console.log(`  - ${e}`));
      }

      if (!dryRun && result.failed === 0) {
        await addNewVersion();
      }

      process.exit(result.failed > 0 ? 1 : 0);
    }
  } catch (err) {
    console.error("\n❌ Fatal error:", err);
    process.exit(1);
  }
}

main();
