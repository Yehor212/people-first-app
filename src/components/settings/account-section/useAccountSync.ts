import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
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
        const { data, error } = await supabase
          .from('user_settings')
          .select('weekly_digest_enabled')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) {
          logger.error('[AccountSection] Failed to load weekly digest setting:', error);
          return;
        }
        if (weeklyDigestTouchedRef.current) return;
        if (data) {
          setWeeklyDigestEnabled(data.weekly_digest_enabled ?? false);
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
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          weekly_digest_enabled: enabled,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) {
        setWeeklyDigestEnabled(!enabled);
        logger.error('[AccountSection] Failed to update weekly digest:', error);
      }
    } catch (error) {
      setWeeklyDigestEnabled(!enabled);
      logger.error('[AccountSection] Weekly digest toggle error:', error);
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
