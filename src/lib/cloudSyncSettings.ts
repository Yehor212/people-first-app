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

const CLOUD_SYNC_ENABLED_KEY = 'zenflow_cloud_sync_enabled';

/**
 * Check if cloud sync is enabled by user
 * Default: false (OFF) for privacy-first approach
 */
export const isCloudSyncEnabled = (): boolean => {
  try {
    const enabled = localStorage.getItem(CLOUD_SYNC_ENABLED_KEY);
    // Explicitly check for 'true' string
    return enabled === 'true';
  } catch (error) {
    logger.error('[CloudSync] Error reading cloud sync setting:', error);
    return false; // Fail safe: disable sync if can't read
  }
};

/**
 * Enable or disable cloud sync
 * Persists user preference to localStorage
 */
export const setCloudSyncEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(CLOUD_SYNC_ENABLED_KEY, String(enabled));
    logger.log(`[CloudSync] Cloud sync ${enabled ? 'enabled' : 'disabled'} by user`);
  } catch (error) {
    logger.error('[CloudSync] Error saving cloud sync setting:', error);
  }
};

/**
 * Migration helper: Auto-enable cloud sync for existing signed-in users
 * Call this once when user has a session but no cloud sync preference set
 *
 * Why? Users who signed in before v1.1.1 expect sync to continue working.
 * New users after v1.1.1 will have sync OFF by default (privacy-first).
 */
export const migrateExistingUser = (): void => {
  try {
    const existingSetting = localStorage.getItem(CLOUD_SYNC_ENABLED_KEY);

    // Only migrate if no preference set yet
    if (existingSetting === null) {
      setCloudSyncEnabled(true);
      logger.log('[CloudSync] Migrated existing user: cloud sync enabled');
    }
  } catch (error) {
    logger.error('[CloudSync] Error during migration:', error);
  }
};

/**
 * Get the localStorage key (for testing)
 */
export const getCloudSyncKey = (): string => CLOUD_SYNC_ENABLED_KEY;
