/**
 * Server-Side Import Retry Tracker
 *
 * WHY THIS EXISTS (Security Rule: Never trust client-side state):
 *   Reading retryCount from req.body is broken — an attacker using Postman or
 *   Burp Suite will simply hardcode it to 0 on every request, bypassing the
 *   limit and exhausting NVIDIA API quota in minutes (Denial of Wallet).
 *
 *   This module tracks retries SERVER-SIDE using a keyed in-memory Map with TTL.
 *   No Redis required. Auto-cleans every 10 minutes to prevent memory leaks.
 *
 * Usage:
 *   checkAndIncrementRetry(userId, nodeId) → true = allowed, false = blocked
 *   resetRetry(userId, nodeId)             → call on successful import
 */

interface RetryRecord {
  count:     number;
  expiresAt: number;
}

const retryCache = new Map<string, RetryRecord>();

const MAX_RETRIES = 3;
const WINDOW_MS   = 15 * 60 * 1000; // 15 minutes per (userId, nodeId) pair

// Auto-cleanup: prevent unbounded memory growth in long-running processes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of retryCache.entries()) {
    if (record.expiresAt < now) retryCache.delete(key);
  }
}, 10 * 60 * 1000); // Every 10 minutes

// Allow cleanup to be stopped in tests / shutdown
cleanupInterval.unref?.();

/**
 * Check if this (userId, nodeId) pair has exceeded the retry limit.
 * Increments the counter atomically if the request is allowed.
 *
 * @returns true  — request is allowed
 * @returns false — limit exceeded, block the request with 429
 */
export function checkAndIncrementRetry(userId: string, nodeId: string): boolean {
  const key = `${userId}:${nodeId}`;
  const now = Date.now();
  const record = retryCache.get(key);

  if (record && record.expiresAt > now) {
    if (record.count >= MAX_RETRIES) return false; // ← Block
    record.count++;
    return true; // ← Allow
  }

  // First request for this pair (or TTL window expired — fresh start)
  retryCache.set(key, { count: 1, expiresAt: now + WINDOW_MS });
  return true;
}

/**
 * Reset a user's retry counter after a successful import.
 * This allows immediate re-import without waiting for the TTL window.
 */
export function resetRetry(userId: string, nodeId: string): void {
  retryCache.delete(`${userId}:${nodeId}`);
}

/** Expose current cache size for health monitoring */
export function getRetryCacheSize(): number {
  return retryCache.size;
}
