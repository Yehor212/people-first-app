import { useEffect, useRef } from 'react';
import { useAppStore, useUserDataStore } from '@/stores';
import { supabase } from '@/lib/supabaseClient';
import {
  handleAuthCallback,
  isNativePlatform,
  notifyAuthComplete,
  getPendingAuthUrl,
} from '@/lib/authRedirect';
import { AUTH_SESSION_EXPIRED_EVENT } from '@/lib/apiClient';
import { syncWithCloud, startAutoSync, stopAutoSync } from '@/storage/cloudSync';
import { joinPresence, leavePresence } from '@/lib/presenceService';
import { migrateExistingUser } from '@/lib/cloudSyncSettings';
import { logger } from '@/lib/logger';
import { endAuthFlow } from '@/lib/authGuard';

/**
 * Manages Supabase auth session lifecycle:
 * - Session check on mount
 * - Web OAuth callback handling
 * - Pending auth URL processing
 * - Cloud sync on auth change
 * - User name sync from Supabase metadata
 * - Session expired handler (401 events)
 */
export function useAuthSession(isLoading: boolean): void {
  const setHasValidSession = useAppStore(s => s.setHasValidSession);
  const setAuthBypassFlag = useAppStore(s => s.setAuthBypassFlag);
  const setIsProcessingWebOAuth = useAppStore(s => s.setIsProcessingWebOAuth);
  const setWebOAuthError = useAppStore(s => s.setWebOAuthError);

  const googleAuthChecked = useUserDataStore(s => s.googleAuthChecked);
  const setGoogleAuthChecked = useUserDataStore(s => s.setGoogleAuthChecked);
  const isLoadingUserData = useUserDataStore(s => s.isLoading);
  const userName = useUserDataStore(s => s.userName);
  const setUserName = useUserDataStore(s => s.setUserName);
  const userNameCustom = useUserDataStore(s => s.userNameCustom);
  const setUserNameCustom = useUserDataStore(s => s.setUserNameCustom);

  const lastSyncedUserIdRef = useRef<string | null>(null);
  const hadSignOutRef = useRef(false);
  const lastSessionExpiredRef = useRef<number>(0);

  // Refs for values used inside effects to prevent listener re-subscription
  const googleAuthCheckedRef = useRef(googleAuthChecked);
  googleAuthCheckedRef.current = googleAuthChecked;
  const isLoadingUserDataRef = useRef(isLoadingUserData);
  isLoadingUserDataRef.current = isLoadingUserData;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const userNameCustomRef = useRef(userNameCustom);
  userNameCustomRef.current = userNameCustom;
  const userNameRef = useRef(userName);
  userNameRef.current = userName;

  // Check Supabase session on mount - restore auth state if session exists
  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        const sessionExists = !!data.session;
        setHasValidSession(sessionExists);

        // If session exists but googleAuthChecked is false, restore it
        // This prevents the login loop after OAuth redirect
        if (sessionExists && !googleAuthCheckedRef.current && !isLoadingUserDataRef.current) {
          logger.log('[Index] Session exists but auth not checked - restoring state');
          setGoogleAuthChecked(true);
        }
      } catch (error) {
        logger.error('[Index] Error checking session:', error);
        if (active) {
          setHasValidSession(false);
        }
      }
    };

    void checkSession();

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setHasValidSession(!!session);
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [setGoogleAuthChecked, setHasValidSession]);

  // Web OAuth callback detection — runs ONCE on mount
  // Detects ?code= or ?error= in URL (from Supabase PKCE redirect)
  useEffect(() => {
    if (isNativePlatform() || !supabase) return;

    const url = new URL(window.location.href);
    const hasCode = url.searchParams.has('code');
    const hasError = url.searchParams.has('error');
    const errorDescription = url.searchParams.get('error_description');

    if (!hasCode && !hasError) return;

    // Handle error case immediately
    if (hasError) {
      logger.error('[Index] OAuth error in URL:', url.searchParams.get('error'), errorDescription);
      setWebOAuthError(errorDescription || 'Authentication failed. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Has ?code= — wait for Supabase to exchange it
    logger.log('[Index] Web OAuth callback detected, waiting for code exchange...');
    setIsProcessingWebOAuth(true);

    let settled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return;

      if (event === 'SIGNED_IN' && session) {
        settled = true;
        logger.log('[Index] Web OAuth code exchange succeeded');
        window.history.replaceState({}, '', window.location.pathname);
        setIsProcessingWebOAuth(false);
      }
    });

    // Timeout: if no SIGNED_IN event after 30 seconds, exchange likely failed
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      logger.error('[Index] Web OAuth code exchange timed out after 30s');
      setIsProcessingWebOAuth(false);
      setWebOAuthError('Sign-in took too long. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }, 30000);

    return () => {
      settled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: check OAuth redirect once
  }, []); // Run once on mount

  // Process pending auth URL when supabase becomes ready
  useEffect(() => {
    if (!supabase || !isNativePlatform()) return;

    let active = true;
    const pendingUrl = getPendingAuthUrl();
    if (pendingUrl) {
      logger.log('[Index] Processing pending auth URL');

      void (async () => {
        try {
          await handleAuthCallback(supabase, pendingUrl);

          if (!active) return;

          const { data } = await supabase.auth.getSession();
          if (!active) return;

          if (data.session?.user) {
            const metadata = data.session.user.user_metadata;
            const name = metadata?.full_name || metadata?.name || data.session.user.email?.split('@')[0] || 'Friend';

            logger.log('[Auth] Pending auth processed successfully');
            setAuthBypassFlag(true);
            setHasValidSession(true);
            setWebOAuthError(null);
            notifyAuthComplete();
            setUserName(name);
            setUserNameCustom(false);
            setGoogleAuthChecked(true);
            endAuthFlow();
          } else {
            logger.error('[Index] Pending auth callback had no session');
            setWebOAuthError('Google sign-in did not complete. Please try again.');
            endAuthFlow();
          }
        } catch (error) {
          logger.error('[Index] Failed to process pending auth:', error);
          setWebOAuthError(error instanceof Error ? error.message : 'Google sign-in failed. Please try again.');
          endAuthFlow();
        }
      })();
    }

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: subscribe to auth state once
  }, [supabase, setUserName, setUserNameCustom, setGoogleAuthChecked]);

  // Cloud sync on auth change
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const syncIfNeeded = async (userId?: string | null) => {
      if (!active || !userId || isLoadingRef.current) return;
      if (lastSyncedUserIdRef.current === userId) return;

      // Use 'replace' if: (a) sign-out happened, or (b) different user was synced before
      const isAccountSwitch = hadSignOutRef.current ||
        (lastSyncedUserIdRef.current !== null && lastSyncedUserIdRef.current !== userId);

      lastSyncedUserIdRef.current = userId;
      hadSignOutRef.current = false;

      try {
        // Use 'replace' on account switch to avoid merging different users' data
        await syncWithCloud(isAccountSwitch ? 'replace' : 'merge');
        // Start auto-sync after successful initial sync
        startAutoSync();
        // Join Presence channel for friend online status
        joinPresence().catch(err => logger.warn('[Auth]', 'Presence join failed:', err));
      } catch (error) {
        logger.error('Cloud sync failed:', error);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      // v1.1.1 Migration: Auto-enable cloud sync for existing users
      if (data.session) {
        migrateExistingUser();
      }
      void syncIfNeeded(data.session?.user?.id ?? null);
    }).catch(err => logger.warn('[Auth]', 'Session check failed:', err));

    // Correct destructuring pattern for auth subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Reset sync refs on sign-out so next sign-in uses 'replace' mode
      if (event === 'SIGNED_OUT') {
        lastSyncedUserIdRef.current = null;
        hadSignOutRef.current = true;
      }
      // v1.1.1 Migration: Auto-enable cloud sync when user signs in
      if (session) {
        migrateExistingUser();
      }
      void syncIfNeeded(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
      stopAutoSync();
      leavePresence().catch(err => logger.warn('[Auth]', 'Presence leave failed:', err));
    };
  }, []); // mount-only — isLoading tracked via ref

  // Sync user name from Supabase metadata (uses cached session, no network call)
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    // Initial sync from cached session
    const syncNameFromSession = async () => {
      if (userNameCustomRef.current) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session?.user) return;
      const metadata = session.user.user_metadata as { full_name?: string; name?: string } | undefined;
      const candidate = metadata?.full_name || metadata?.name;
      if (candidate && candidate !== userNameRef.current) {
        setUserName(candidate);
      }
    };
    void syncNameFromSession();

    // Listen: use session directly from callback (no network call)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session?.user || userNameCustomRef.current) return;
      const metadata = session.user.user_metadata as { full_name?: string; name?: string } | undefined;
      const candidate = metadata?.full_name || metadata?.name;
      if (candidate && candidate !== userNameRef.current) {
        setUserName(candidate);
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [setUserName]);

  // Session expired handler - listens for 401 errors from API/sync
  // Verify actual session state before resetting auth
  useEffect(() => {
    const handleSessionExpired = async () => {
      // Throttle - ignore if we just handled one
      const now = Date.now();
      if (now - lastSessionExpiredRef.current < 5000) {
        logger.log('[Index] Session expired event throttled');
        return;
      }
      lastSessionExpiredRef.current = now;

      logger.warn('[Index] Session expired event received, verifying session...');

      // Check if session is actually expired before resetting
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          logger.log('[Index] Session still valid, ignoring expired event');
          return;
        }
      } catch (error) {
        logger.error('[Index] Error checking session:', error);
      }

      // Session truly expired - reset auth state
      logger.warn('[Index] Session confirmed expired, resetting auth state');
      setHasValidSession(false);
      setAuthBypassFlag(false);
      setGoogleAuthChecked(false);
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [setGoogleAuthChecked, setHasValidSession, setAuthBypassFlag]);
}
