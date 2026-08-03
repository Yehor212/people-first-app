import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AUTH_COMPLETE_EVENT } from "@/lib/authRedirect";
import { isNative } from "@/lib/platform";
import { endAuthFlow } from "@/lib/authGuard";
import { App } from "@capacitor/app";
import { logger } from "@/lib/logger";
import { getAuthUserDisplayName } from "@/lib/authUser";
import type { AuthProvider, PhoneStep } from "./types";

interface UseAuthSessionOptions {
  onComplete: (userData: { name: string; email: string }) => void;
  webOAuthError?: string | null;
  onClearError?: () => void;
  suspendSessionCompletion?: boolean;
}

export function useAuthSession({
  onComplete,
  webOAuthError,
  onClearError,
  suspendSessionCompletion = false,
}: UseAuthSessionOptions) {
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // Phone auth state
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("idle");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // Prevent double onComplete calls (race condition with Index.tsx listener)
  const hasCompletedRef = useRef(false);
  // Ref for OAuth timeout
  const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use ref for onComplete to avoid dependency array issues
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Show web OAuth error from Index.tsx if present.
  // Only sync truthy values: the parent store is a one-shot channel that clears
  // itself via onClearError; syncing null back would erase the local copy on
  // the next render and the alert would never appear.
  useEffect(() => {
    if (webOAuthError !== undefined) {
      setError(webOAuthError);
    }
    if (webOAuthError) {
      onClearError?.();
    }
  }, [webOAuthError, onClearError]);

  // Safe completion helper - ensures onComplete is called exactly once
  const tryComplete = (userData: { name: string; email: string }, source: string): boolean => {
    if (hasCompletedRef.current) {
      logger.log(`[Auth] Completion already done, ignoring from ${source}`);
      return false;
    }
    hasCompletedRef.current = true;

    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current);
      oauthTimeoutRef.current = null;
    }

    setLoadingProvider(null);
    logger.log(`[Auth] Completing auth from ${source}`);
    onCompleteRef.current(userData);
    return true;
  };

  // Check session, subscribe to auth events, listen for completion
  useEffect(() => {
    const checkSession = async () => {
      if (!supabase) return;
      if (suspendSessionCompletion) return;
      if (hasCompletedRef.current) return;
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          logger.error("[Auth] Session check error:", sessionError);
          setDebugInfo(`Session error: ${sessionError.message}`);
          return;
        }
        if (data.session?.user) {
          const name = getAuthUserDisplayName(data.session.user);
          const email = data.session.user.email || "";
          endAuthFlow();
          tryComplete({ name, email }, "checkSession");
        }
      } catch (err) {
        logger.error("[Auth] Unexpected error checking session:", err);
        setDebugInfo(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    void checkSession();

    let subscription: { unsubscribe?: () => void } | undefined;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        logger.log("[Auth] Auth state changed:", event);
        if (
          !suspendSessionCompletion &&
          (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
          session?.user
        ) {
          endAuthFlow();
          const name = getAuthUserDisplayName(session.user);
          const email = session.user.email || "";
          tryComplete({ name, email }, "onAuthStateChange");
        } else if (event === "SIGNED_OUT") {
          endAuthFlow();
          setLoadingProvider(null);
        }
      });
      subscription = data?.subscription;
    }

    const handleAuthComplete = () => {
      logger.log("[Auth] Received auth complete event from Index.tsx");
      setLoadingProvider(null);
      if (oauthTimeoutRef.current) {
        clearTimeout(oauthTimeoutRef.current);
        oauthTimeoutRef.current = null;
      }
    };
    window.addEventListener(AUTH_COMPLETE_EVENT, handleAuthComplete);

    return () => {
      subscription?.unsubscribe?.();
      window.removeEventListener(AUTH_COMPLETE_EVENT, handleAuthComplete);
      if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
    };
  }, [suspendSessionCompletion]);

  // Check session when app resumes from OAuth browser
  useEffect(() => {
    const client = supabase;
    if (!client || suspendSessionCompletion) return;

    let isMounted = true;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const checkSessionOnResume = async () => {
      if (!isMounted || !loadingProvider || hasCompletedRef.current) return;

      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!isMounted || hasCompletedRef.current) return;

      try {
        const { data } = await client.auth.getSession();
        if (!isMounted) return;

        if (data.session?.user) {
          const name = getAuthUserDisplayName(data.session.user);
          const email = data.session.user.email || "";
          endAuthFlow();
          tryComplete({ name, email }, "checkSessionOnResume");
        } else if (!hasCompletedRef.current) {
          logger.log("[Auth] No session on resume, user may have canceled");
          setLoadingProvider(null);
          if (oauthTimeoutRef.current) {
            clearTimeout(oauthTimeoutRef.current);
            oauthTimeoutRef.current = null;
          }
          endAuthFlow();
        }
      } catch (err) {
        logger.error("[Auth] Error checking session on resume:", err);
        if (isMounted && !hasCompletedRef.current) {
          setLoadingProvider(null);
          endAuthFlow();
        }
      }
    };

    if (isNative) {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive && loadingProvider) {
          void checkSessionOnResume();
        }
      })
        .then((listener) => {
          listenerHandle = listener;
        })
        .catch((err) => {
          logger.error("[Auth] Failed to add appStateChange listener:", err);
        });

      return () => {
        isMounted = false;
        if (listenerHandle) {
          listenerHandle
            .remove()
            .catch((err) => logger.warn("[Auth]", "Listener remove failed:", err));
        }
      };
    }

    // Web fallback
    const handleFocus = () => {
      if (loadingProvider) void checkSessionOnResume();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadingProvider, suspendSessionCompletion]);

  return {
    loadingProvider,
    setLoadingProvider,
    error,
    setError,
    debugInfo,
    setDebugInfo,
    phoneStep,
    setPhoneStep,
    phoneNumber,
    setPhoneNumber,
    otpCode,
    setOtpCode,
    hasCompletedRef,
    oauthTimeoutRef,
    tryComplete,
    isLoading: loadingProvider !== null,
  };
}
