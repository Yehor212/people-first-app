/**
 * Shared sync utilities — network error detection and batch processing.
 * Extracted from realtimeSync.ts for modularity.
 */

import { isAbortError } from "@/lib/validation";

/**
 * Robust network error detection
 * Uses multiple signals instead of fragile string matching:
 * 1. navigator.onLine - browser's network status
 * 2. error.name - DOMException names like 'NetworkError'
 * 3. error.code - numeric error codes (some browsers use these)
 * 4. String patterns as fallback for edge cases
 *
 * NOTE: AbortError is NOT a network error - it's handled separately
 */
export const detectNetworkError = (error: unknown): boolean => {
  // First check: browser reports offline
  if (!navigator.onLine) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  // AbortError is NOT a network error - it's intentional cancellation
  if (isAbortError(error)) {
    return false;
  }

  // Check error name (more reliable than message)
  const networkErrorNames = [
    "NetworkError",
    "TimeoutError",
    "TypeError", // fetch failures are often TypeErrors
  ];
  if (networkErrorNames.includes(error.name)) {
    // TypeError is only network-related if it's a fetch error
    if (error.name === "TypeError") {
      return error.message.includes("fetch") || error.message.includes("network");
    }
    return true;
  }

  // Check for DOMException with network-related code
  if (error instanceof DOMException) {
    // NetworkError is code 19 in some browsers
    if (error.code === 19 || error.name === "NetworkError") {
      return true;
    }
  }

  // Fallback: check message for known patterns (case-insensitive)
  const message = error.message.toLowerCase();
  const networkPatterns = [
    "network",
    "failed to fetch",
    "fetch failed",
    "networkerror",
    "econnrefused",
    "etimedout",
    "enotfound",
    "enetunreach",
    "connection refused",
    "connection reset",
    "socket hang up",
    "dns",
  ];

  return networkPatterns.some((pattern) => message.includes(pattern));
};

export const BATCH_SIZE = 20; // Max concurrent sync operations
export const BATCH_DELAY = 50; // ms between batches

// Process array in batches to avoid overwhelming the backend
export async function processBatched<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  batchSize: number = BATCH_SIZE
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
    // Small pause between batches to avoid rate limiting
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }
}
