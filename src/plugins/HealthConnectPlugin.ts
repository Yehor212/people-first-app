/**
 * Health Connect Plugin for ZenFlow
 *
 * Integrates with Android Health Connect API to:
 * - Sync Focus Sessions as Mindfulness sessions
 * - Read sleep data for insights
 * - Read step data for activity tracking
 *
 * Requires Android 14+ or Health Connect app on older devices.
 */

import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

// ============================================
// TYPES
// ============================================

export interface HealthConnectAvailability {
  available: boolean;
  reason?: 'not_supported' | 'update_required';
}

export interface HealthConnectPermissions {
  mindfulness: boolean;
  sleep: boolean;
  steps: boolean;
  allGranted: boolean;
}

export interface MindfulnessSessionInput {
  sessionId?: string;
  startTime: number; // Unix timestamp in milliseconds
  durationMinutes: number;
  title?: string;
  notes?: string;
}

export interface MindfulnessSessionResult {
  success: boolean;
  sessionId: string;
}

export interface SleepSession {
  id: string;
  startTime: number;
  endTime: number;
  durationMinutes: number;
  title?: string;
}

export interface SleepSessionsResult {
  sessions: SleepSession[];
  count: number;
}

export interface StepRecord {
  startTime: number;
  endTime: number;
  count: number;
}

export interface StepsResult {
  totalSteps: number;
  records: StepRecord[];
  recordCount: number;
}

export interface TimeRangeInput {
  startTime?: number; // Unix timestamp in milliseconds
  endTime?: number;   // Unix timestamp in milliseconds
}

// ============================================
// PLUGIN INTERFACE
// ============================================

export interface HealthConnectPluginInterface {
  /**
   * Check if Health Connect is available on this device
   */
  isAvailable(): Promise<HealthConnectAvailability>;

  /**
   * Check current permission status
   */
  checkPermissions(): Promise<HealthConnectPermissions>;

  /**
   * Request Health Connect permissions
   */
  requestPermissions(): Promise<HealthConnectPermissions>;

  /**
   * Write a mindfulness session (from Focus Timer)
   */
  writeMindfulnessSession(options: MindfulnessSessionInput): Promise<MindfulnessSessionResult>;

  /**
   * Read sleep sessions for a date range
   */
  readSleepSessions(options?: TimeRangeInput): Promise<SleepSessionsResult>;

  /**
   * Read step count for a date range
   */
  readSteps(options?: TimeRangeInput): Promise<StepsResult>;

  /**
   * Open Health Connect app/settings
   */
  openHealthConnect(): Promise<void>;
}

// ============================================
// REGISTER PLUGIN
// ============================================

const HealthConnect = registerPlugin<HealthConnectPluginInterface>('HealthConnect', {
  web: () => import('./HealthConnectWeb').then(m => new m.HealthConnectWeb()),
});

export { HealthConnect };
export default HealthConnect;
