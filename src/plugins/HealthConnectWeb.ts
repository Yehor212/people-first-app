/**
 * Health Connect Web Fallback
 *
 * Provides a no-op implementation for web/non-Android platforms.
 * Health Connect is Android-only, so we gracefully return unavailable.
 */

import { WebPlugin } from '@capacitor/core';
import type {
  HealthConnectPluginInterface,
  HealthConnectAvailability,
  HealthConnectPermissions,
  MindfulnessSessionInput,
  MindfulnessSessionResult,
  SleepSessionsResult,
  StepsResult,
  TimeRangeInput,
} from './HealthConnectPlugin';
import { logger } from '@/lib/logger';

export class HealthConnectWeb extends WebPlugin implements HealthConnectPluginInterface {
  async isAvailable(): Promise<HealthConnectAvailability> {
    // Health Connect is Android-only
    return {
      available: false,
      reason: 'not_supported',
    };
  }

  async checkPermissions(): Promise<HealthConnectPermissions> {
    return {
      mindfulness: false,
      sleep: false,
      steps: false,
      allGranted: false,
    };
  }

  async requestPermissions(): Promise<HealthConnectPermissions> {
    logger.warn('[HealthConnect] Not available on web platform');
    return this.checkPermissions();
  }

  async writeMindfulnessSession(_options: MindfulnessSessionInput): Promise<MindfulnessSessionResult> {
    logger.warn('[HealthConnect] Not available on web platform');
    return {
      success: false,
      sessionId: '',
    };
  }

  async readSleepSessions(_options?: TimeRangeInput): Promise<SleepSessionsResult> {
    logger.warn('[HealthConnect] Not available on web platform');
    return {
      sessions: [],
      count: 0,
    };
  }

  async readSteps(_options?: TimeRangeInput): Promise<StepsResult> {
    logger.warn('[HealthConnect] Not available on web platform');
    return {
      totalSteps: 0,
      records: [],
      recordCount: 0,
    };
  }

  async openHealthConnect(): Promise<void> {
    logger.warn('[HealthConnect] Not available on web platform');
    // Could potentially open Health Connect Play Store page in browser
  }
}
