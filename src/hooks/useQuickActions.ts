/**
 * useQuickActions Hook
 *
 * React hook for managing lock screen quick actions.
 * Provides toggle functionality and handles action callbacks.
 */

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  initializeQuickActions,
  toggleQuickActionsNotification,
  setQuickActionCallback,
  setupQuickActionsListener,
  getQuickActionsSetting,
  saveQuickActionsSetting,
  QUICK_ACTION_IDS,
} from '@/lib/quickActions';
import { logger } from '@/lib/logger';

// ============================================
// TYPES
// ============================================

export type QuickActionType = 'mood' | 'focus' | 'habits';

export interface UseQuickActionsReturn {
  isEnabled: boolean;
  isAndroid: boolean;
  toggle: (enabled: boolean) => Promise<void>;
  onAction: (callback: (action: QuickActionType) => void) => void;
}

// ============================================
// HOOK
// ============================================

export function useQuickActions(): UseQuickActionsReturn {
  const isAndroid = Capacitor.getPlatform() === 'android';
  const [isEnabled, setIsEnabled] = useState(() => getQuickActionsSetting());
  const [actionCallback, setActionCallback] = useState<((action: QuickActionType) => void) | null>(null);

  // Initialize quick actions system
  useEffect(() => {
    if (!isAndroid) return;

    const init = async () => {
      await initializeQuickActions();

      // Set up listener for action taps
      const cleanup = await setupQuickActionsListener();

      return cleanup;
    };

    let cleanupFn: (() => void) | undefined;

    init().then(cleanup => {
      cleanupFn = cleanup;
    });

    return () => {
      cleanupFn?.();
    };
  }, [isAndroid]);

  // Register action callback
  useEffect(() => {
    if (!isAndroid) return;

    setQuickActionCallback((actionId) => {
      let action: QuickActionType | null = null;

      switch (actionId) {
        case QUICK_ACTION_IDS.LOG_MOOD:
          action = 'mood';
          break;
        case QUICK_ACTION_IDS.START_FOCUS:
          action = 'focus';
          break;
        case QUICK_ACTION_IDS.VIEW_HABITS:
          action = 'habits';
          break;
      }

      if (action && actionCallback) {
        logger.log('[useQuickActions] Triggering action:', action);
        actionCallback(action);
      }
    });
  }, [isAndroid, actionCallback]);

  /**
   * Toggle quick actions notification
   */
  const toggle = useCallback(async (enabled: boolean) => {
    if (!isAndroid) return;

    try {
      const success = await toggleQuickActionsNotification(enabled);

      if (success) {
        setIsEnabled(enabled);
        saveQuickActionsSetting(enabled);
        logger.log('[useQuickActions] Toggled:', enabled);
      }
    } catch (error) {
      logger.error('[useQuickActions] Toggle failed:', error);
    }
  }, [isAndroid]);

  /**
   * Register callback for quick action taps
   */
  const onAction = useCallback((callback: (action: QuickActionType) => void) => {
    setActionCallback(() => callback);
  }, []);

  return {
    isEnabled,
    isAndroid,
    toggle,
    onAction,
  };
}

export default useQuickActions;
