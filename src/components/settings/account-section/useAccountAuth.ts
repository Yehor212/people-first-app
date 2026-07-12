import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { isNative } from "@/lib/platform";
import { authenticateWithGoogleNative } from "@/lib/nativeGoogleAuth";
import { authStateManager } from "@/lib/authStateManager";
import { resetAuthGuard, canStartAuthFlow, startAuthFlow, endAuthFlow } from "@/lib/authGuard";
import { initializePushNotifications } from "@/lib/pushNotifications";
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
import { performOwnerSafeSignOut } from "@/lib/accountSignOutCleanup";

interface UseAccountAuthOptions {
  onNameChange: (name: string) => void;
  t: Record<string, string>;
}

type SignOutBlockReason = "pending-changes" | "cleanup-failed" | "sign-out-failed";
type SessionCheckState = "checking" | "signed-in" | "signed-out" | "error";

export function useAccountAuth({ onNameChange, t }: UseAccountAuthOptions) {
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [sessionCheckState, setSessionCheckState] = useState<SessionCheckState>(
    supabase ? "checking" : "signed-out",
  );
  const [signingInProvider, setSigningInProvider] = useState<SocialAuthProviderId | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutBlockReason, setSignOutBlockReason] = useState<SignOutBlockReason | null>(null);
  const resetAuthState = useAppStore((s) => s.resetAuthState);
  const setAuthGateChecked = useUserDataStore((s) => s.setAuthGateChecked);
  const pushNotificationsEnabled = useUserDataStore(
    (s) => s.privacy.pushNotifications === true,
  );
  const nativeOAuthTimeoutRef = useRef<number | null>(null);
  const sessionCheckRequestRef = useRef(0);
  const isMountedRef = useRef(true);
  const enabledProviders = useMemo(() => getEnabledAccountAuthProviders(), []);

  const refreshSession = useCallback(async () => {
    if (!supabase) {
      setSessionUser(null);
      setSessionCheckState("signed-out");
      return;
    }

    const requestId = ++sessionCheckRequestRef.current;
    setSessionCheckState("checking");

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!isMountedRef.current || requestId !== sessionCheckRequestRef.current) return;

      const nextUser = data.session?.user ?? null;
      setSessionUser(nextUser);
      setSessionCheckState(nextUser ? "signed-in" : "signed-out");
    } catch (error) {
      if (!isMountedRef.current || requestId !== sessionCheckRequestRef.current) return;
      logger.warn("[Account]", "Session check failed:", error);
      setSessionCheckState("error");
    }
  }, []);

  useEffect(() => {
    if (!authStatus || signOutBlockReason) return;
    const timer = window.setTimeout(() => setAuthStatus(null), 3000);
    return () => window.clearTimeout(timer);
  }, [authStatus, signOutBlockReason]);

  useEffect(() => {
    return () => {
      if (nativeOAuthTimeoutRef.current !== null) {
        window.clearTimeout(nativeOAuthTimeoutRef.current);
        nativeOAuthTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void refreshSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionCheckRequestRef.current += 1;
      const nextUser = session?.user ?? null;
      setSessionUser(nextUser);
      setSessionCheckState(nextUser ? "signed-in" : "signed-out");
      if (nextUser) {
        if (nativeOAuthTimeoutRef.current !== null) {
          window.clearTimeout(nativeOAuthTimeoutRef.current);
          nativeOAuthTimeoutRef.current = null;
          endAuthFlow();
        }
        setSigningInProvider(null);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [refreshSession]);

  const runOAuth = async (provider: SocialAuthProviderId): Promise<void> => {
    if (!supabase) {
      setAuthStatus(t.authNotConfigured);
      return;
    }

    if (!canStartAuthFlow()) {
      setAuthStatus(t.authTooManyAttempts || "Too many attempts. Please wait.");
      return;
    }

    startAuthFlow();
    let waitingForNativeOAuthCallback = false;
    setSigningInProvider(provider);
    setAuthStatus(null);

    try {
      const redirectUrl = getAuthRedirectUrl();
      const credentials = buildOAuthCredentials(provider, {
        redirectTo: redirectUrl,
        skipBrowserRedirect: isNative,
      });
      logger.log(`[AccountSection] Starting ${provider} sign-in with redirect:`, redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth(credentials);

      if (error) {
        logger.error(`[AccountSection] ${provider} sign-in error:`, error);
        setAuthStatus(t.authError);
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
            `[AccountSection] ${provider} sign-in timed out waiting for native OAuth callback`,
          );
          setAuthStatus(
            t.authSignInTooLong ||
              t.authUnexpectedError ||
              "Sign-in took too long. Please try again.",
          );
          endAuthFlow();
          setSigningInProvider(null);
        }, 60_000);
      }
    } catch (err) {
      logger.error(`[AccountSection] ${provider} sign-in exception:`, err);
      setAuthStatus(t.authUnexpectedError);
    } finally {
      if (!waitingForNativeOAuthCallback) {
        endAuthFlow();
        setSigningInProvider(null);
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

    await runOAuth(provider);
  };

  const handleSignOut = async (options: { discardPendingChanges?: boolean } = {}) => {
    if (!supabase) return;
    setIsSigningOut(true);
    setAuthStatus(null);
    setSignOutBlockReason(null);
    try {
      const result = await performOwnerSafeSignOut({
        discardPendingChanges: options.discardPendingChanges,
        restorePushRegistration: pushNotificationsEnabled
          ? initializePushNotifications
          : undefined,
      });

      if (result.status === "pending-changes") {
        setSignOutBlockReason("pending-changes");
        setAuthStatus(t.authSignOutPendingChanges || t.authUnexpectedError);
        return;
      }

      if (result.status === "sign-out-failed") {
        setSignOutBlockReason("sign-out-failed");
        setAuthStatus(t.authSignOutFailed || t.authUnexpectedError);
        return;
      }

      if (result.status === "session-changed") {
        setSignOutBlockReason(null);
        setAuthStatus(t.authSignOutFailed || t.authUnexpectedError);
        return;
      }

      if (result.status === "cleanup-failed") {
        if (result.sessionEnded) {
          resetAuthState();
          setAuthGateChecked(false);
          authStateManager.reset();
          resetAuthGuard();
        }
        setSignOutBlockReason("cleanup-failed");
        setAuthStatus(t.authSignOutCleanupFailed || t.authUnexpectedError);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("zenflow:account-cleanup-blocked", {
              detail: {
                retry: () => {
                  void handleSignOut(options);
                },
              },
            }),
          );
        }
        return;
      }

      // `no-session` is an idempotent success for a retry after another tab or
      // the auth listener already finished the durable cleanup.
      resetAuthState();
      setAuthGateChecked(false);
      authStateManager.reset();
      resetAuthGuard();
      onNameChange("Friend");
      setSignOutBlockReason(null);
      setAuthStatus(t.authSignedOut);
    } catch (error) {
      logger.error("[AccountSection] Sign-out failed:", error);
      setSignOutBlockReason("sign-out-failed");
      setAuthStatus(t.authSignOutFailed || t.authUnexpectedError);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDiscardPendingAndSignOut = () =>
    handleSignOut({ discardPendingChanges: true });

  return {
    authStatus,
    setAuthStatus,
    sessionUser,
    sessionUserId: sessionUser?.id ?? null,
    sessionAccountLabel: getAuthUserAccountLabel(sessionUser),
    sessionDisplayName: getAuthUserDisplayName(sessionUser),
    linkedProviderIds: getLinkedAuthProviderIds(sessionUser),
    enabledProviders,
    hasSession: sessionCheckState === "signed-in" && !!sessionUser,
    sessionCheckState,
    refreshSession,
    signingInProvider,
    isSigningIn: signingInProvider !== null,
    isSigningOut,
    signOutBlockReason,
    handleProvider,
    handleSignOut,
    handleDiscardPendingAndSignOut,
  };
}
