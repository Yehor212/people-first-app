import { lazy, ComponentType } from "react";
import { forceHardReload, markForVersionCheck } from "./versionCheck";
import { logger } from "@/lib/logger";
import { SSK } from "@/lib/storageKeys";
import { retryWithBackoff } from "@/lib/retry";

type ImportFn<T> = () => Promise<{ default: T }>;

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

/** Recognize Vite chunk-load errors — used to classify retryable vs not. */
function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    (error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Importing a module script failed") ||
      error.message.includes("Loading chunk") ||
      error.message.includes("Loading CSS chunk"))
  );
}

/**
 * Wrapper around React.lazy() that handles chunk loading failures.
 *
 * After deployment, users with cached old index.html may try to load
 * non-existent chunk files (hash changed). This wrapper:
 * 1. Retries failed chunk loads up to MAX_RETRIES times
 * 2. On persistent failure, reloads the page to get fresh assets
 * 3. Uses sessionStorage to prevent infinite reload loops
 *
 * Migrated 2026-04-18 to use shared `retryWithBackoff` — preserves exact
 * semantics via `delaysMs: [RETRY_DELAY, RETRY_DELAY]` + custom classifier.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: ImportFn<T>,
  moduleName: string
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: Error | null = null;

    try {
      return await retryWithBackoff<{ default: T }>(importFn, {
        maxRetries: MAX_RETRIES,
        delaysMs: new Array(MAX_RETRIES).fill(RETRY_DELAY),
        maxElapsedMs: Number.MAX_SAFE_INTEGER, // preserve: no total-time budget originally
        classifyError: (err) => (isChunkLoadError(err) ? "retryable" : "non-retryable"),
        onRetry: (attempt) => {
          logger.warn(
            `[LazyLoad] Chunk load failed for ${moduleName}, attempt ${attempt}/${MAX_RETRIES + 1}`
          );
        },
      });
    } catch (err) {
      lastError = err as Error;
      // Non-chunk errors: rethrow immediately (no hard-reload path).
      if (!isChunkLoadError(err)) throw err;
      // Fall through to hard-reload recovery below.
    }

    // All retries failed - force hard reload to get new index.html
    logger.error(`[LazyLoad] All retries failed for ${moduleName}, performing hard reload...`);

    // Mark that we're reloading to prevent infinite loop
    const reloadKey = SSK.chunkReload(moduleName);
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();

    if (!lastReload || now - parseInt(lastReload) > 60000) {
      sessionStorage.setItem(reloadKey, now.toString());

      // Clear all caches to ensure fresh HTML/chunks on reload
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // Ignore — caches API may not be available
      }

      // Mark for version check on reload and perform hard reload
      // This adds cache-busting query param
      markForVersionCheck();
      await forceHardReload();
    }

    // If we already reloaded recently, throw the error instead of infinite loop
    throw lastError ?? new Error(`Failed to load module: ${moduleName}`);
  });
}
