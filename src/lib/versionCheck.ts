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

import { logger } from "./logger";
import { storageGetRaw, storageSetRaw } from "./safeJson";
import { SK, SSK } from "@/lib/storageKeys";
import { BASE_URL } from "@/lib/env";

interface VersionManifest {
  version: string;
  buildTime: number;
}
const VERSION_CHECK_INTERVAL = 1 * 60 * 1000; // 1 minute — aggressive for GitHub Pages (no custom cache headers)

/**
 * Check if the app version matches the server version.
 * Returns true if versions match (or if check fails/unavailable).
 * Returns false if server has a newer version.
 */
export async function checkAppVersion(): Promise<boolean> {
  try {
    // Determine base path (same as Vite config)
    const basePath = BASE_URL;

    // Fetch with no-store to bypass all caches
    // Cache-bust URL with timestamp to bypass GitHub Pages CDN cache
    const response = await fetch(`${basePath}version.json?_t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      // version.json doesn't exist yet (first deploy) - assume OK
      logger.log("[VersionCheck] version.json not found, skipping check");
      return true;
    }

    const serverVersion: VersionManifest = await response.json();
    const clientVersion = __APP_VERSION__;
    const clientBuildTime = __APP_BUILD_TIME__;

    if (serverVersion.version !== clientVersion || serverVersion.buildTime !== clientBuildTime) {
      logger.log(
        `[VersionCheck] Version mismatch! Client: ${clientVersion}@${clientBuildTime}, Server: ${serverVersion.version}@${serverVersion.buildTime}`
      );
      return false;
    }

    logger.log(`[VersionCheck] Version OK (${clientVersion})`);
    return true;
  } catch (error) {
    // Network error or parsing error - don't block the app
    logger.warn("[VersionCheck] Check failed, continuing anyway:", error);
    return true;
  }
}

/**
 * Perform a hard reload that bypasses all caches.
 * Clears all SW caches, unregisters all SWs, then reloads with cache bust.
 * Must await all operations before reload to prevent stale content.
 */
export async function forceHardReload(): Promise<void> {
  logger.log("[VersionCheck] Performing hard reload...");

  // Prevent infinite reload loops
  const lastReload = sessionStorage.getItem(SSK.HARD_RELOAD_TS);
  const now = Date.now();

  if (lastReload && now - parseInt(lastReload, 10) < 30000) {
    logger.warn("[VersionCheck] Recent reload detected, preventing loop");
    return;
  }

  sessionStorage.setItem(SSK.HARD_RELOAD_TS, now.toString());

  try {
    // 1. Clear ALL caches (await completion)
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      logger.log(`[VersionCheck] Cleared ${names.length} caches`);
    }

    // 2. Unregister ALL service workers (await completion)
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      logger.log(`[VersionCheck] Unregistered ${regs.length} service workers`);
    }
  } catch (error) {
    logger.warn("[VersionCheck] Error clearing caches:", error);
  }

  // 3. Reload with cache-busting query param (origin-locked to prevent open redirect CWE-601)
  // Validate pathname is a safe relative path (no protocol/scheme injection via //evil.com)
  const pathname = window.location.pathname;
  const safePathname = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
  if (safePathname !== pathname) {
    logger.warn("[VersionCheck] Suspicious pathname, using root");
  }
  const url = new URL(window.location.origin);
  url.pathname = safePathname;
  url.searchParams.set("_v", now.toString());
  window.location.replace(url.href);
}

/**
 * Mark that version should be checked on next page load.
 * Used before reload in lazyWithRetry to ensure fresh check.
 */
export function markForVersionCheck(): void {
  sessionStorage.setItem(SSK.VERSION_CHECK_FLAG, "true");
}

/**
 * Check if version check was requested (and clear the flag).
 */
export function shouldCheckVersion(): boolean {
  const shouldCheck = sessionStorage.getItem(SSK.VERSION_CHECK_FLAG) === "true";
  if (shouldCheck) {
    sessionStorage.removeItem(SSK.VERSION_CHECK_FLAG);
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
    referrer.includes("accounts.google.com") ||
    referrer.includes("google.com/o/oauth") ||
    referrer.includes("supabase.co/auth") ||
    referrer.includes("supabase.io/auth") ||
    referrer.includes("api.zenflowapp.online/auth")
  );
}

/**
 * Check if enough time has passed since last version check.
 * Returns true if we should check (5+ minutes since last check).
 */
export function shouldAutoCheckVersion(): boolean {
  const lastCheck = storageGetRaw(SK.LAST_VERSION_CHECK) || null;
  if (!lastCheck) return true;

  const elapsed = Date.now() - parseInt(lastCheck, 10);
  return elapsed >= VERSION_CHECK_INTERVAL;
}

/**
 * Mark the current time as last version check.
 */
export function markVersionChecked(): void {
  storageSetRaw(SK.LAST_VERSION_CHECK, Date.now().toString());
}
