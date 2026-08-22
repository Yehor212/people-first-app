/**
 * Version Check Utility
 *
 * Detects when the app has been updated on the server but the client
 * is still running an old cached version. This happens commonly after:
 * - OAuth redirects (user was away on external auth page)
 * - Long browser tabs left open
 * - Service Worker serving stale index.html
 *
 * When a version mismatch is detected, prepares pending durable writes and
 * reloads with a cache-busting query parameter. Cache Storage remains owned by
 * the service worker, and this utility does not signal a waiting worker.
 */

import { logger } from "./logger";
import { storageGetRaw, storageSetRaw } from "./safeJson";
import { SK, SSK } from "@/lib/storageKeys";
import { BASE_URL } from "@/lib/env";

interface VersionManifest {
  version: string;
  buildTime: number;
}

export type AppVersionCheckUnavailableReason = "missing" | "http" | "non_json" | "invalid" | "network" | "offline";

interface AppVersionCheckBase {
  clientVersion: string;
  clientBuildTime: number;
  checkedAt: number;
}

export type AppVersionCheckResult =
  | (AppVersionCheckBase & {
      status: "current";
      serverVersion: string;
      serverBuildTime: number;
    })
  | (AppVersionCheckBase & {
      status: "stale";
      serverVersion: string;
      serverBuildTime: number;
    })
  | (AppVersionCheckBase & {
      status: "unavailable";
      reason: AppVersionCheckUnavailableReason;
      httpStatus?: number;
      errorMessage?: string;
    });

function makeUnavailableVersionCheckResult(
  reason: AppVersionCheckUnavailableReason,
  options: { httpStatus?: number; error?: unknown } = {}
): AppVersionCheckResult {
  const errorMessage = options.error instanceof Error ? options.error.message : undefined;
  return {
    status: "unavailable",
    reason,
    clientVersion: __APP_VERSION__,
    clientBuildTime: __APP_BUILD_TIME__,
    checkedAt: Date.now(),
    httpStatus: options.httpStatus,
    errorMessage,
  };
}

function isVersionManifest(value: unknown): value is VersionManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as { version?: unknown; buildTime?: unknown };
  return typeof manifest.version === "string" && typeof manifest.buildTime === "number";
}
const VERSION_CHECK_INTERVAL = 1 * 60 * 1000; // 1 minute — aggressive for GitHub Pages (no custom cache headers)
const VERSION_CHECK_TIMEOUT_MS = 5000;
const APP_RELOAD_PREPARE_TIMEOUT_MS = 5000;
export const APP_RELOAD_PREPARE_EVENT = "zenflow:before-app-reload";

export type AppReloadPrepareDetail = {
  waitUntil: (promise: Promise<unknown>) => void;
};

export async function prepareAppForReload(): Promise<void> {
  const pendingWrites: Promise<unknown>[] = [];
  const detail: AppReloadPrepareDetail = {
    waitUntil: (promise) => pendingWrites.push(Promise.resolve(promise)),
  };
  window.dispatchEvent(new CustomEvent<AppReloadPrepareDetail>(APP_RELOAD_PREPARE_EVENT, { detail }));
  if (pendingWrites.length === 0) return;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(pendingWrites),
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Timed out while persisting app state before reload")),
          APP_RELOAD_PREPARE_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const SAFE_HARD_RELOAD_SEARCH_PARAMS = new Map<string, (value: string) => boolean>([
  ["nav", (value) => value === "v2"],
  ["navLayout", (value) => value === "phone" || value === "desktop"],
  ["planningDate", (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)],
  ["view", (value) => /^[a-z0-9_-]{1,32}$/i.test(value)],
]);

export function buildSafeHardReloadUrl(location: Location, cacheBustValue: number): string {
  const pathname = location.pathname;
  const safePathname = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
  if (safePathname !== pathname) {
    logger.warn("[VersionCheck] Suspicious pathname, using root");
  }

  const url = new URL(location.origin);
  url.pathname = safePathname;

  const sourceParams = new URLSearchParams(location.search);
  for (const [name, isSafeValue] of SAFE_HARD_RELOAD_SEARCH_PARAMS) {
    for (const value of sourceParams.getAll(name)) {
      if (isSafeValue(value)) url.searchParams.append(name, value);
    }
  }
  url.searchParams.set("_v", cacheBustValue.toString());
  return url.href;
}

/** Reload without discarding durable writes that are still being persisted. */
export async function reloadAppSafely(): Promise<void> {
  await prepareAppForReload();
  window.location.reload();
}

/**
 * Check if the app version matches the server version.
 * Returns true if versions match (or if check fails/unavailable).
 * Returns false if server has a newer version.
 */
export async function checkAppVersionStatus(): Promise<AppVersionCheckResult> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return makeUnavailableVersionCheckResult("offline");
    }

    // Determine base path (same as Vite config)
    const basePath = BASE_URL;

    // Fetch with no-store to bypass all caches
    // Cache-bust URL with timestamp to bypass GitHub Pages CDN cache
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), VERSION_CHECK_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${basePath}version.json?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return makeUnavailableVersionCheckResult(response.status === 404 ? "missing" : "http", {
        httpStatus: response.status,
      });
    }

    const contentType = (response.headers?.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("application/json") && !contentType.includes("+json")) {
      return makeUnavailableVersionCheckResult("non_json");
    }

    const serverVersion: unknown = await response.json();
    if (!isVersionManifest(serverVersion)) {
      return makeUnavailableVersionCheckResult("invalid");
    }

    const clientVersion = __APP_VERSION__;
    const clientBuildTime = __APP_BUILD_TIME__;
    const status =
      serverVersion.version !== clientVersion || serverVersion.buildTime !== clientBuildTime
        ? "stale"
        : "current";

    return {
      status,
      clientVersion,
      clientBuildTime,
      serverVersion: serverVersion.version,
      serverBuildTime: serverVersion.buildTime,
      checkedAt: Date.now(),
    };
  } catch (error) {
    return makeUnavailableVersionCheckResult("network", { error });
  }
}

