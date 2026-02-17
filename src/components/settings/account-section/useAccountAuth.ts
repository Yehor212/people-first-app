import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { isNative } from '@/lib/platform';
import { authenticateWithGoogleNative } from '@/lib/nativeGoogleAuth';
import { removePushToken } from '@/lib/pushNotifications';
import { offlineQueue } from '@/lib/offlineQueue';
import { stopAutoSync } from '@/storage/cloudSync';
import { clearLocalUserData } from '@/storage/db';
import { triggerDataRefresh } from '@/hooks/useIndexedDB';
import { logger } from '@/lib/logger';

interface UseAccountAuthOptions {
  onNameChange: (name: string) => void;
  t: Record<string, string>;
}

export function useAccountAuth({ onNameChange, t }: UseAccountAuthOptions) {
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Auto-clear status messages after 3s
  useEffect(() => {
    if (!authStatus) return;
    const timer = window.setTimeout(() => setAuthStatus(null), 3000);
    return () => window.clearTimeout(timer);
  }, [authStatus]);

  // Session check + auth state subscription
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user?.email ?? null);
    }).catch(err => logger.warn('[Account]', 'Session check failed:', err));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
    });
    return () => {
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleGoogle = async () => {
    if (!supabase) {
      setAuthStatus(t.authNotConfigured);
      return;
    }
    setIsSigningIn(true);
    try {
      if (isNative) {
        logger.log('[AccountSection] Starting native Google sign-in...');
        const result = await authenticateWithGoogleNative();
        if (result.success) {
          logger.log('[AccountSection] Native sign-in successful');
        } else if (result.error === 'cancelled') {
          logger.log('[AccountSection] User cancelled sign-in');
        } else {
          logger.error('[AccountSection] Native sign-in failed:', result.error);
          setAuthStatus(t.authGoogleSignInFailed || 'Google Sign-In failed.');
        }
      } else {
        const redirectUrl = getAuthRedirectUrl();
        logger.log('[AccountSection] Starting Google sign-in with redirect:', redirectUrl);
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: { prompt: 'select_account' },
          },
        });
        if (error) {
          logger.error('[AccountSection] Google sign-in error:', error);
          setAuthStatus(t.authError);
        }
      }
    } catch (err) {
      logger.error('[AccountSection] Sign-in error:', err);
      setAuthStatus(t.authGoogleSignInFailed || 'Google Sign-In failed.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setIsSigningOut(true);
    try {
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
        }
      }
      stopAutoSync();
      await clearLocalUserData();
      triggerDataRefresh();
      await removePushToken();
      await supabase.auth.signOut();
      onNameChange('Friend');
      setAuthStatus(t.authSignedOut);
    } finally {
      setIsSigningOut(false);
    }
  };

  return {
    authStatus,
    setAuthStatus,
    sessionEmail,
    isSigningIn,
    isSigningOut,
    handleGoogle,
    handleSignOut,
  };
}
