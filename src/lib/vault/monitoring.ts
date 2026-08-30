/**
 * Vault Monitoring Module
 *
 * Tracks and alerts on decryption failures, which may indicate:
 * - Corrupted data
 * - Wrong master key
 * - Key rotation issues
 * - Tampered ciphertext
 */

import { logger } from "@/lib/logger";

interface DecryptionFailure {
  entryId: string;
  userId?: string;
  key?: string;
  error: string;
  timestamp: Date;
  keyVersion?: number;
}

// In-memory ring buffer for recent failures (last 100)
const recentFailures: DecryptionFailure[] = [];
const MAX_FAILURES = 100;

// Alert thresholds
const ALERT_THRESHOLD_5MIN = 10; // 10 failures in 5 minutes
const ALERT_THRESHOLD_1HOUR = 50; // 50 failures in 1 hour

let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between alerts

/**
 * Record a decryption failure for monitoring.
 */
export function recordDecryptionFailure(params: {
  entryId: string;
  userId?: string;
  key?: string;
  error: unknown;
  keyVersion?: number;
}): void {
  const failure: DecryptionFailure = {
    entryId: params.entryId,
    userId: params.userId,
    key: params.key,
    error: params.error instanceof Error ? params.error.message : String(params.error),
    timestamp: new Date(),
    keyVersion: params.keyVersion,
  };

  // Add to ring buffer
  recentFailures.push(failure);
  if (recentFailures.length > MAX_FAILURES) {
    recentFailures.shift();
  }

  // Log the failure
  logger.error(
    {
      entryId: params.entryId,
      userId: params.userId,
      keyVersion: params.keyVersion,
      error: failure.error,
    },
    "Vault decryption failure"
  );

  // Check if we should alert
  checkAlertThresholds();
}

/**
 * Check if failure rate exceeds thresholds and alert.
 */
function checkAlertThresholds(): void {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  const recentCount = recentFailures.filter(
    (f) => f.timestamp.getTime() > fiveMinutesAgo
  ).length;

  const hourlyCount = recentFailures.filter(
    (f) => f.timestamp.getTime() > oneHourAgo
  ).length;

  // Check cooldown
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) {
    return;
  }

  if (recentCount >= ALERT_THRESHOLD_5MIN) {
    logger.fatal(
      { recentCount, hourlyCount },
      "CRITICAL: Vault decryption failure rate exceeded threshold"
    );
    lastAlertTime = now;
    // In production, this would trigger PagerDuty/Slack/etc.
  } else if (hourlyCount >= ALERT_THRESHOLD_1HOUR) {
    logger.error(
      { recentCount, hourlyCount },
      "WARNING: Vault decryption failure rate elevated"
    );
    lastAlertTime = now;
  }
}

/**
 * Get recent decryption failures for diagnostics.
 */
export function getRecentFailures(limit = 20): DecryptionFailure[] {
  return recentFailures.slice(-limit);
}

/**
 * Get failure statistics.
 */
export function getFailureStats(): {
  total: number;
  last5Minutes: number;
  lastHour: number;
  uniqueEntries: number;
} {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  const uniqueEntries = new Set(recentFailures.map((f) => f.entryId));

  return {
    total: recentFailures.length,
    last5Minutes: recentFailures.filter((f) => f.timestamp.getTime() > fiveMinutesAgo).length,
    lastHour: recentFailures.filter((f) => f.timestamp.getTime() > oneHourAgo).length,
    uniqueEntries: uniqueEntries.size,
  };
}

/**
 * Clear failure history (for testing).
 */
export function clearFailureHistory(): void {
  recentFailures.length = 0;
  lastAlertTime = 0;
}
