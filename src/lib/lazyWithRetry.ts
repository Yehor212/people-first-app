import { lazy, ComponentType } from 'react';
import { forceHardReload, markForVersionCheck } from './versionCheck';

type ImportFn<T> = () => Promise<{ default: T }>;

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

/**
 * Wrapper around React.lazy() that handles chunk loading failures.
 *
 * After deployment, users with cached old index.html may try to load
 * non-existent chunk files (hash changed). This wrapper:
 * 1. Retries failed chunk loads up to MAX_RETRIES times
 * 2. On persistent failure, reloads the page to get fresh assets
 * 3. Uses sessionStorage to prevent infinite reload loops
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: ImportFn<T>,
  moduleName: string
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await importFn();
      } catch (error) {
        lastError = error as Error;

        // Detect ChunkLoadError pattern
        const isChunkError =
          error instanceof TypeError &&
          (error.message.includes('Failed to fetch dynamically imported module') ||
           error.message.includes('Loading chunk') ||
           error.message.includes('Loading CSS chunk'));

        if (!isChunkError) {
          throw error; // Non-chunk errors should not retry
        }

        console.warn(
          `[LazyLoad] Chunk load failed for ${moduleName}, attempt ${attempt + 1}/${MAX_RETRIES + 1}`
        );

        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }

    // All retries failed - force hard reload to get new index.html
    console.error(`[LazyLoad] All retries failed for ${moduleName}, performing hard reload...`);

    // Mark that we're reloading to prevent infinite loop
    const reloadKey = `chunk_reload_${moduleName}`;
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();

    if (!lastReload || now - parseInt(lastReload) > 60000) {
      sessionStorage.setItem(reloadKey, now.toString());
      // Mark for version check on reload and perform hard reload
      // This clears SW caches and adds cache-busting query param
      markForVersionCheck();
      await forceHardReload();
    }

    // If we already reloaded recently, throw the error instead of infinite loop
    throw lastError;
  });
}
