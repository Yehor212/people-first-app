import { useRef, useEffect } from 'react';
import { Cloud, CheckCircle, Loader2, Mail } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/supabaseClient';
import type { AccountSectionProps } from './types';
import { useAccountAuth } from './useAccountAuth';
import { useAccountSync } from './useAccountSync';
import { useDeleteAccount } from './useDeleteAccount';
import { BASE_URL } from '@/lib/env';

export function AccountSection({ userName, onNameChange, onResetData }: AccountSectionProps) {
  const { t } = useLanguage();
  const tRecord = t as unknown as Record<string, string>;
  const accountSectionRef = useRef<HTMLDivElement | null>(null);

  const auth = useAccountAuth({ onNameChange, t: tRecord });
  const sync = useAccountSync({ sessionEmail: auth.sessionEmail, setAuthStatus: auth.setAuthStatus, t: tRecord });
  const del = useDeleteAccount({ onResetData, t: tRecord });

  useBackHandler(del.showDeleteConfirm, () => del.setShowDeleteConfirm(false));
  useScrollLock(del.showDeleteConfirm);

  // Escape key: dismiss delete confirmation
  const { showDeleteConfirm, setShowDeleteConfirm } = del;
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setShowDeleteConfirm(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showDeleteConfirm, setShowDeleteConfirm]);

  const baseUrl = BASE_URL;
  const deleteAccountHref = `${baseUrl}delete-account.html`;

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
        ) : auth.sessionEmail ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t.signedInAs || 'Signed in as'}{' '}
              <span className="text-foreground font-medium">{auth.sessionEmail}</span>
            </p>

            {/* Cloud Sync Toggle */}
            <div className="p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <Cloud className={cn(
                    'w-5 h-5 shrink-0',
                    sync.cloudSyncEnabled ? 'text-green-500' : 'text-muted-foreground',
                  )} />
                  <span className="font-medium text-foreground">
                    {t.settingsCloudSyncTitle || 'Cloud Sync'}
                  </span>
                </div>
                <Switch
                  checked={sync.cloudSyncEnabled}
                  onCheckedChange={sync.handleCloudSyncToggle}
                  aria-label={t.settingsCloudSyncTitle || 'Cloud Sync'}
                  className="shrink-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t.settingsCloudSyncDescription || 'Sync your data across devices.'}
              </p>
              {sync.cloudSyncEnabled && (
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
                    sync.weeklyDigestEnabled ? 'text-green-500' : 'text-muted-foreground',
                  )} />
                  <span className="font-medium text-foreground">
                    {t.weeklyDigestTitle || 'Weekly Progress Report'}
                  </span>
                </div>
                <Switch
                  checked={sync.weeklyDigestEnabled}
                  onCheckedChange={(checked) => {
                    sync.weeklyDigestTouchedRef.current = true;
                    sync.setWeeklyDigestEnabled(checked);
                    void sync.handleWeeklyDigestToggle(checked);
                  }}
                  disabled={sync.weeklyDigestLoading}
                  aria-label={t.weeklyDigestTitle || 'Weekly Progress Report'}
                  className="shrink-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t.weeklyDigestDescription || 'Receive a weekly summary of your habits, focus time, and mood trends every Sunday.'}
              </p>
              {sync.weeklyDigestEnabled && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  <span>{t.weeklyDigestEnabled || "You'll receive reports at your email"}</span>
                </div>
              )}
            </div>

            {/* Google Calendar Toggle — hidden until Google OAuth verification is complete */}

            <button
              onClick={() => { void sync.handleSync(); }}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors btn-press flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!sync.cloudSyncEnabled || sync.isSyncing}
            >
              {sync.isSyncing && <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.syncing || 'Syncing...'} />}
              {sync.isSyncing ? (t.syncing || 'Syncing...') : (t.syncNow || 'Sync Now')}
            </button>
            <button
              onClick={() => { void auth.handleSignOut(); }}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors btn-press flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={auth.isSigningOut}
            >
              {auth.isSigningOut && <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.signingOut || 'Signing out...'} />}
              {auth.isSigningOut ? (t.signingOut || 'Signing out...') : (t.signOut || 'Sign Out')}
            </button>
            {!del.showDeleteConfirm ? (
              <button
                onClick={() => {
                  del.setShowDeleteConfirm(true);
                  del.setDeleteConfirmInput('');
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
                <div>
                  <label className="text-xs text-destructive font-medium block mb-1">
                    {t.deleteAccountTypeConfirm || 'Type DELETE to confirm:'}
                  </label>
                  <input
                    type="text"
                    value={del.deleteConfirmInput}
                    onChange={(e) => del.setDeleteConfirmInput(e.target.value)}
                    placeholder={t.deleteConfirmWord || 'DELETE'}
                    aria-label={t.deleteAccountTypeConfirm || 'Type DELETE to confirm'}
                    className="w-full p-2 bg-secondary rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30"
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      del.setShowDeleteConfirm(false);
                      del.setDeleteConfirmInput('');
                    }}
                    className="flex-1 py-2 min-h-[44px] bg-secondary text-secondary-foreground rounded-lg"
                  >
                    {t.cancel || 'Cancel'}
                  </button>
                  <button
                    onClick={() => { void del.handleDeleteAccount(); }}
                    disabled={del.deleteConfirmInput !== (t.deleteConfirmWord || 'DELETE') || del.isDeletingAccount}
                    className="flex-1 py-2 min-h-[44px] bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    {del.isDeletingAccount && <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.deleting || 'Deleting...'} />}
                    {del.isDeletingAccount ? (t.deleting || 'Deleting...') : (t.delete || 'Delete')}
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
            {(sync.cloudSyncEnabled || userName !== 'Friend') && (
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
              onClick={() => { void auth.handleGoogle(); }}
              disabled={auth.isSigningIn}
              className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {auth.isSigningIn && <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.signingIn || 'Signing in...'} />}
              {t.continueWithGoogle || 'Continue with Google'}
            </button>
          </div>
        )}

        <div role="status" aria-live="polite">
          {auth.authStatus && (
            <p className="text-sm text-muted-foreground mt-3">{auth.authStatus}</p>
          )}
        </div>
        <div role="status" aria-live="polite">
          {del.deleteStatus && (
            <p className="text-sm text-muted-foreground mt-3">{del.deleteStatus}</p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
