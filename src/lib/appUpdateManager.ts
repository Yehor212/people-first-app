/**
 * App Update Manager
 * Checks for Google Play updates and triggers update flows.
 * Uses IMMEDIATE mode for closed beta to ensure all testers have the latest version.
 *
 * Includes fallback mechanism for apps not installed from Google Play:
 * - Checks version from Supabase app_config table
 * - Opens Google Play Store directly if In-App Updates unavailable
 */

import AppUpdate, { AppUpdateInfo } from '@/plugins/AppUpdatePlugin';
import { isNative } from '@/lib/platform';
import { App } from '@capacitor/app';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { APP_VERSION } from '@/lib/appVersion';
import { SSK } from '@/lib/storageKeys';
import { retryWithBackoff } from '@/lib/retry';

export type UpdatePriority = 'low' | 'medium' | 'high' | 'critical';

export interface UpdateState {
  /** Whether an update is available */
  available: boolean;
  /** Update priority level */
  priority: UpdatePriority;
  /** Whether check has been completed */
  checked: boolean;
  /** Days since update became available */
  stalenessDays: number;
  /** Error message if check failed */
  error?: string;
  /** Whether using fallback mode (Supabase check instead of Google Play) */
  useFallback?: boolean;
  /** Latest version available (for fallback mode) */
  latestVersion?: string;
  /** Release notes (for fallback mode) - can be string or multilingual object */
  releaseNotes?: string | Record<string, string>;
}

/** Remote version config from Supabase */
interface RemoteVersionConfig {
  latestVersion: string;
  minVersion: string;
  forceUpdate: boolean;
  releaseNotes?: string | Record<string, string>;
}

/** Google Play Store package URL */
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.zenflow.app';

/** Retry configuration */
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // Exponential backoff: 1s, 3s, 5s
const CHECK_TIMEOUT = 10000; // 10 second timeout

/**
 * Wrap promise with per-attempt timeout.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${operation} took longer than ${ms}ms`)), ms)
    )
  ]);
}

/**
 * Retry wrapper with exponential backoff.
 *
 * Delegates to the shared `retryWithBackoff` util (src/lib/retry.ts) using the
 * explicit `delaysMs: [1000, 3000, 5000]` schedule to preserve historical
 * behavior byte-for-byte. The per-attempt 10s timeout and `navigator.onLine`
 * precheck remain caller-owned so this wrapper stays behavior-identical to the
 * pre-migration `withRetry` (avoids regressing the existing tests in
 * `src/lib/__tests__/appUpdateManager.test.ts`).
 *
 * Migrated 2026-04-18 as first proof-of-concept for the shared retry util.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  maxRetries = MAX_RETRIES,
  delays = RETRY_DELAYS
): Promise<T> {
  return retryWithBackoff<T>(
    async () => {
      if (!navigator.onLine) {
        throw new Error('Device is offline');
      }
      return withTimeout(fn(), CHECK_TIMEOUT, operation);
    },
    {
      maxRetries,
      delaysMs: delays,
      maxElapsedMs: Number.MAX_SAFE_INTEGER, // preserve: original loop has no total-time budget
      onRetry: (attempt, error, delayMs) => {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn(
          `[AppUpdate] ${operation} failed (attempt ${attempt}/${maxRetries + 1}), retrying in ${delayMs}ms:`,
          msg
        );
      },
    }
  );
}

/**
 * Compare semantic versions.
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Check version from Supabase app_config table.
 * Used as fallback when Google Play In-App Updates is unavailable.
 */
async function checkVersionFromRemote(): Promise<RemoteVersionConfig | null> {
  if (!supabase) {
    logger.warn('[AppUpdate] Supabase not available for fallback check');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'app_version')
      .maybeSingle();

    if (error) {
      logger.error('[AppUpdate] Failed to fetch remote version:', error);
      return null;
    }

    return ((data as { value?: unknown } | null)?.value as RemoteVersionConfig) ?? null;
  } catch (error) {
    logger.error('[AppUpdate] Remote version check failed:', error);
    return null;
  }
}

/**
 * Open Google Play Store page for the app.
 * Used as fallback when In-App Updates is unavailable.
 */
export async function openGooglePlayStore(): Promise<boolean> {
  try {
    if (isNative) {
      // On Android, try market:// URL first (opens directly in Play Store app)
      // Fallback to HTTPS URL if market:// fails
      const marketUrl = 'market://details?id=com.zenflow.app';

      // Capacitor App plugin exposes openUrl at runtime but not in types
      const appPlugin = App as unknown as { openUrl: (opts: { url: string }) => Promise<void> };
      try {
        // Try to open with market:// protocol (Play Store app)
        await appPlugin.openUrl({ url: marketUrl });
        logger.log('[AppUpdate] Opened Google Play Store via market://');
        return true;
      } catch {
        // Fallback to HTTPS URL (opens in browser)
        await appPlugin.openUrl({ url: GOOGLE_PLAY_URL });
        logger.log('[AppUpdate] Opened Google Play Store via HTTPS');
        return true;
      }
    } else {
      // Use window.open for web
      window.open(GOOGLE_PLAY_URL, '_blank');
      logger.log('[AppUpdate] Opened Google Play Store in browser');
      return true;
    }
  } catch (error) {
    logger.error('[AppUpdate] Failed to open Google Play Store:', error);
    return false;
  }
}

