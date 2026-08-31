import { useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { isAndroid, isNative } from "@/lib/platform";
import { canStartAuthFlow, startAuthFlow, endAuthFlow } from "@/lib/authGuard";
import { checkAppleAuthAvailability } from "@/lib/appleAuthAvailability";
import { authenticateWithGoogleNative } from "@/lib/nativeGoogleAuth";
import {
  buildOAuthCredentials,
  isTrustedOAuthRedirectUrl,
  type SocialAuthProviderId,
} from "@/lib/authProviders";
import { openOAuthUrl } from "@/lib/nativeOAuthBrowser";
import { logger } from "@/lib/logger";
import { cancelPkceAttemptFromUrl } from "@/lib/authTransitionCoordinator";
import { createPkceAttemptRedirectUrl } from "@/lib/pkceAttemptStorage";
import { analytics } from "@/lib/analytics";
import { hapticError } from "@/lib/haptics";
import { phoneSchema } from "@/lib/schemas";
import type { useAuthSession } from "./useAuthSession";
import {
  AUTH_DIAGNOSTIC_CODES,
  buildAuthDiagnosticEvidence,
  serializeAuthDiagnosticEvidence,
} from "./authDiagnosticEvidence";

type Session = ReturnType<typeof useAuthSession>;

const OTP_COOLDOWN_MS = 60_000; // 60 seconds between OTP sends

export function useAuthHandlers(session: Session, t: Record<string, string>) {
  const lastOtpSendRef = useRef(0);
  // Generic OAuth sign-in handler
  const handleOAuthSignIn = async (provider: SocialAuthProviderId) => {
    if (!supabase) {
      session.setError(t.authSupabaseNotConfigured);
      return;
    }

    if (provider === "apple") {
      session.setError(null);
      session.setDebugInfo(null);
      const availability = await checkAppleAuthAvailability();
      if (availability.status === "disabled" || availability.status === "unconfigured") {
        logger.warn("[Auth] Apple sign-in blocked before OAuth", {
          status: availability.status,
          reason: availability.reason,
        });
        session.setError(
          t.authAppleUnavailable ||
            t.authNotConfigured ||
            "Apple sign-in is not available yet. Please use another sign-in method."
        );
        session.setDebugInfo(AUTH_DIAGNOSTIC_CODES.APPLE_UNAVAILABLE);
        return;
      }
    }

    if (!canStartAuthFlow()) {
      session.setError(t.authTooManyAttempts);
      logger.warn("[Auth] Auth flow blocked by guard");
      return;
    }

    startAuthFlow();
    session.setLoadingProvider(provider);
    session.setError(null);
    session.setDebugInfo(null);

    // OAuth timeout (60 seconds)
    if (session.oauthTimeoutRef.current) clearTimeout(session.oauthTimeoutRef.current);
    session.oauthTimeoutRef.current = setTimeout(() => {
      session.oauthTimeoutRef.current = null;
      if (!session.hasCompletedRef.current) {
        logger.warn(`[Auth] ${provider} OAuth timeout after 60s`);
        session.setLoadingProvider(null);
        session.setError(t.authSignInTooLong);
        endAuthFlow();
      }
    }, 60000);

    let redirectUrl: string | null = null;
    let providerNavigationStarted = false;

    try {
      redirectUrl = createPkceAttemptRedirectUrl(
        getAuthRedirectUrl(),
        "oauth",
      ).redirectUrl;
      logger.log(`[Auth] Starting ${provider} sign-in with an attempt-bound redirect`);

      const platform = isNative ? "native" : "web";
      logger.log("[Auth] Platform:", platform);
      session.setDebugInfo(AUTH_DIAGNOSTIC_CODES.OAUTH_READY);

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        ...buildOAuthCredentials(provider, {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative,
        }),
      });

      if (signInError) {
        logger.error(`[Auth] ${provider} sign-in error:`, signInError);

        let errorMessage = t.authUnexpectedError || `Failed to sign in with ${provider}.`;

        if (signInError.message.includes("invalid_client")) {
          errorMessage = t.authNotConfigured || `${provider} OAuth not configured correctly.`;
        } else if (signInError.message.includes("redirect_uri")) {
          errorMessage = t.authNotConfigured || "Redirect URI mismatch.";
        } else if (signInError.message.includes("unauthorized")) {
          errorMessage = t.authNotConfigured || `OAuth client not authorized.`;
        }

        session.setError(errorMessage);
        session.setDebugInfo(AUTH_DIAGNOSTIC_CODES.OAUTH_REJECTED);
        if (session.oauthTimeoutRef.current) clearTimeout(session.oauthTimeoutRef.current);
        endAuthFlow();
        session.setLoadingProvider(null);
        return;
      }

      if (data?.url) {
        logger.log(`[Auth] ${provider} OAuth URL generated`);
        session.setDebugInfo(AUTH_DIAGNOSTIC_CODES.OAUTH_READY);
        if (isNative) {
          if (!isTrustedOAuthRedirectUrl(data.url, provider)) {
            logger.error("[Auth] Untrusted OAuth redirect URL blocked");
            session.setError("Authentication service unavailable.");
            await cancelPkceAttemptFromUrl(supabase.auth, redirectUrl);
            if (session.oauthTimeoutRef.current) clearTimeout(session.oauthTimeoutRef.current);
            endAuthFlow();
            session.setLoadingProvider(null);
            return;
          }
          await openOAuthUrl(data.url);
          providerNavigationStarted = true;
          logger.log(`[Auth] ${provider} OAuth URL navigation started`);
        }
      } else {
        logger.error(`[Auth] ${provider} OAuth URL missing`);
        session.setError(t.authUnexpectedError || `Failed to sign in with ${provider}.`);
        session.setDebugInfo(AUTH_DIAGNOSTIC_CODES.OAUTH_MISSING_URL);
        await cancelPkceAttemptFromUrl(supabase.auth, redirectUrl);
        if (session.oauthTimeoutRef.current) clearTimeout(session.oauthTimeoutRef.current);
        endAuthFlow();
        session.setLoadingProvider(null);
      }
    } catch (err) {
      if (redirectUrl && !providerNavigationStarted) {
        try {
          await cancelPkceAttemptFromUrl(supabase.auth, redirectUrl);
        } catch (cancelError) {
          logger.warn("[Auth] Failed to cancel an unlaunched OAuth attempt", {
            errorName: cancelError instanceof Error ? cancelError.name : "UnknownError",
          });
        }
      }
      logger.error(`[Auth] Unexpected error during ${provider} sign-in:`, err);
      session.setError(t.authUnexpectedError);
      session.setDebugInfo(AUTH_DIAGNOSTIC_CODES.FAILURE);
      if (session.oauthTimeoutRef.current) clearTimeout(session.oauthTimeoutRef.current);
      endAuthFlow();
      session.setLoadingProvider(null);
    }
  };

  const handleProviderSignIn = (provider: SocialAuthProviderId) => {
    if (provider === "google") {
      void handleGoogleSignIn();
      return;
    }
    void handleOAuthSignIn(provider);
  };

  const handleGoogleSignIn = async () => {
    // Native Android: use native account picker (no browser redirect)
    if (isAndroid) {
      if (!canStartAuthFlow()) {
        session.setError(t.authTooManyAttempts);
        logger.warn("[Auth] Native Google auth blocked by guard");
        return;
      }
      startAuthFlow();
      session.setLoadingProvider("google");
      session.setError(null);
      session.setDebugInfo(null);

      try {
        const result = await authenticateWithGoogleNative();

        if (result.success && result.user) {
          analytics.signIn();
          session.tryComplete(
            { name: result.user.name, email: result.user.email },
            "nativeGoogleAuth"
          );
        } else if (result.error === "cancelled") {
          session.setLoadingProvider(null);
        } else {
          session.setError(t.authUnexpectedError);
          session.setDebugInfo(AUTH_DIAGNOSTIC_CODES.NATIVE_FAILURE);
        }
      } catch (err) {
        logger.error("[Auth] Native Google auth exception:", err);
        session.setError(t.authUnexpectedError);
        session.setDebugInfo(AUTH_DIAGNOSTIC_CODES.NATIVE_FAILURE);
      } finally {
        endAuthFlow();
        session.setLoadingProvider(null);
      }
      return;
    }

    // Web and iOS: use the owner-bound OAuth callback flow.
    void handleOAuthSignIn("google");
  };
  const handleAppleSignIn = () => void handleOAuthSignIn("apple");
  const handleFacebookSignIn = () => void handleOAuthSignIn("facebook");
  const handleTelegramSignIn = () => void handleOAuthSignIn("telegram");

  // Phone Auth handlers
  const handlePhoneStart = () => {
    session.setError(null);
    session.setPhoneStep("input");
    session.setPhoneNumber("");
    session.setOtpCode("");
  };

  const handleSendOtp = async () => {
    if (!supabase) return;

    // Rate limit: auth guard (3 per minute)
    if (!canStartAuthFlow()) {
      session.setError(t.authTooManyAttempts || "Too many attempts. Please wait.");
      logger.warn("[Auth] OTP send blocked by auth guard");
      return;
    }

    // Cooldown: 60 seconds between OTP sends
    const now = Date.now();
    const elapsed = now - lastOtpSendRef.current;
    if (lastOtpSendRef.current > 0 && elapsed < OTP_COOLDOWN_MS) {
      const remaining = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
      session.setError(
        t.authOtpCooldown || `Please wait ${remaining}s before requesting another code.`
      );
      void hapticError();
      return;
    }

    // Validate phone with Zod schema (E.164 format)
    const normalized = session.phoneNumber.trim();
    if (!phoneSchema.safeParse(normalized).success) {
      session.setError(
        t.authInvalidPhone || "Enter a valid phone number with country code (e.g. +1234567890)"
      );
      void hapticError();
      return;
    }

    startAuthFlow();
    session.setLoadingProvider("phone");
    session.setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalized,
      });

      if (otpError) {
        logger.warn("[Auth] OTP send error:", otpError.message);
        session.setError(otpError.message);
        session.setLoadingProvider(null);
        endAuthFlow();
        return;
      }

      lastOtpSendRef.current = Date.now();
      logger.log("[Auth] OTP sent to phone");
      session.setPhoneStep("otp");
      session.setLoadingProvider(null);
      endAuthFlow();
    } catch (err) {
      logger.error("[Auth] OTP send failed:", err);
      session.setError(t.authOtpSendFailed || "Failed to send code. Please try again.");
      session.setLoadingProvider(null);
      endAuthFlow();
    }
  };

  const handleVerifyOtp = async () => {
    if (!supabase) return;

    const code = session.otpCode.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      session.setError("Enter a 6-digit code");
      void hapticError();
      return;
    }

    session.setLoadingProvider("phone");
    session.setError(null);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: session.phoneNumber.trim(),
        token: code,
        type: "sms",
      });

      if (verifyError) {
        logger.warn("[Auth] OTP verify error:", verifyError.message);
        session.setError(verifyError.message);
        session.setLoadingProvider(null);
        return;
      }

      if (data.session?.user) {
        const phone = data.session.user.phone || session.phoneNumber.trim();
        const metadata = data.session.user.user_metadata || {};
        const name = metadata.full_name || metadata.name || phone;
        analytics.signIn();
        session.tryComplete({ name, email: data.session.user.email || "" }, "phoneOtp");
      }
    } catch (err) {
      logger.error("[Auth] OTP verify failed:", err);
      session.setError("Verification failed. Please try again.");
      session.setLoadingProvider(null);
    }
  };

  const handlePhoneBack = () => {
    session.setPhoneStep("idle");
    session.setLoadingProvider(null);
    session.setError(null);
  };

  // Export debug info
  const exportDebugInfo = () => {
    const info = buildAuthDiagnosticEvidence({
      timestamp: new Date().toISOString(),
      isNative,
      redirectUrl: getAuthRedirectUrl(),
      supabaseConfigured: !!supabase,
      error: session.error,
      debugInfo: session.debugInfo,
    });

    const blob = new Blob([serializeAuthDiagnosticEvidence(info)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zenflow-auth-debug-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return {
    handleGoogleSignIn,
    handleAppleSignIn,
    handleFacebookSignIn,
    handleTelegramSignIn,
    handleProviderSignIn,
    handlePhoneStart,
    handleSendOtp,
    handleVerifyOtp,
    handlePhoneBack,
    exportDebugInfo,
  };
}
