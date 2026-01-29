/**
 * useHealthConnect Hook
 *
 * React hook for integrating with Android Health Connect.
 * Provides methods to:
 * - Check availability and permissions
 * - Sync Focus Sessions as Mindfulness
 * - Read sleep and step data
 *
 * Gracefully handles non-Android platforms.
 */

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { HealthConnect } from '@/plugins/HealthConnectPlugin';
import type {
  HealthConnectAvailability,
  HealthConnectPermissions,
  SleepSession,
  StepRecord,
} from '@/plugins/HealthConnectPlugin';
import { logger } from '@/lib/logger';

// ============================================
// TYPES
// ============================================

export interface HealthConnectState {
  isAvailable: boolean;
  isLoading: boolean;
  permissions: HealthConnectPermissions | null;
  unavailableReason: string | null;
}

export interface UseHealthConnectReturn {
  // State
  state: HealthConnectState;
  isAndroid: boolean;

  // Methods
  checkAvailability: () => Promise<HealthConnectAvailability>;
  requestPermissions: () => Promise<HealthConnectPermissions>;
  syncFocusSession: (sessionId: string, startTime: number, durationMinutes: number, label?: string) => Promise<boolean>;
  getSleepData: (days?: number) => Promise<SleepSession[]>;
  getStepsData: (days?: number) => Promise<{ total: number; records: StepRecord[] }>;
  openHealthConnect: () => Promise<void>;
  refreshState: () => Promise<void>;
}

// ============================================
// HOOK
// ============================================

export function useHealthConnect(): UseHealthConnectReturn {
  const isAndroid = Capacitor.getPlatform() === 'android';

  const [state, setState] = useState<HealthConnectState>({
    isAvailable: false,
    isLoading: true,
    permissions: null,
    unavailableReason: null,
  });

  /**
   * Check if Health Connect is available
   */
  const checkAvailability = useCallback(async (): Promise<HealthConnectAvailability> => {
    if (!isAndroid) {
      return { available: false, reason: 'not_supported' };
    }

    try {
      const result = await HealthConnect.isAvailable();
      logger.log('[HealthConnect] Availability:', result);
      return result;
    } catch (error) {
      logger.error('[HealthConnect] Error checking availability:', error);
      return { available: false, reason: 'not_supported' };
    }
  }, [isAndroid]);

  /**
   * Check current permissions
   */
  const checkPermissions = useCallback(async (): Promise<HealthConnectPermissions> => {
    if (!isAndroid) {
      return { mindfulness: false, sleep: false, steps: false, allGranted: false };
    }

    try {
      const result = await HealthConnect.checkPermissions();
      logger.log('[HealthConnect] Permissions:', result);
      return result;
    } catch (error) {
      logger.error('[HealthConnect] Error checking permissions:', error);
      return { mindfulness: false, sleep: false, steps: false, allGranted: false };
    }
  }, [isAndroid]);

  /**
   * Request Health Connect permissions
   */
  const requestPermissions = useCallback(async (): Promise<HealthConnectPermissions> => {
    if (!isAndroid) {
      logger.warn('[HealthConnect] Not available on this platform');
      return { mindfulness: false, sleep: false, steps: false, allGranted: false };
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const result = await HealthConnect.requestPermissions();
      setState(prev => ({ ...prev, permissions: result, isLoading: false }));
      logger.log('[HealthConnect] Permissions after request:', result);
      return result;
    } catch (error) {
      logger.error('[HealthConnect] Error requesting permissions:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return { mindfulness: false, sleep: false, steps: false, allGranted: false };
    }
  }, [isAndroid]);

  /**
   * Sync a focus session to Health Connect as Mindfulness
   */
  const syncFocusSession = useCallback(async (
    sessionId: string,
    startTime: number,
    durationMinutes: number,
    label?: string
  ): Promise<boolean> => {
    if (!isAndroid || !state.isAvailable) {
      return false;
    }

    if (!state.permissions?.mindfulness) {
      logger.warn('[HealthConnect] No mindfulness write permission');
      return false;
    }

    try {
      const result = await HealthConnect.writeMindfulnessSession({
        sessionId,
        startTime,
        durationMinutes,
        title: label || 'Focus Session',
        notes: `ZenFlow focus session - ${durationMinutes} minutes`,
      });

      logger.log('[HealthConnect] Focus session synced:', result);
      return result.success;
    } catch (error) {
      logger.error('[HealthConnect] Error syncing focus session:', error);
      return false;
    }
  }, [isAndroid, state.isAvailable, state.permissions?.mindfulness]);

  /**
   * Get sleep data for the past N days
   */
  const getSleepData = useCallback(async (days: number = 7): Promise<SleepSession[]> => {
    if (!isAndroid || !state.isAvailable) {
      return [];
    }

    if (!state.permissions?.sleep) {
      logger.warn('[HealthConnect] No sleep read permission');
      return [];
    }

    try {
      const endTime = Date.now();
      const startTime = endTime - days * 24 * 60 * 60 * 1000;

      const result = await HealthConnect.readSleepSessions({ startTime, endTime });
      logger.log('[HealthConnect] Sleep sessions:', result.count);
      return result.sessions;
    } catch (error) {
      logger.error('[HealthConnect] Error reading sleep data:', error);
      return [];
    }
  }, [isAndroid, state.isAvailable, state.permissions?.sleep]);

  /**
   * Get steps data for the past N days
   */
  const getStepsData = useCallback(async (days: number = 1): Promise<{ total: number; records: StepRecord[] }> => {
    if (!isAndroid || !state.isAvailable) {
      return { total: 0, records: [] };
    }

    if (!state.permissions?.steps) {
      logger.warn('[HealthConnect] No steps read permission');
      return { total: 0, records: [] };
    }

    try {
      const endTime = Date.now();
      const startTime = endTime - days * 24 * 60 * 60 * 1000;

      const result = await HealthConnect.readSteps({ startTime, endTime });
      logger.log('[HealthConnect] Steps:', result.totalSteps);
      return { total: result.totalSteps, records: result.records };
    } catch (error) {
      logger.error('[HealthConnect] Error reading steps data:', error);
      return { total: 0, records: [] };
    }
  }, [isAndroid, state.isAvailable, state.permissions?.steps]);

  /**
   * Open Health Connect app/settings
   */
  const openHealthConnect = useCallback(async (): Promise<void> => {
    if (!isAndroid) {
      logger.warn('[HealthConnect] Not available on this platform');
      return;
    }

    try {
      await HealthConnect.openHealthConnect();
    } catch (error) {
      logger.error('[HealthConnect] Error opening Health Connect:', error);
    }
  }, [isAndroid]);

  /**
   * Refresh the state (availability and permissions)
   */
  const refreshState = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true }));

    const availability = await checkAvailability();

    if (availability.available) {
      const permissions = await checkPermissions();
      setState({
        isAvailable: true,
        isLoading: false,
        permissions,
        unavailableReason: null,
      });
    } else {
      setState({
        isAvailable: false,
        isLoading: false,
        permissions: null,
        unavailableReason: availability.reason || 'not_supported',
      });
    }
  }, [checkAvailability, checkPermissions]);

  // Initialize on mount
  useEffect(() => {
    if (isAndroid) {
      refreshState();
    } else {
      setState({
        isAvailable: false,
        isLoading: false,
        permissions: null,
        unavailableReason: 'not_supported',
      });
    }
  }, [isAndroid, refreshState]);

  return {
    state,
    isAndroid,
    checkAvailability,
    requestPermissions,
    syncFocusSession,
    getSleepData,
    getStepsData,
    openHealthConnect,
    refreshState,
  };
}

export default useHealthConnect;
