/**
 * Version Check Utility
 *
 * Detects when the app has been updated on the server but the client
 * is still running an old cached version. This happens commonly after:
 * - OAuth redirects (user was away on external auth page)
 * - Long browser tabs left open
 * - Service Worker serving stale index.html
 *
 * When a version mismatch is detected, performs a "hard reload" that:
 * 1. Clears all Service Worker caches
 * 2. Signals SW to skip waiting
 * 3. Reloads with cache-busting query param
 */

import { logger } from './logger';

interface VersionManifest {
  version: string;
  buildTime: number;
}

const VERSION_CHECK_FLAG = 'zenflow_check_version';
const RELOAD_TIMESTAMP_KEY = 'zenflow_hard_reload_ts';

/**
 * Check if the app version matches the server version.
 * Returns true if versions match (or if check fails/unavailable).
 * Returns false if server has a newer version.
 */
export async function checkAppVersion(): Promise<boolean> {
  try {
    // Determine base path (same as Vite config)
    const basePath = import.meta.env.BASE_URL || '/';

    // Fetch with no-store to bypass all caches
    const response = await fetch(`${basePath}version.json`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      // version.json doesn't exist yet (first deploy) - assume OK
      logger.log('[VersionCheck] version.json not found, skipping check');
      return true;
    }

    const serverVersion: VersionManifest = await response.json();
    const clientVersion = __APP_VERSION__;

    if (serverVersion.version !== clientVersion) {
      logger.log(
        `[VersionCheck] Version mismatch! Client: ${clientVersion}, Server: ${serverVersion.version}`
      );
      return false;
    }

    logger.log(`[VersionCheck] Version OK (${clientVersion})`);
    return true;
  } catch (error) {
    // Network error or parsing error - don't block the app
    logger.warn('[VersionCheck] Check failed, continuing anyway:', error);
    return true;
  }
}

/**
 * Perform a hard reload that bypasses all caches.
 * This ensures the browser fetches fresh index.html from the server.
 */
export async function forceHardReload(): Promise<void> {
  logger.log('[VersionCheck] Performing hard reload...');

  // Prevent infinite reload loops
  const lastReload = sessionStorage.getItem(RELOAD_TIMESTAMP_KEY);
  const now = Date.now();

  if (lastReload && now - parseInt(lastReload, 10) < 30000) {
    logger.warn('[VersionCheck] Recent reload detected, preventing loop');
    return;
  }

  sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, now.toString());

  try {
    // 1. Clear all Service Worker caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      logger.log(`[VersionCheck] Cleared ${cacheNames.length} caches`);
    }

    // 2. Tell Service Worker to skip waiting and activate immediately
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });

      // Also try via registration
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  } catch (error) {
    logger.warn('[VersionCheck] Error clearing caches:', error);
  }

  // 3. Reload with cache-busting query param
  // Using location.replace to not add to history
  const url = new URL(window.location.href);
  url.searchParams.set('_v', now.toString());
  window.location.replace(url.toString());
}

/**
 * Mark that version should be checked on next page load.
 * Used before reload in lazyWithRetry to ensure fresh check.
 */
export function markForVersionCheck(): void {
  sessionStorage.setItem(VERSION_CHECK_FLAG, 'true');
}

/**
 * Check if version check was requested (and clear the flag).
 */
export function shouldCheckVersion(): boolean {
  const shouldCheck = sessionStorage.getItem(VERSION_CHECK_FLAG) === 'true';
  if (shouldCheck) {
    sessionStorage.removeItem(VERSION_CHECK_FLAG);
  }
  return shouldCheck;
}

/**
 * Check if this is a return from OAuth flow.
 * OAuth providers we recognize: Google, Supabase Auth
 */
export function isOAuthReturn(): boolean {
  const referrer = document.referrer.toLowerCase();
  return (
    referrer.includes('accounts.google.com') ||
    referrer.includes('google.com/o/oauth') ||
    referrer.includes('supabase.co/auth') ||
    referrer.includes('supabase.io/auth')
  );
}
