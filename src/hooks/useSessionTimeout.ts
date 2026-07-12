/**
 * Session Timeout Hook
 *
 * Automatically signs out the user after a period of inactivity.
 * This is a security measure for shared devices (web only).
 *
 * - Native (Android/iOS): disabled — personal device, session managed by Supabase refresh token (90 days)
 * - Web: 24 hours of inactivity triggers sign-out
 *
 * Suspends account writers and blocks sign-out while durable writes remain,
 * preventing both data loss and cross-account replay.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { isNative } from '@/lib/platform';
import { logger } from '@/lib/logger';
import { initializePushNotifications } from '@/lib/pushNotifications';
import { performOwnerSafeSignOut } from '@/lib/accountSignOutCleanup';
import { useUserDataStore } from '@/stores';

const WEB_IDLE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const BLOCKED_SIGN_OUT_RETRY_DELAY = 5 * 60 * 1000;

type BlockedIdleSignOutReason =
  | 'pending-changes'
  | 'cleanup-failed'
  | 'sign-out-failed';

function reportBlockedIdleSignOut(
  reason: BlockedIdleSignOutReason,
  retry: () => void,
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('zenflow:session-timeout-blocked', {
      detail: { reason, retry },
    })
  );
}

export function useSessionTimeout(enabled: boolean = true) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pushNotificationsEnabled = useUserDataStore(
    (state) => state.privacy.pushNotifications === true,
  );

  useEffect(() => {
    // Disabled on native — personal device, no idle logout needed
    if (!enabled || !supabase || isNative) return;
    let retryPending = false;

    const scheduleTimer = (delay: number) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        void attemptIdleSignOut();
      }, delay);
    };

    const reportAndRetry = (reason: BlockedIdleSignOutReason) => {
      retryPending = true;
      reportBlockedIdleSignOut(reason, () => {
        void attemptIdleSignOut();
      });
      scheduleTimer(BLOCKED_SIGN_OUT_RETRY_DELAY);
    };

    async function attemptIdleSignOut(): Promise<void> {
      logger.log('[SessionTimeout] Idle timeout reached, signing out');

      try {
        const result = await performOwnerSafeSignOut({
          restorePushRegistration: pushNotificationsEnabled
            ? initializePushNotifications
            : undefined,
        });

        if (result.status === 'signed-out' || result.status === 'no-session') {
          retryPending = false;
          window.location.reload();
          return;
        }
        if (result.status === 'pending-changes') {
          reportAndRetry('pending-changes');
          return;
        }
        if (result.status === 'session-changed') {
          retryPending = false;
          scheduleTimer(WEB_IDLE_TIMEOUT);
          return;
        }
        reportAndRetry(
          result.status === 'sign-out-failed'
            ? 'sign-out-failed'
            : 'cleanup-failed',
        );
      } catch (error) {
        logger.error('[SessionTimeout] Error signing out:', error);
        reportAndRetry('cleanup-failed');
      }
    }

    const resetTimer = () => {
      if (retryPending) return;
      scheduleTimer(WEB_IDLE_TIMEOUT);
    };

    // Events that indicate user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

    // Add listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    // Start the timer
    resetTimer();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, pushNotificationsEnabled]);
}
