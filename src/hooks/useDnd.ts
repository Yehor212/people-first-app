/**
 * useDnd Hook
 *
 * React hook for checking Do Not Disturb status.
 * Used to respect user's DND preferences when sending notifications.
 */

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import DndPlugin, { DndStatusResult } from '@/plugins/DndPlugin';
import { logger } from '@/lib/logger';

// ============================================
// TYPES
// ============================================

export interface UseDndReturn {
  /** Whether DND mode is currently active */
  isDndActive: boolean;
  /** Whether DND checking is available on this platform */
  isAvailable: boolean;
  /** Detailed DND status */
  status: DndStatusResult | null;
  /** Refresh DND status */
  refresh: () => Promise<void>;
  /** Whether the hook is loading */
  isLoading: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if DND is currently active
 * Can be used outside of React components
 */
export async function checkDndActive(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    const result = await DndPlugin.isDndActive();
    return result.active;
  } catch (error) {
    logger.error('[DND] Failed to check DND status:', error);
    return false;
  }
}

/**
 * Get detailed DND status
 * Can be used outside of React components
 */
export async function getDndStatus(): Promise<DndStatusResult> {
  if (!Capacitor.isNativePlatform()) {
    return { available: false };
  }

  try {
    return await DndPlugin.getDndStatus();
  } catch (error) {
    logger.error('[DND] Failed to get DND status:', error);
    return { available: false };
  }
}

// ============================================
// HOOK
// ============================================

export function useDnd(): UseDndReturn {
  const isNative = Capacitor.isNativePlatform();
  const [isDndActive, setIsDndActive] = useState(false);
  const [status, setStatus] = useState<DndStatusResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isNative) {
      setIsLoading(false);
      return;
    }

    try {
      const [activeResult, statusResult] = await Promise.all([
        DndPlugin.isDndActive(),
        DndPlugin.getDndStatus(),
      ]);

      setIsDndActive(activeResult.active);
      setStatus(statusResult);
      logger.log('[useDnd] DND status refreshed:', activeResult.active);
    } catch (error) {
      logger.error('[useDnd] Failed to refresh DND status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isNative]);

  // Initial check on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Periodically check DND status (every 30 seconds when app is focused)
  useEffect(() => {
    if (!isNative) return;

    const interval = setInterval(refresh, 30000);

    // Also check when app comes to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isNative, refresh]);

  return {
    isDndActive,
    isAvailable: status?.available ?? false,
    status,
    refresh,
    isLoading,
  };
}

export default useDnd;