// Priority thresholds from Google Play Console
// 0-1: Low, 2: Medium, 3-4: High, 5: Critical
const getPriorityLevel = (priority: number, stalenessDays: number): UpdatePriority => {
  // If update is very stale (7+ days), escalate priority
  if (stalenessDays >= 7) return 'critical';
  if (stalenessDays >= 3) return 'high';

  // Use Google Play priority
  if (priority >= 5) return 'critical';
  if (priority >= 3) return 'high';
  if (priority >= 2) return 'medium';
  return 'low';
};

/**
 * Check for app updates on Google Play.
 * Falls back to Supabase version check if Google Play In-App Updates is unavailable.
 * Only works on Android native platform.
 * Now includes retry logic with exponential backoff.
 */
export async function checkForAppUpdate(): Promise<UpdateState> {
  // Skip on non-native platforms
  if (!isNative) {
    return {
      available: false,
      priority: 'low',
      checked: true,
      stalenessDays: 0,
    };
  }

  // Check network before attempting
  if (!navigator.onLine) {
    logger.warn('[AppUpdate] Device is offline, skipping update check');
    return {
      available: false,
      priority: 'low',
      checked: true,
      stalenessDays: 0,
      error: 'Device is offline',
    };
  }

  // First, try Google Play In-App Updates with retry
  try {
    const info: AppUpdateInfo = await withRetry(
      () => AppUpdate.checkForUpdate(),
      'Google Play update check'
    );

    logger.log('[AppUpdate] Google Play check result:', {
      updateAvailable: info.updateAvailable,
      priority: info.updatePriority,
      stalenessDays: info.stalenessDays,
      immediateAllowed: info.immediateAllowed,
    });

    const priority = getPriorityLevel(info.updatePriority, info.stalenessDays);

    return {
      available: info.updateAvailable,
      priority,
      checked: true,
      stalenessDays: info.stalenessDays,
      useFallback: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('[AppUpdate] Google Play check failed after retries, trying fallback:', message);

    // Fallback: Check version from Supabase (also with retry)
    return await checkForAppUpdateFallback();
  }
}

/**
 * Fallback update check using Supabase app_config table.
 * Used when Google Play In-App Updates is unavailable
 * (e.g., app not installed from Google Play, or on emulator).
 * Now includes retry logic with exponential backoff.
 */
async function checkForAppUpdateFallback(): Promise<UpdateState> {
  let remoteConfig: RemoteVersionConfig | null = null;

  // Retry fallback check with 2 attempts (less aggressive than primary)
  try {
    remoteConfig = await withRetry(
      () => checkVersionFromRemote().then(config => {
        if (!config) throw new Error('No remote config returned');
        return config;
      }),
      'Supabase version check',
      2, // Max 2 retries for fallback
      [1000, 2000] // Shorter delays for fallback
    );
  } catch (error) {
    logger.warn('[AppUpdate] Fallback check failed after retries:', error);
  }

  if (!remoteConfig) {
    logger.warn('[AppUpdate] Fallback check failed - no remote config');
    return {
      available: false,
      priority: 'low',
      checked: true,
      stalenessDays: 0,
      useFallback: true,
      error: 'Could not check for updates',
    };
  }

  const { latestVersion, minVersion, forceUpdate, releaseNotes } = remoteConfig;
  const currentVersion = APP_VERSION;

  // Compare versions
  const needsUpdate = compareVersions(latestVersion, currentVersion) > 0;
  const isBelowMinimum = compareVersions(minVersion, currentVersion) > 0;

  // Determine priority
  let priority: UpdatePriority = 'low';
  if (forceUpdate || isBelowMinimum) {
    priority = 'critical';
  } else if (needsUpdate) {
    priority = 'medium';
  }

  logger.log('[AppUpdate] Fallback check result:', {
    currentVersion,
    latestVersion,
    minVersion,
    needsUpdate,
    isBelowMinimum,
    forceUpdate,
    priority,
  });

  return {
    available: needsUpdate,
    priority,
    checked: true,
    stalenessDays: 0,
    useFallback: true,
    latestVersion,
    releaseNotes,
  };
}

/**
 * Start the update flow.
 * For closed beta, we use IMMEDIATE mode (blocking) by default.
 * @param immediate If true, uses blocking update. If false, uses background update.
 */
export async function startAppUpdate(immediate = true): Promise<boolean> {
  try {
    if (immediate) {
      await AppUpdate.startImmediateUpdate();
      logger.log('[AppUpdate] Immediate update started');
    } else {
      await AppUpdate.startFlexibleUpdate();
      logger.log('[AppUpdate] Flexible update started');
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[AppUpdate] Start update failed:', message);
    return false;
  }
}

/**
 * Check if in-app updates are supported.
 */
export async function isUpdateSupported(): Promise<boolean> {
  try {
    const result = await AppUpdate.isSupported();
    return result.supported;
  } catch {
    return false;
  }
}

/**
 * Check if update was dismissed this session.
 */
export function wasUpdateDismissed(): boolean {
  try {
    const dismissed = sessionStorage.getItem(SSK.UPDATE_DISMISSED);
    return dismissed === 'true';
  } catch {
    // sessionStorage not available
    return false;
  }
}

/**
 * Mark update as dismissed for this session.
 */
export function dismissUpdate(): void {
  try {
    sessionStorage.setItem(SSK.UPDATE_DISMISSED, 'true');
  } catch {
    // sessionStorage not available
  }
}
