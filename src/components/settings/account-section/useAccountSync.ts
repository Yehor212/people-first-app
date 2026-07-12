import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { loadWeeklyDigest, updateWeeklyDigest } from '@/lib/accountService';
import { startAutoSync } from '@/storage/cloudSync';
import { ensureCloudSyncEnabled, isCloudSyncEnabled } from '@/lib/cloudSyncSettings';
import { isCalendarConnected } from '@/lib/googleCalendar';
import { logger } from '@/lib/logger';
import { SyncOwnerBoundaryError, validateSyncOwner } from '@/storage/sync/syncOwner';

interface UseAccountSyncOptions {
  sessionUserId: string | null;
  setAuthStatus: (status: string | null) => void;
  t: Record<string, string>;
}

export function useAccountSync({ sessionUserId, setAuthStatus, t }: UseAccountSyncOptions) {
  const [cloudSyncEnabled, setCloudSyncEnabledState] = useState(isCloudSyncEnabled());
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false);
  const [weeklyDigestLoading, setWeeklyDigestLoading] = useState(false);
  const weeklyDigestTouchedRef = useRef(false);
  const weeklyDigestGenerationRef = useRef(0);
  const weeklyDigestOwnerRef = useRef<string | null>(sessionUserId);
  // Google Calendar integration (hidden until OAuth verification)
  const [, setCalendarConnected] = useState(false);

  // Reset account-owned presentation state before the new account can paint.
  useLayoutEffect(() => {
    weeklyDigestGenerationRef.current += 1;
    weeklyDigestOwnerRef.current = sessionUserId;
    weeklyDigestTouchedRef.current = false;
    setWeeklyDigestEnabled(false);
    setWeeklyDigestLoading(false);
  }, [sessionUserId]);

  // Google Calendar connection check
  useEffect(() => {
    if (!sessionUserId) return;
    isCalendarConnected().then(setCalendarConnected).catch(err => logger.warn('[Account]', 'Calendar check failed:', err));
  }, [sessionUserId]);

  // Signed-in accounts sync automatically. Upgrade any legacy local "disabled"
  // value so queue-based sync cannot be skipped after auth succeeds.
  useEffect(() => {
    if (!supabase || !sessionUserId) {
      setCloudSyncEnabledState(isCloudSyncEnabled());
      return;
    }
    ensureCloudSyncEnabled();
    setCloudSyncEnabledState(true);
    startAutoSync();
  }, [sessionUserId]);

  // Load weekly digest setting
  useEffect(() => {
    const client = supabase;
    if (!client || !sessionUserId) return;
    const expectedOwnerUserId = sessionUserId;
    const operationGeneration = weeklyDigestGenerationRef.current;
    const loadWeeklyDigestSetting = async () => {
      try {
        await validateSyncOwner(expectedOwnerUserId, 'Weekly digest load');
        if (
          weeklyDigestGenerationRef.current !== operationGeneration ||
          weeklyDigestOwnerRef.current !== expectedOwnerUserId
        ) {
          return;
        }
        const value = await loadWeeklyDigest(expectedOwnerUserId);
        if (
          weeklyDigestGenerationRef.current !== operationGeneration ||
          weeklyDigestOwnerRef.current !== expectedOwnerUserId
        ) {
          return;
        }
        await validateSyncOwner(expectedOwnerUserId, 'Weekly digest load');
        if (weeklyDigestTouchedRef.current) return;
        if (value !== null) {
          setWeeklyDigestEnabled(value);
        }
      } catch (error) {
        if (
          error instanceof SyncOwnerBoundaryError ||
          weeklyDigestGenerationRef.current !== operationGeneration ||
          weeklyDigestOwnerRef.current !== expectedOwnerUserId
        ) {
          return;
        }
        logger.error('[AccountSection] Error loading weekly digest:', error);
      }
    };
    void loadWeeklyDigestSetting();
  }, [sessionUserId]);

  const handleWeeklyDigestToggle = async (enabled: boolean) => {
    const client = supabase;
    if (!client || !sessionUserId) return;
    const expectedOwnerUserId = sessionUserId;
    const operationGeneration = weeklyDigestGenerationRef.current;
    weeklyDigestTouchedRef.current = true;
    setWeeklyDigestLoading(true);
    try {
      await validateSyncOwner(expectedOwnerUserId, 'Weekly digest update');
      if (
        weeklyDigestGenerationRef.current !== operationGeneration ||
        weeklyDigestOwnerRef.current !== expectedOwnerUserId
      ) {
        return;
      }
      const success = await updateWeeklyDigest(expectedOwnerUserId, enabled);
      if (
        weeklyDigestGenerationRef.current !== operationGeneration ||
        weeklyDigestOwnerRef.current !== expectedOwnerUserId
      ) {
        return;
      }
      await validateSyncOwner(expectedOwnerUserId, 'Weekly digest update');
      if (!success) {
        setWeeklyDigestEnabled(!enabled);
        setAuthStatus(t.weeklyDigestError || 'Could not update weekly digest. Try again.');
      }
    } catch (error) {
      if (
        error instanceof SyncOwnerBoundaryError ||
        weeklyDigestGenerationRef.current !== operationGeneration ||
        weeklyDigestOwnerRef.current !== expectedOwnerUserId
      ) {
        return;
      }
      setWeeklyDigestEnabled(!enabled);
      logger.error('[AccountSection] Weekly digest toggle error:', error);
      setAuthStatus(t.weeklyDigestError || 'Could not update weekly digest. Try again.');
    } finally {
      if (
        weeklyDigestGenerationRef.current === operationGeneration &&
        weeklyDigestOwnerRef.current === expectedOwnerUserId
      ) {
        setWeeklyDigestLoading(false);
      }
    }
  };

  return {
    cloudSyncEnabled,
    weeklyDigestEnabled,
    setWeeklyDigestEnabled,
    weeklyDigestLoading,
    weeklyDigestTouchedRef,
    handleWeeklyDigestToggle,
  };
}
