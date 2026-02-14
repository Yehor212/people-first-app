import { useEffect, useRef, useState } from 'react';
import { Cloud, CheckCircle, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Switch } from '@/components/ui/switch';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/supabaseClient';
import { syncWithCloud } from '@/storage/cloudSync';
import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { isCloudSyncEnabled, setCloudSyncEnabled } from '@/lib/cloudSyncSettings';
import { removePushToken } from '@/lib/pushNotifications';
import { offlineQueue } from '@/lib/offlineQueue';
import { isCalendarEnabled, isCalendarConnected } from '@/lib/googleCalendar';

interface AccountSectionProps {
  userName: string;
  onNameChange: (name: string) => void;
  onResetData: () => void;
}

export function AccountSection({ userName, onNameChange, onResetData }: AccountSectionProps) {
  const { t } = useLanguage();

  // ── State ──────────────────────────────────────────────────────────
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [cloudSyncEnabled, setCloudSyncEnabledState] = useState(isCloudSyncEnabled());
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false);
  const [weeklyDigestLoading, setWeeklyDigestLoading] = useState(false);
  const weeklyDigestTouchedRef = useRef(false);
  // Google Calendar integration (hidden until OAuth verification)
  const [_calendarEnabled, _setCalendarEnabledState] = useState(isCalendarEnabled());
  const [_calendarConnected, setCalendarConnected] = useState(false);
  const cloudSyncDebounceRef = useRef(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const accountSectionRef = useRef<HTMLDivElement | null>(null);

  // ── Derived ────────────────────────────────────────────────────────
  const baseUrl = import.meta.env.BASE_URL || '/';
  const deleteAccountHref = `${baseUrl}delete-account.html`;

  // ── Modal hooks ────────────────────────────────────────────────────
  useBackHandler(showDeleteConfirm, () => setShowDeleteConfirm(false));
  useScrollLock(showDeleteConfirm);

  // ── Auto-clear status messages after 3 s ───────────────────────────
  useEffect(() => {
    if (!authStatus) return;
    const timer = window.setTimeout(() => setAuthStatus(null), 3000);
    return () => window.clearTimeout(timer);
  }, [authStatus]);

  useEffect(() => {
    if (!deleteStatus) return;
    const timer = window.setTimeout(() => setDeleteStatus(null), 3000);
    return () => window.clearTimeout(timer);
  }, [deleteStatus]);

  // ── Session check ──────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user?.email ?? null);
    }).catch(() => { /* no-op */ });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
    });
    return () => {
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  // ── Google Calendar connection ─────────────────────────────────────
  useEffect(() => {
    if (!sessionEmail) return;
    isCalendarConnected().then(setCalendarConnected).catch(() => { /* no-op */ });
  }, [sessionEmail]);

  // ── Load weekly digest setting ─────────────────────────────────────
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

  // ── Helpers ────────────────────────────────────────────────────────
  const formatError = (error: unknown) => {
    if (error && typeof error === 'object') {
      const errObj = error as {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
      };
      const parts = [errObj.code, errObj.message, errObj.details, errObj.hint].filter(Boolean);
      if (parts.length) {
        return parts.join(' | ');
      }
      try {
        return JSON.stringify(error);
      } catch {
        return '[Unserializable error object]';
      }
    }
    return typeof error === 'string'
      ? error
      : typeof error === 'number' || typeof error === 'boolean'
        ? String(error)
        : 'Unknown error';
  };

  // ── Auth handlers ──────────────────────────────────────────────────
  const handleGoogle = async () => {
    if (!supabase) {
      setAuthStatus(t.authNotConfigured);
      return;
    }

    setIsSigningIn(true);
    const redirectUrl = getAuthRedirectUrl();
    logger.log('[AccountSection] Starting Google sign-in with redirect:', redirectUrl);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        logger.error('[AccountSection] Google sign-in error:', error);
        setAuthStatus(t.authError);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;

    setIsSigningOut(true);
    try {
      // Flush offline queue before signing out to prevent data loss
      if (offlineQueue.hasPendingActions()) {
        logger.log('[AccountSection] Flushing offline queue before sign-out...');
        try {
          await Promise.race([
            offlineQueue.processQueue(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Queue flush timeout')), 10000)
            ),
          ]);
          logger.log('[AccountSection] Offline queue flushed successfully');
        } catch (flushError) {
          logger.warn('[AccountSection] Could not flush offline queue:', flushError);
          // Continue with sign-out even if flush fails
        }
      }

      // Remove FCM push token before signing out
      await removePushToken();
      await supabase.auth.signOut();
      // Reset userName to prevent "ghost user" greeting on next app open
      onNameChange('Friend');
      setAuthStatus(t.authSignedOut);
    } finally {
      setIsSigningOut(false);
    }
  };

  // ── Sync handler ───────────────────────────────────────────────────
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
      toast.error(t.syncError || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloudSyncToggle = (enabled: boolean) => {
    // Debounce to prevent rapid toggle race conditions
    if (cloudSyncDebounceRef.current) return;
    cloudSyncDebounceRef.current = true;
    setTimeout(() => { cloudSyncDebounceRef.current = false; }, 500);

    setCloudSyncEnabled(enabled);
    setCloudSyncEnabledState(enabled);

    if (enabled) {
      setAuthStatus(t.settingsCloudSyncEnabled);
      // Trigger immediate sync when enabled
      void handleSync();
    } else {
      setAuthStatus(t.settingsCloudSyncDisabledByUser);
    }
  };

  // ── Weekly digest handler ──────────────────────────────────────────
  const handleWeeklyDigestToggle = async (enabled: boolean) => {
    if (!supabase) return;

    setWeeklyDigestLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setWeeklyDigestEnabled(!enabled); // Revert optimistic update
        logger.warn('[AccountSection] No user for weekly digest');
        return;
      }

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          weekly_digest_enabled: enabled,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        setWeeklyDigestEnabled(!enabled); // Revert on error
        logger.error('[AccountSection] Failed to update weekly digest:', error);
        toast.error(t.settingsSaveFailed || 'Failed to save setting');
      }
    } catch (error) {
      setWeeklyDigestEnabled(!enabled); // Revert on error
      logger.error('[AccountSection] Weekly digest toggle error:', error);
      toast.error(t.settingsSaveFailed || 'Failed to save setting');
    } finally {
      setWeeklyDigestLoading(false);
    }
  };

  // ── Delete account handler ─────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!supabase) {
      setDeleteStatus(t.deleteAccountError);
      return;
    }
    setIsDeletingAccount(true);
    setDeleteStatus(null);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) {
        throw error;
      }
      await supabase.auth.signOut();
      onResetData();
      setShowDeleteConfirm(false);
      setDeleteStatus(t.deleteAccountSuccess);
    } catch (error) {
      logger.error('[AccountSection] Delete account failed:', error);
      setDeleteStatus(t.deleteAccountError);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // ── JSX ────────────────────────────────────────────────────────────
  return (
    <AccordionItem ref={accountSectionRef} value="account" className="bg-card rounded-2xl shadow-zen-sm border overflow-hidden">
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="p-2 zen-gradient rounded-xl shadow-zen-soft">
            <Cloud className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">{t.settingsGroupAccount || 'Account'}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        <p className="text-muted-foreground mb-4">{t.accountDescription || 'Manage your account and cloud sync settings.'}</p>

        {!supabase ? (
          <p className="text-sm text-muted-foreground">{t.cloudSyncDisabled || 'Cloud sync is not available.'}</p>
        ) : sessionEmail ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t.signedInAs || 'Signed in as'}{' '}
              <span className="text-foreground font-medium">{sessionEmail}</span>
            </p>

            {/* Cloud Sync Toggle */}
            <div className="p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <Cloud className={cn(
                    'w-5 h-5 shrink-0',
                    cloudSyncEnabled ? 'text-green-500' : 'text-muted-foreground',
                  )} />
                  <span className="font-medium text-foreground">
                    {t.settingsCloudSyncTitle || 'Cloud Sync'}
                  </span>
                </div>
                <Switch
                  checked={cloudSyncEnabled}
                  onCheckedChange={handleCloudSyncToggle}
                  aria-label={t.settingsCloudSyncTitle || 'Cloud Sync'}
                  className="shrink-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t.settingsCloudSyncDescription || 'Sync your data across devices.'}
              </p>
              {cloudSyncEnabled && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  <span>{t.settingsCloudSyncEnabled || 'Cloud sync is active'}</span>
                </div>
              )}
            </div>

            {/* Weekly Digest Toggle */}
            <div className="p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <Mail className={cn(
                    'w-5 h-5 shrink-0',
                    weeklyDigestEnabled ? 'text-green-500' : 'text-muted-foreground',
                  )} />
                  <span className="font-medium text-foreground">
                    {t.weeklyDigestTitle || 'Weekly Progress Report'}
                  </span>
                </div>
                <Switch
                  checked={weeklyDigestEnabled}
                  onCheckedChange={(checked) => {
                    weeklyDigestTouchedRef.current = true;
                    setWeeklyDigestEnabled(checked); // Optimistic update
                    void handleWeeklyDigestToggle(checked);
                  }}
                  disabled={weeklyDigestLoading}
                  aria-label={t.weeklyDigestTitle || 'Weekly Progress Report'}
                  className="shrink-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t.weeklyDigestDescription || 'Receive a weekly summary of your habits, focus time, and mood trends every Sunday.'}
              </p>
              {weeklyDigestEnabled && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  <span>{t.weeklyDigestEnabled || "You'll receive reports at your email"}</span>
                </div>
              )}
            </div>

            {/* Google Calendar Toggle — hidden until Google OAuth verification is complete */}

            <button
              onClick={() => { void handleSync(); }}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors btn-press flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!cloudSyncEnabled || isSyncing}
            >
              {isSyncing && <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.syncing || 'Syncing...'} />}
              {isSyncing ? (t.syncing || 'Syncing...') : (t.syncNow || 'Sync Now')}
            </button>
            <button
              onClick={() => { void handleSignOut(); }}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors btn-press flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSigningOut}
            >
              {isSigningOut && <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.signingOut || 'Signing out...'} />}
              {isSigningOut ? (t.signingOut || 'Signing out...') : (t.signOut || 'Sign Out')}
            </button>
            {!showDeleteConfirm ? (
              <button
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setDeleteConfirmInput(''); // Reset input on open
                }}
                className="w-full py-3 bg-destructive/10 text-destructive rounded-xl font-medium hover:bg-destructive/20 transition-colors btn-press"
              >
                {t.deleteAccount || 'Delete Account'}
              </button>
            ) : (
              <div className="p-4 bg-destructive/10 rounded-xl motion-safe:animate-scale-in space-y-3" aria-describedby="delete-account-warning">
                <p className="text-sm text-destructive font-medium">
                  {t.deleteAccountConfirm || 'Are you sure you want to delete your account?'}
                </p>
                <p id="delete-account-warning" className="text-xs text-muted-foreground">
                  {t.deleteAccountWarning || 'This action cannot be undone. All your cloud data will be permanently deleted.'}
                </p>
                {/* Require typing DELETE to confirm */}
                <div>
                  <label className="text-xs text-destructive font-medium block mb-1">
                    {t.deleteAccountTypeConfirm || 'Type DELETE to confirm:'}
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder="DELETE"
                    className="w-full p-2 bg-secondary rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30"
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmInput('');
                    }}
                    className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg"
                  >
                    {t.cancel || 'Cancel'}
                  </button>
                  <button
                    onClick={() => { void handleDeleteAccount(); }}
                    disabled={deleteConfirmInput !== 'DELETE' || isDeletingAccount}
                    className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    {isDeletingAccount && <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.deleting || 'Deleting...'} />}
                    {isDeletingAccount ? (t.deleting || 'Deleting...') : (t.delete || 'Delete')}
                  </button>
                </div>
              </div>
            )}
            <a
              href={deleteAccountHref}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline hover:text-primary/90"
            >
              {t.deleteAccountLink || 'Learn about account deletion'}
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Session expired warning - show when user was previously signed in */}
            {(cloudSyncEnabled || userName !== 'Friend') && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {t.sessionExpiredSettings || 'Your session has expired'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.localDataSafe || 'Your local data is safe. Sign in again to resume syncing.'}
                </p>
              </div>
            )}
            <button
              onClick={() => { void handleGoogle(); }}
              disabled={isSigningIn}
              className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningIn && <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.signingIn || 'Signing in...'} />}
              {t.continueWithGoogle || 'Continue with Google'}
            </button>
          </div>
        )}

        <div role="status" aria-live="polite">
          {authStatus && (
            <p className="text-sm text-muted-foreground mt-3">{authStatus}</p>
          )}
        </div>
        <div role="status" aria-live="polite">
          {deleteStatus && (
            <p className="text-sm text-muted-foreground mt-3">{deleteStatus}</p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
