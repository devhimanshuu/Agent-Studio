-- AlterTable: Add keyVersion column to vault_entries
-- This column tracks which encryption key version was used for each entry.
-- Default value of 1 ensures existing entries are compatible with the key rotation system.

ALTER TABLE "vault_entries" ADD COLUMN "keyVersion" INTEGER NOT NULL DEFAULT 1;

-- Create index for efficient key version queries during rotation
CREATE INDEX "vault_entries_keyVersion_idx" ON "vault_entries"("keyVersion");
