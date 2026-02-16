/**
 * Cloud Sync Settings
 *
 * Manages user's cloud synchronization preferences.
 * Allows users to control when their data syncs to Supabase cloud.
 *
 * Philosophy: Privacy-first, user control
 * - OFF by default for new sign-ins
 * - ON for existing users (migration)
 * - User can toggle anytime
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
  logger.log(`[CloudSync] Cloud sync ${enabled ? 'enabled' : 'disabled'} by user`);
};

/**
 * Migration helper: Auto-enable cloud sync for existing signed-in users
 * Call this once when user has a session but no cloud sync preference set
 *
 * Why? Users who signed in before v1.1.1 expect sync to continue working.
 * New users after v1.1.1 will have sync OFF by default (privacy-first).
 */
export const migrateExistingUser = (): void => {
  const existingSetting = storageGetRaw(SK.CLOUD_SYNC_ENABLED) || null;

  // Only migrate if no preference set yet
  if (existingSetting === null) {
    setCloudSyncEnabled(true);
    logger.log('[CloudSync] Migrated existing user: cloud sync enabled');
  }
};

/**
 * Get the localStorage key (for testing)
 */
export const getCloudSyncKey = (): string => SK.CLOUD_SYNC_ENABLED;
