import { useEffect } from 'react';
import { useAppStore, useUIStore, useUserDataStore, getModalToggle } from '@/stores';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { logger } from '@/lib/logger';
import { App } from '@capacitor/app';
import { handleAuthCallback, isNativePlatform, notifyAuthComplete, setPendingAuthUrl } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabaseClient';
import { decodeInviteData } from '@/lib/friendChallenge';

const setShowChallengeModal = getModalToggle('showChallengeModal');

/**
 * Handles all deep link processing:
 * - Auth deep links (login-callback URLs)
 * - Challenge deep links (zenflow://challenge or https://zenflow.app/challenge)
 * - Launch URL processing (cold start)
 * - Runtime appUrlOpen events
 */
export function useDeepLinkHandler(): void {
  const { isFeatureVisible } = useFeatureFlags();
  const setAuthBypassFlag = useAppStore(s => s.setAuthBypassFlag);
  const setUserName = useUserDataStore(s => s.setUserName);
  const setUserNameCustom = useUserDataStore(s => s.setUserNameCustom);
  const setGoogleAuthChecked = useUserDataStore(s => s.setGoogleAuthChecked);
  const setChallengeInvite = useUIStore(s => s.setChallengeInvite);

  useEffect(() => {
    if (!isNativePlatform()) return;

    let removeListener = () => {};

    const handleAuthUrl = async (url: string) => {
      // Check if URL is auth callback
      if (!url.includes('login-callback')) return;

      logger.log('[Index] Auth URL received:', url);

      // If supabase not ready, store for later
      if (!supabase) {
        logger.log('[Index] Supabase not ready, storing pending URL');
        setPendingAuthUrl(url);
        return;
      }

      try {
        await handleAuthCallback(supabase, url);

        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const metadata = data.session.user.user_metadata;
          const name = metadata?.full_name || metadata?.name || data.session.user.email?.split('@')[0] || 'Friend';

          // Don't log email (PII)
          logger.log('[Auth] OAuth callback successful');
          setAuthBypassFlag(true);
          notifyAuthComplete();
          setUserName(name);
          setUserNameCustom(false);
          setGoogleAuthChecked(true);
        }
      } catch (error) {
        logger.error('[Index] Failed to handle auth callback:', error);
      }
    };

    // Handle challenge deep links
    const handleChallengeUrl = (url: string): boolean => {
      try {
        const parsedUrl = new URL(url);
        // Check if it's a challenge invite URL
        // Support both: zenflow://challenge?data=... and https://zenflow.app/challenge?data=...
        const isCustomScheme = parsedUrl.protocol === 'zenflow:' && parsedUrl.hostname === 'challenge';
        const isHttpsScheme = parsedUrl.hostname === 'zenflow.app' && parsedUrl.pathname.startsWith('/challenge');

        if (isCustomScheme || isHttpsScheme) {
          const data = parsedUrl.searchParams.get('data');
          if (data) {
            const invite = decodeInviteData(data);
            if (invite) {
              logger.log('[Index] Challenge invite received:', invite.code);
              // Only open challenge modal if challenges feature is enabled
              if (isFeatureVisible('challenges')) {
                setChallengeInvite(invite);
                setShowChallengeModal(true);
                return true;
              } else {
                logger.log('[Index] Challenges feature disabled, ignoring invite');
              }
            }
          }
        }
      } catch (error) {
        logger.error('[Index] Failed to parse challenge URL:', error);
      }
      return false;
    };

    const setup = async () => {
      try {
        // Check launch URL (cold start with deep link)
        const launch = await App.getLaunchUrl();
        if (launch?.url) {
          logger.log('[Index] Launch URL found:', launch.url);
          // Try challenge URL first, then auth URL
          if (!handleChallengeUrl(launch.url)) {
            await handleAuthUrl(launch.url);
          }
        }
      } catch (error) {
        logger.error('[Index] Failed to read launch URL:', error);
      }

      // Listen for future deep links
      const listener = await App.addListener('appUrlOpen', (event) => {
        if (event?.url) {
          logger.log('[Index] appUrlOpen event:', event.url);
          // Try challenge URL first, then auth URL
          if (!handleChallengeUrl(event.url)) {
            void handleAuthUrl(event.url);
          }
        }
      });
      removeListener = () => listener.remove();
    };

    void setup();
    return () => { removeListener(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: register deep link listener once
  }, []); // Listener registers ONCE, no dependencies
}
