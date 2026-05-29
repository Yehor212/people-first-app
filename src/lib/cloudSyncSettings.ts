/**
 * Cloud Sync Settings
 *
 * Manages cloud synchronization availability.
 *
 * Philosophy: signed-in accounts stay synchronized automatically.
 * Users opt out by signing out or deleting their account; the old local toggle is
 * treated as a legacy preference and is upgraded on the next signed-in session.
 */

import { logger } from './logger';
import { storageGetRaw, storageSetRaw } from './safeJson';
import { SK } from '@/lib/storageKeys';

/**
 * Check if cloud sync is enabled by user
 * Default: false (OFF) for privacy-first approach
 */
export const isCloudSyncEnabled = (): boolean => {
  // storageGetRaw returns '' on error/missing — explicitly check for 'true'
  return storageGetRaw(SK.CLOUD_SYNC_ENABLED) === 'true';
};

/**
 * Enable or disable cloud sync
 * Persists user preference to localStorage
 */
export const setCloudSyncEnabled = (enabled: boolean): void => {
  storageSetRaw(SK.CLOUD_SYNC_ENABLED, String(enabled));
  logger.log(`[CloudSync] Cloud sync ${enabled ? 'enabled' : 'paused'}`);
};

/**
 * Ensures signed-in accounts cannot remain silently unsynchronized because of an
 * old local toggle value.
 */
export const ensureCloudSyncEnabled = (): void => {
  if (!isCloudSyncEnabled()) {
    setCloudSyncEnabled(true);
    logger.log('[CloudSync] Automatic account sync enabled');
  }
};

/**
 * Backward-compatible migration hook used by auth/session code.
 */
export const migrateExistingUser = ensureCloudSyncEnabled;

/**
 * Get the localStorage key (for testing)
 */
export const getCloudSyncKey = (): string => SK.CLOUD_SYNC_ENABLED;
