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
import { getVerifiedCurrentSessionUserId, supabase } from '@/lib/supabaseClient';
import { isNative } from '@/lib/platform';
import { logger } from '@/lib/logger';
import { initializePushNotifications } from '@/lib/pushNotifications';
import { performOwnerSafeSignOut } from '@/lib/accountSignOutCleanup';
import { useUserDataStore } from '@/stores';
import { reloadAppSafely } from '@/lib/versionCheck';
import {
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
  type OriginAccountBoundaryGeneration,
} from '@/storage/accountBoundaryRuntime';

const WEB_IDLE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const BLOCKED_SIGN_OUT_RETRY_DELAY = 5 * 60 * 1000;

type BlockedIdleSignOutReason =
  | 'pending-changes'
  | 'cleanup-failed'
  | 'sign-out-failed';

type IdleSignOutBinding = {
  ownerUserId: string;
  generation: OriginAccountBoundaryGeneration;
};

function reportBlockedIdleSignOut(
  reason: BlockedIdleSignOutReason,
  retry: () => void | Promise<void>,
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
    let retryBinding: IdleSignOutBinding | null = null;

    const scheduleTimer = (delay: number, binding: IdleSignOutBinding | null = null) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        void attemptIdleSignOut(binding);
      }, delay);
    };

    const scheduleFreshIdleWindow = () => {
      retryPending = false;
      retryBinding = null;
      scheduleTimer(WEB_IDLE_TIMEOUT);
    };

    const readBoundOwner = async (): Promise<{
      ownerUserId: string | null;
      generation: OriginAccountBoundaryGeneration;
    }> => {
      const generation = captureOriginAccountBoundaryGeneration();
      const ownerUserId = await getVerifiedCurrentSessionUserId();
      assertOriginAccountBoundaryGeneration(generation);
      return { ownerUserId, generation };
    };

    const refreshRetryBinding = async (
      binding: IdleSignOutBinding,
      allowSignedOutOwner: boolean,
    ): Promise<IdleSignOutBinding | null> => {
      const current = await readBoundOwner();
      if (current.ownerUserId === binding.ownerUserId) {
        return current.generation === binding.generation ? binding : null;
      }
      if (allowSignedOutOwner && current.ownerUserId === null) {
        // A completed local sign-out may advance the durable generation before
        // its marker cleanup finishes. Only the verified signed-out state may
        // carry the original owner authority into that post-purge generation.
        return { ownerUserId: binding.ownerUserId, generation: current.generation };
      }
      return null;
    };

    const reportAndRetry = (
      reason: BlockedIdleSignOutReason,
      binding: IdleSignOutBinding,
    ) => {
      retryPending = true;
      retryBinding = binding;
      reportBlockedIdleSignOut(reason, () => attemptIdleSignOut(binding));
      scheduleTimer(BLOCKED_SIGN_OUT_RETRY_DELAY, binding);
    };

    async function attemptIdleSignOut(
      requestedBinding: IdleSignOutBinding | null = retryBinding,
    ): Promise<void> {
      logger.log('[SessionTimeout] Idle timeout reached, signing out');

      try {
        let binding = requestedBinding;
        if (!binding) {
          const current = await readBoundOwner();
          binding = current.ownerUserId
            ? { ownerUserId: current.ownerUserId, generation: current.generation }
            : null;
        }
        if (!binding) {
          retryPending = false;
          retryBinding = null;
          await reloadAppSafely();
          return;
        }

        const result = await performOwnerSafeSignOut({
          expectedOwnerUserId: binding.ownerUserId,
          expectedAccountBoundaryGeneration: binding.generation,
          restorePushRegistration: pushNotificationsEnabled
            ? initializePushNotifications
            : undefined,
        });

        if (result.status === 'signed-out' || result.status === 'no-session') {
          retryPending = false;
          retryBinding = null;
          await reloadAppSafely();
          return;
        }
        if (result.status === 'session-changed') {
          scheduleFreshIdleWindow();
          return;
        }
        const nextBinding = await refreshRetryBinding(
          binding,
          result.status === 'cleanup-failed' && result.sessionEnded,
        );
        if (!nextBinding) {
          scheduleFreshIdleWindow();
          return;
        }
        const reason: BlockedIdleSignOutReason =
          result.status === 'pending-changes'
            ? 'pending-changes'
            : result.status === 'sign-out-failed'
              ? 'sign-out-failed'
              : 'cleanup-failed';
        reportAndRetry(reason, nextBinding);
      } catch (error) {
        logger.error('[SessionTimeout] Error signing out:', error);
        if (requestedBinding) {
          reportAndRetry('cleanup-failed', requestedBinding);
        } else {
          scheduleFreshIdleWindow();
        }
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
