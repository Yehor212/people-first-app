import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { loadWeeklyDigest, updateWeeklyDigest } from '@/lib/accountService';
import { startAutoSync } from '@/storage/cloudSync';
import { ensureCloudSyncEnabled, isCloudSyncEnabled } from '@/lib/cloudSyncSettings';
import { isCalendarConnected } from '@/lib/googleCalendar';
import { logger } from '@/lib/logger';

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
  // Google Calendar integration (hidden until OAuth verification)
  const [, setCalendarConnected] = useState(false);

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
    const loadWeeklyDigestSetting = async () => {
      try {
        const value = await loadWeeklyDigest(sessionUserId);
        if (weeklyDigestTouchedRef.current) return;
        if (value !== null) {
          setWeeklyDigestEnabled(value);
        }
      } catch (error) {
        logger.error('[AccountSection] Error loading weekly digest:', error);
      }
    };
    void loadWeeklyDigestSetting();
  }, [sessionUserId]);

  const handleWeeklyDigestToggle = async (enabled: boolean) => {
    const client = supabase;
    if (!client || !sessionUserId) return;
    setWeeklyDigestLoading(true);
    try {
      const success = await updateWeeklyDigest(sessionUserId, enabled);
      if (!success) {
        setWeeklyDigestEnabled(!enabled);
        setAuthStatus(t.weeklyDigestError || 'Could not update weekly digest. Try again.');
      }
    } catch (error) {
      setWeeklyDigestEnabled(!enabled);
      logger.error('[AccountSection] Weekly digest toggle error:', error);
      setAuthStatus(t.weeklyDigestError || 'Could not update weekly digest. Try again.');
    } finally {
      setWeeklyDigestLoading(false);
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
