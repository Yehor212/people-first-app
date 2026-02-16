import { useEffect } from 'react';
import { useUIStore } from '@/stores';
import { checkForAppUpdate, wasUpdateDismissed } from '@/lib/appUpdateManager';
import { logger } from '@/lib/logger';

/**
 * Checks for Google Play In-App Updates after app is fully loaded.
 * Delays check by 3s to avoid blocking initial render.
 */
export function useAppUpdateCheck(isLoading: boolean, onboardingComplete: boolean): void {
  const setUpdateState = useUIStore(s => s.setUpdateState);

  useEffect(() => {
    if (isLoading || !onboardingComplete) return;

    const timeoutId = setTimeout(async () => {
      if (wasUpdateDismissed()) return;

      try {
        const state = await checkForAppUpdate();
        if (state.available) {
          logger.log('[AppUpdate] Update available:', state);
          setUpdateState(state);
        }
      } catch (error) {
        logger.warn('[AppUpdate] Check failed (non-critical):', error);
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [isLoading, onboardingComplete, setUpdateState]);
}
