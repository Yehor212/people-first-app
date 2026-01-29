/**
 * Web fallback for App Update Plugin
 * On web, in-app updates are not supported (PWA updates handled separately).
 */

import type { AppUpdatePlugin, AppUpdateInfo } from './AppUpdatePlugin';
import { logger } from '@/lib/logger';

export class AppUpdateWeb implements AppUpdatePlugin {
  async checkForUpdate(): Promise<AppUpdateInfo> {
    logger.log('[AppUpdate] Web fallback - in-app updates not available');
    // On web, return no update available
    return {
      updateAvailable: false,
      updatePriority: 0,
      immediateAllowed: false,
      flexibleAllowed: false,
      availableVersionCode: 0,
      stalenessDays: 0,
    };
  }

  async startImmediateUpdate(): Promise<void> {
    logger.log('[AppUpdate] Web fallback - immediate update not supported');
    // On web, do nothing (PWA updates handled by service worker)
  }

  async startFlexibleUpdate(): Promise<void> {
    logger.log('[AppUpdate] Web fallback - flexible update not supported');
    // On web, do nothing
  }

  async isSupported(): Promise<{ supported: boolean }> {
    // In-app updates not supported on web
    return { supported: false };
  }
}
