import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { isNative } from "@/lib/platform";
import { authenticateWithGoogleNative } from "@/lib/nativeGoogleAuth";
import { authStateManager } from "@/lib/authStateManager";
import { resetAuthGuard, canStartAuthFlow, startAuthFlow, endAuthFlow } from "@/lib/authGuard";
import { removePushToken } from "@/lib/pushNotifications";
import { offlineQueue } from "@/lib/offlineQueue";
import { stopAutoSync } from "@/storage/cloudSync";
import { clearLocalUserData } from "@/storage/db";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";
import { useAppStore, useUserDataStore } from "@/stores";
import {
  buildOAuthCredentials,
  getEnabledAccountAuthProviders,
  isTrustedOAuthRedirectUrl,
  type SocialAuthProviderId,
} from "@/lib/authProviders";
import {
  getAuthUserAccountLabel,
  getAuthUserDisplayName,
  getLinkedAuthProviderIds,
} from "@/lib/authUser";
import { openOAuthUrl } from "@/lib/nativeOAuthBrowser";
import { logger } from "@/lib/logger";

interface UseAccountAuthOptions {
  onNameChange: (name: string) => void;
  t: Record<string, string>;
}

export function useAccountAuth({ onNameChange, t }: UseAccountAuthOptions) {
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [signingInProvider, setSigningInProvider] = useState<SocialAuthProviderId | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<SocialAuthProviderId | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const resetAuthState = useAppStore((s) => s.resetAuthState);
  const setAuthGateChecked = useUserDataStore((s) => s.setAuthGateChecked);
  const nativeOAuthTimeoutRef = useRef<number | null>(null);
  const enabledProviders = useMemo(() => getEnabledAccountAuthProviders(), []);

  useEffect(() => {
    if (!authStatus) return;
    const timer = window.setTimeout(() => setAuthStatus(null), 3000);
    return () => window.clearTimeout(timer);
  }, [authStatus]);

  useEffect(() => {
    return () => {
      if (nativeOAuthTimeoutRef.current !== null) {
        window.clearTimeout(nativeOAuthTimeoutRef.current);
        nativeOAuthTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSessionUser(data.session?.user ?? null);
      })
      .catch((err) => logger.warn("[Account]", "Session check failed:", err));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ?? null);
      if (session?.user) {
        if (nativeOAuthTimeoutRef.current !== null) {
          window.clearTimeout(nativeOAuthTimeoutRef.current);
          nativeOAuthTimeoutRef.current = null;
          endAuthFlow();
        }
        setSigningInProvider(null);
        setLinkingProvider(null);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const runOAuth = async (
    provider: SocialAuthProviderId,
    mode: "signIn" | "link",
  ): Promise<void> => {
    if (!supabase) {
      setAuthStatus(t.authNotConfigured);
      return;
    }

    if (!canStartAuthFlow()) {
      setAuthStatus(t.authTooManyAttempts || "Too many attempts. Please wait.");
      return;
    }

    startAuthFlow();
    const setLoading = mode === "link" ? setLinkingProvider : setSigningInProvider;
    let waitingForNativeOAuthCallback = false;
    setLoading(provider);
    setAuthStatus(null);

    try {
      const redirectUrl = getAuthRedirectUrl();
      const credentials = buildOAuthCredentials(provider, {
        redirectTo: redirectUrl,
        skipBrowserRedirect: isNative,
      });
      logger.log(`[AccountSection] Starting ${provider} ${mode} with redirect:`, redirectUrl);

      const { data, error } =
        mode === "link"
          ? await supabase.auth.linkIdentity(credentials)
          : await supabase.auth.signInWithOAuth(credentials);

      if (error) {
        logger.error(`[AccountSection] ${provider} ${mode} error:`, error);
        setAuthStatus(mode === "link" ? t.authProviderLinkFailed : t.authError);
        return;
      }

      if (data?.url && isNative) {
        if (!isTrustedOAuthRedirectUrl(data.url, provider)) {
          logger.error("[AccountSection] Untrusted OAuth redirect URL blocked");
          setAuthStatus(t.authUnexpectedError || "Authentication service unavailable.");
          return;
        }
        await openOAuthUrl(data.url);
        waitingForNativeOAuthCallback = true;
        if (nativeOAuthTimeoutRef.current !== null) {
          window.clearTimeout(nativeOAuthTimeoutRef.current);
        }
        nativeOAuthTimeoutRef.current = window.setTimeout(() => {
          nativeOAuthTimeoutRef.current = null;
          logger.warn(
            `[AccountSection] ${provider} ${mode} timed out waiting for native OAuth callback`,
          );
          setAuthStatus(
            t.authSignInTooLong ||
              t.authUnexpectedError ||
              "Sign-in took too long. Please try again.",
          );
          endAuthFlow();
          setLoading(null);
        }, 60_000);
      }
    } catch (err) {
      logger.error(`[AccountSection] ${provider} ${mode} exception:`, err);
      setAuthStatus(mode === "link" ? t.authProviderLinkFailed : t.authUnexpectedError);
    } finally {
      if (!waitingForNativeOAuthCallback) {
        endAuthFlow();
        setLoading(null);
      }
    }
  };

  const handleProvider = async (provider: SocialAuthProviderId) => {
    if (!supabase) {
      setAuthStatus(t.authNotConfigured);
      return;
    }

    if (provider === "google" && isNative) {
      if (!canStartAuthFlow()) {
        setAuthStatus(t.authTooManyAttempts || "Too many attempts. Please wait.");
        return;
      }
      startAuthFlow();
      setSigningInProvider(provider);
      setAuthStatus(null);
      try {
        logger.log("[AccountSection] Starting native Google sign-in");
        const result = await authenticateWithGoogleNative();
        if (result.success) {
          setAuthStatus(null);
        } else if (result.error !== "cancelled") {
          setAuthStatus(result.error || t.authGoogleSignInFailed || "Google Sign-In failed.");
        }
      } catch (err) {
        logger.error("[AccountSection] Native Google sign-in error:", err);
        setAuthStatus(t.authGoogleSignInFailed || "Google Sign-In failed.");
      } finally {
        endAuthFlow();
        setSigningInProvider(null);
      }
      return;
    }

    await runOAuth(provider, "signIn");
  };

  const handleLinkProvider = async (provider: SocialAuthProviderId) => {
    await runOAuth(provider, "link");
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setIsSigningOut(true);
    try {
      if (offlineQueue.hasPendingActions()) {
        logger.log("[AccountSection] Flushing offline queue before sign-out...");
        try {
          await Promise.race([
            offlineQueue.processQueue(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Queue flush timeout")), 10000),
            ),
          ]);
          logger.log("[AccountSection] Offline queue flushed successfully");
        } catch (flushError) {
          logger.warn("[AccountSection] Could not flush offline queue:", flushError);
        }
      }
      stopAutoSync();
      await removePushToken();
      const { clearDeviceIdCache } = await import("@/storage/eventSync");
      clearDeviceIdCache();
      await clearLocalUserData();
      triggerDataRefresh();
      await supabase.auth.signOut();
      resetAuthState();
      setAuthGateChecked(false);
      authStateManager.reset();
      resetAuthGuard();
      onNameChange("Friend");
      setAuthStatus(t.authSignedOut);
    } finally {
      setIsSigningOut(false);
    }
  };

  return {
    authStatus,
    setAuthStatus,
    sessionUser,
    sessionUserId: sessionUser?.id ?? null,
    sessionAccountLabel: getAuthUserAccountLabel(sessionUser),
    sessionDisplayName: getAuthUserDisplayName(sessionUser),
    linkedProviderIds: getLinkedAuthProviderIds(sessionUser),
    enabledProviders,
    hasSession: !!sessionUser,
    signingInProvider,
    linkingProvider,
    isSigningIn: signingInProvider !== null,
    isSigningOut,
    handleProvider,
    handleLinkProvider,
    handleSignOut,
  };
}
