/**
 * Session Timeout Hook
 *
 * Automatically signs out the user after a period of inactivity.
 * This is a security measure for shared devices.
 *
 * Default timeout: 15 minutes of inactivity
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';

const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export function useSessionTimeout(enabled: boolean = true) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled || !supabase) return;

    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        logger.log('[SessionTimeout] Idle timeout reached, signing out');

        try {
          await supabase?.auth.signOut();
          // Reload to show login screen
          window.location.reload();
        } catch (error) {
          logger.error('[SessionTimeout] Error signing out:', error);
        }
      }, IDLE_TIMEOUT);
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
  }, [enabled]);
}