export async function checkAppVersion(): Promise<boolean> {
  const result = await checkAppVersionStatus();

  if (result.status === "stale") {
    logger.log(
      `[VersionCheck] Version mismatch! Client: ${result.clientVersion}@${result.clientBuildTime}, Server: ${result.serverVersion}@${result.serverBuildTime}`
    );
    return false;
  }

  if (result.status === "unavailable") {
    logger.log(`[VersionCheck] Version check unavailable (${result.reason}), skipping freshness decision`);
    return true;
  }

  logger.log(`[VersionCheck] Version OK (${result.clientVersion})`);
  return true;
}

/**
 * Reload after a user-requested update check.
 *
 * Settings uses the same durable-write preparation and cache-preserving,
 * cache-busted navigation contract as stale-chunk recovery. It has a separate
 * entry point so user-requested update state can remain explicit without
 * unregistering the service worker or mutating Cache Storage.
 */
export async function reloadAppForUpdate(): Promise<boolean> {
  const lastReload = sessionStorage.getItem(SSK.HARD_RELOAD_TS);
  const now = Date.now();

  if (lastReload && now - parseInt(lastReload, 10) < 30000) {
    logger.warn("[VersionCheck] Recent update reload detected, preventing loop");
    return false;
  }

  await prepareAppForReload();
  sessionStorage.setItem(SSK.HARD_RELOAD_TS, now.toString());
  window.location.replace(buildSafeHardReloadUrl(window.location, now));
  return true;
}

/**
 * Perform a cache-busted recovery navigation after durable writers settle.
 * The active worker and its caches stay intact so offline recovery remains possible.
 */
export async function forceHardReload(): Promise<boolean> {
  logger.log("[VersionCheck] Performing hard reload...");

  // Prevent infinite reload loops
  const lastReload = sessionStorage.getItem(SSK.HARD_RELOAD_TS);
  const now = Date.now();

  if (lastReload && now - parseInt(lastReload, 10) < 30000) {
    logger.warn("[VersionCheck] Recent reload detected, preventing loop");
    return false;
  }

  // A recovery reload must not bypass journal and other durable writers.
  await prepareAppForReload();
  sessionStorage.setItem(SSK.HARD_RELOAD_TS, now.toString());

  // Cache-busted, origin-locked navigation. The service worker remains available
  // to serve the current shell offline and to complete its normal update lifecycle.
  // Preserve only safe app navigation params; OAuth codes, token fragments, and hashes are dropped.
  window.location.replace(buildSafeHardReloadUrl(window.location, now));
  return true;
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
 * OAuth providers we recognize: Google, Supabase Auth, Telegram, Facebook.
 */
export function isOAuthReturn(): boolean {
  const referrer = document.referrer.toLowerCase();
  return (
    referrer.includes("accounts.google.com") ||
    referrer.includes("google.com/o/oauth") ||
    referrer.includes("oauth.telegram.org") ||
    referrer.includes("facebook.com/v") ||
    referrer.includes("facebook.com/dialog/oauth") ||
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
