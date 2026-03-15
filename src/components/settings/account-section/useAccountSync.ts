import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { loadWeeklyDigest, updateWeeklyDigest } from '@/lib/accountService';
import { syncWithCloud } from '@/storage/cloudSync';
import { isCloudSyncEnabled, setCloudSyncEnabled } from '@/lib/cloudSyncSettings';
import { isCalendarConnected } from '@/lib/googleCalendar';
import { logger } from '@/lib/logger';
import { formatError } from './types';

interface UseAccountSyncOptions {
  sessionEmail: string | null;
  setAuthStatus: (status: string | null) => void;
  t: Record<string, string>;
}

export function useAccountSync({ sessionEmail, setAuthStatus, t }: UseAccountSyncOptions) {
  const [cloudSyncEnabled, setCloudSyncEnabledState] = useState(isCloudSyncEnabled());
  const [isSyncing, setIsSyncing] = useState(false);
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false);
  const [weeklyDigestLoading, setWeeklyDigestLoading] = useState(false);
  const weeklyDigestTouchedRef = useRef(false);
  // Google Calendar integration (hidden until OAuth verification)
  const [, setCalendarConnected] = useState(false);
  const cloudSyncDebounceRef = useRef(false);

  // Google Calendar connection check
  useEffect(() => {
    if (!sessionEmail) return;
    isCalendarConnected().then(setCalendarConnected).catch(err => logger.warn('[Account]', 'Calendar check failed:', err));
  }, [sessionEmail]);

  // Load weekly digest setting
  useEffect(() => {
    if (!supabase || !sessionEmail) return;
    const loadWeeklyDigestSetting = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const value = await loadWeeklyDigest(user.id);
        if (weeklyDigestTouchedRef.current) return;
        if (value !== null) {
          setWeeklyDigestEnabled(value);
        }
      } catch (error) {
        logger.error('[AccountSection] Error loading weekly digest:', error);
      }
    };
    void loadWeeklyDigestSetting();
  }, [sessionEmail]);

  const handleSync = async () => {
    if (!supabase) {
      setAuthStatus(t.cloudSyncDisabled);
      return;
    }
    setIsSyncing(true);
    setAuthStatus(null);
    try {
      const result = await syncWithCloud('merge');
      setAuthStatus(result.status === 'pulled' ? t.syncPulled : t.syncPushed);
    } catch (error) {
      const errorMessage = formatError(error);
      logger.error('[AccountSection] Sync failed:', errorMessage);
      setAuthStatus(`${t.syncError} ${errorMessage}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloudSyncToggle = (enabled: boolean) => {
    if (cloudSyncDebounceRef.current) return;
    cloudSyncDebounceRef.current = true;
    setTimeout(() => { cloudSyncDebounceRef.current = false; }, 500);
    setCloudSyncEnabled(enabled);
    setCloudSyncEnabledState(enabled);
    if (enabled) {
      setAuthStatus(t.settingsCloudSyncEnabled);
      void handleSync();
    } else {
      setAuthStatus(t.settingsCloudSyncDisabledByUser);
    }
  };

  const handleWeeklyDigestToggle = async (enabled: boolean) => {
    if (!supabase) return;
    setWeeklyDigestLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setWeeklyDigestEnabled(!enabled);
        logger.warn('[AccountSection] No user for weekly digest');
        return;
      }
      const success = await updateWeeklyDigest(user.id, enabled);
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
    isSyncing,
    weeklyDigestEnabled,
    setWeeklyDigestEnabled,
    weeklyDigestLoading,
    weeklyDigestTouchedRef,
    handleSync,
    handleCloudSyncToggle,
    handleWeeklyDigestToggle,
  };
}
