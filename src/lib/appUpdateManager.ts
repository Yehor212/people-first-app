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
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { APP_VERSION } from '@/lib/appVersion';

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
      .single();

    if (error) {
      logger.error('[AppUpdate] Failed to fetch remote version:', error);
      return null;
    }

    return data?.value as RemoteVersionConfig || null;
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
    if (Capacitor.isNativePlatform()) {
      // On Android, try market:// URL first (opens directly in Play Store app)
      // Fallback to HTTPS URL if market:// fails
      const marketUrl = 'market://details?id=com.zenflow.app';

      try {
        // Try to open with market:// protocol (Play Store app)
        await App.openUrl({ url: marketUrl });
        logger.log('[AppUpdate] Opened Google Play Store via market://');
        return true;
      } catch {
        // Fallback to HTTPS URL (opens in browser)
        await App.openUrl({ url: GOOGLE_PLAY_URL });
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
 */
export async function checkForAppUpdate(): Promise<UpdateState> {
  // Skip on non-native platforms
  if (!Capacitor.isNativePlatform()) {
    return {
      available: false,
      priority: 'low',
      checked: true,
      stalenessDays: 0,
    };
  }

  // First, try Google Play In-App Updates
  try {
    const info: AppUpdateInfo = await AppUpdate.checkForUpdate();

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
    logger.warn('[AppUpdate] Google Play check failed, trying fallback:', message);

    // Fallback: Check version from Supabase
    return await checkForAppUpdateFallback();
  }
}

/**
 * Fallback update check using Supabase app_config table.
 * Used when Google Play In-App Updates is unavailable
 * (e.g., app not installed from Google Play, or on emulator).
 */
async function checkForAppUpdateFallback(): Promise<UpdateState> {
  const remoteConfig = await checkVersionFromRemote();

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
 * Storage key for tracking dismissed updates.
 * Users can dismiss non-critical updates once per session.
 */
const DISMISSED_KEY = 'zenflow-update-dismissed';

/**
 * Check if update was dismissed this session.
 */
export function wasUpdateDismissed(): boolean {
  try {
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
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
    sessionStorage.setItem(DISMISSED_KEY, 'true');
  } catch {
    // sessionStorage not available
  }
}
