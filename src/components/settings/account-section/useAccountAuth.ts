import { useEffect, useState } from "react";
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
import { logger } from "@/lib/logger";

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
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSessionEmail(data.session?.user?.email ?? null);
      })
      .catch((err) => logger.warn("[Account]", "Session check failed:", err));
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
      // Native Android: use native account picker (no browser redirect)
      if (isNative) {
        logger.log("[AccountSection] Starting native Google sign-in");
        const result = await authenticateWithGoogleNative();
        if (result.success) {
          setAuthStatus(null);
        } else if (result.error !== "cancelled") {
          setAuthStatus(result.error || t.authGoogleSignInFailed || "Google Sign-In failed.");
        }
        return;
      }

      // Web: existing OAuth redirect flow — with auth guard (OWASP M3)
      if (!canStartAuthFlow()) {
        setAuthStatus(t.authTooManyAttempts || "Too many attempts. Please wait.");
        return;
      }
      startAuthFlow();
      const redirectUrl = getAuthRedirectUrl();
      logger.log("[AccountSection] Starting Google sign-in with redirect:", redirectUrl);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        logger.error("[AccountSection] Google sign-in error:", error);
        setAuthStatus(t.authError);
      }
      // Web redirects automatically via Supabase SDK
      if (data?.url) {
        logger.log("[AccountSection] Google OAuth URL generated");
      }
    } catch (err) {
      logger.error("[AccountSection] Sign-in error:", err);
      setAuthStatus(t.authGoogleSignInFailed || "Google Sign-In failed.");
    } finally {
      endAuthFlow();
      setIsSigningIn(false);
    }
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
              setTimeout(() => reject(new Error("Queue flush timeout")), 10000)
            ),
          ]);
          logger.log("[AccountSection] Offline queue flushed successfully");
        } catch (flushError) {
          logger.warn("[AccountSection] Could not flush offline queue:", flushError);
        }
      }
      stopAutoSync();
      const { clearDeviceIdCache } = await import("@/storage/eventSync");
      clearDeviceIdCache();
      await clearLocalUserData();
      triggerDataRefresh();
      await removePushToken();
      await supabase.auth.signOut();
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
    sessionEmail,
    isSigningIn,
    isSigningOut,
    handleGoogle,
    handleSignOut,
  };
}
