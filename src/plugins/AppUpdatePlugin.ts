/**
 * In-App Update Plugin
 * Checks for app updates on Google Play and prompts users to update.
 * Uses the Google Play Core In-App Updates API.
 */

import { registerPlugin } from '@capacitor/core';

export interface AppUpdateInfo {
  /** Whether an update is available on Google Play */
  updateAvailable: boolean;
  /** Update priority (0-5, higher = more urgent) */
  updatePriority: number;
  /** Whether immediate (blocking) update is allowed */
  immediateAllowed: boolean;
  /** Whether flexible (background) update is allowed */
  flexibleAllowed: boolean;
  /** Available version code */
  availableVersionCode: number;
  /** Days since update became available */
  stalenessDays: number;
}

export interface AppUpdatePlugin {
  /**
   * Check if an update is available on Google Play.
   * Returns update info including priority and availability.
   */
  checkForUpdate(): Promise<AppUpdateInfo>;

  /**
   * Start an immediate (blocking) update flow.
   * User must complete the update before using the app.
   */
  startImmediateUpdate(): Promise<void>;

  /**
   * Start a flexible (background) update flow.
   * Update downloads in background while user continues using app.
   */
  startFlexibleUpdate(): Promise<void>;

  /**
   * Check if in-app updates are supported on this platform.
   */
  isSupported(): Promise<{ supported: boolean }>;
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate', {
  web: () => import('./AppUpdateWeb').then(m => new m.AppUpdateWeb()),
});

export default AppUpdate;
