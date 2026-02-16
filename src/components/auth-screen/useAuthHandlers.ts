import { supabase } from '@/lib/supabaseClient';
import { getAuthRedirectUrl, isNativePlatform } from '@/lib/authRedirect';
import { canStartAuthFlow, startAuthFlow, endAuthFlow } from '@/lib/authGuard';
import { authenticateWithGoogleNative } from '@/lib/nativeGoogleAuth';
import { logger } from '@/lib/logger';
import { PHONE_REGEX } from './types';
import type { useAuthSession } from './useAuthSession';

type Session = ReturnType<typeof useAuthSession>;

export function useAuthHandlers(session: Session, t: Record<string, string>) {
  // Generic OAuth sign-in handler
  const handleOAuthSignIn = async (provider: 'google' | 'apple' | 'facebook') => {
    if (!supabase) {
      session.setError(t.authSupabaseNotConfigured);
      return;
    }

    if (!canStartAuthFlow()) {
      session.setError(t.authTooManyAttempts);
      logger.warn('[Auth] Auth flow blocked by guard');
      return;
    }

    startAuthFlow();
    session.setLoadingProvider(provider);
    session.setError(null);
    session.setDebugInfo(null);

    // OAuth timeout (60 seconds)
    if (session.oauthTimeoutRef.current) clearTimeout(session.oauthTimeoutRef.current);
    session.oauthTimeoutRef.current = setTimeout(() => {
      if (!session.hasCompletedRef.current) {
        logger.warn(`[Auth] ${provider} OAuth timeout after 60s`);
        session.setLoadingProvider(null);
        session.setError(t.authSignInTooLong);
      }
    }, 60000);

    try {
      const redirectUrl = getAuthRedirectUrl();
      logger.log(`[Auth] Starting ${provider} sign-in with redirect URL:`, redirectUrl);

      const platform = isNativePlatform() ? 'native' : 'web';
      logger.log('[Auth] Platform:', platform);
      session.setDebugInfo(`Platform: ${platform}, Redirect: ${redirectUrl}`);

      const options: {
        redirectTo: string;
        scopes?: string;
        queryParams?: Record<string, string>;
      } = {
        redirectTo: redirectUrl,
      };

      if (provider === 'google') {
        options.queryParams = { prompt: 'select_account' };
      } else if (provider === 'apple') {
        options.scopes = 'name email';
      } else if (provider === 'facebook') {
        options.scopes = 'email,public_profile';
      }

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });

      if (signInError) {
        logger.error(`[Auth] ${provider} sign-in error:`, signInError);

        let errorMessage = t.authUnexpectedError || `Failed to sign in with ${provider}.`;

        if (signInError.message.includes('invalid_client')) {
          errorMessage = t.authNotConfigured || `${provider} OAuth not configured correctly.`;
        } else if (signInError.message.includes('redirect_uri')) {
          errorMessage = t.authNotConfigured || 'Redirect URI mismatch.';
        } else if (signInError.message.includes('unauthorized')) {
          errorMessage = t.authNotConfigured || `OAuth client not authorized.`;
        }

        session.setError(errorMessage);
        session.setDebugInfo(`Error code: ${signInError.status || 'unknown'}, Message: ${signInError.message}`);
        if (session.oauthTimeoutRef.current) clearTimeout(session.oauthTimeoutRef.current);
        endAuthFlow();
        session.setLoadingProvider(null);
        return;
      }

      if (data?.url) {
        logger.log(`[Auth] ${provider} OAuth URL generated:`, data.url);
        session.setDebugInfo(`OAuth URL generated successfully`);
      }
    } catch (err) {
      logger.error(`[Auth] Unexpected error during ${provider} sign-in:`, err);
      session.setError(t.authUnexpectedError);
      session.setDebugInfo(`Exception: ${err instanceof Error ? err.message : String(err)}`);
      if (session.oauthTimeoutRef.current) clearTimeout(session.oauthTimeoutRef.current);
      endAuthFlow();
      session.setLoadingProvider(null);
    }
  };

  // Native Google Sign-In for Android (no browser redirect)
  const handleNativeGoogleSignIn = async () => {
    if (!supabase) {
      session.setError(t.authSupabaseNotConfigured);
      return;
    }

    if (!canStartAuthFlow()) {
      session.setError(t.authTooManyAttempts);
      return;
    }

    startAuthFlow();
    session.setLoadingProvider('google');
    session.setError(null);
    session.setDebugInfo(null);

    try {
      const result = await authenticateWithGoogleNative();

      if (result.success && result.user) {
        endAuthFlow();
        session.tryComplete(result.user, 'nativeGoogleSignIn');
      } else if (result.error === 'cancelled') {
        endAuthFlow();
        session.setLoadingProvider(null);
      } else {
        logger.error('[Auth] Native sign-in failed:', result.error);
        endAuthFlow();
        session.setLoadingProvider(null);
        session.setError(t.authGoogleSignInFailed || 'Google Sign-In failed. Please try again.');
        session.setDebugInfo(result.error || null);
      }
    } catch (err) {
      logger.error('[Auth] Native Google sign-in error:', err);
      endAuthFlow();
      session.setLoadingProvider(null);
      session.setError(t.authGoogleSignInFailed || 'Google Sign-In failed. Please try again.');
      session.setDebugInfo(err instanceof Error ? err.message : null);
    }
  };

  const handleGoogleSignIn = () => {
    if (isNativePlatform()) {
      void handleNativeGoogleSignIn();
    } else {
      void handleOAuthSignIn('google');
    }
  };
  const handleAppleSignIn = () => void handleOAuthSignIn('apple');
  const handleFacebookSignIn = () => void handleOAuthSignIn('facebook');

  // Phone Auth handlers
  const handlePhoneStart = () => {
    session.setError(null);
    session.setPhoneStep('input');
    session.setPhoneNumber('');
    session.setOtpCode('');
  };

  const handleSendOtp = async () => {
    if (!supabase) return;

    const normalized = session.phoneNumber.trim();
    if (!PHONE_REGEX.test(normalized)) {
      session.setError('Enter a valid phone number with country code (e.g. +1234567890)');
      return;
    }

    session.setLoadingProvider('phone');
    session.setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalized,
      });

      if (otpError) {
        logger.warn('[Auth] OTP send error:', otpError.message);
        session.setError(otpError.message);
        session.setLoadingProvider(null);
        return;
      }

      logger.log('[Auth] OTP sent to phone');
      session.setPhoneStep('otp');
      session.setLoadingProvider(null);
    } catch (err) {
      logger.error('[Auth] OTP send failed:', err);
      session.setError('Failed to send code. Please try again.');
      session.setLoadingProvider(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (!supabase) return;

    const code = session.otpCode.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      session.setError('Enter a 6-digit code');
      return;
    }

    session.setLoadingProvider('phone');
    session.setError(null);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: session.phoneNumber.trim(),
        token: code,
        type: 'sms',
      });

      if (verifyError) {
        logger.warn('[Auth] OTP verify error:', verifyError.message);
        session.setError(verifyError.message);
        session.setLoadingProvider(null);
        return;
      }

      if (data.session?.user) {
        const phone = data.session.user.phone || session.phoneNumber.trim();
        const metadata = data.session.user.user_metadata || {};
        const name = metadata.full_name || metadata.name || phone;
        session.tryComplete({ name, email: data.session.user.email || '' }, 'phoneOtp');
      }
    } catch (err) {
      logger.error('[Auth] OTP verify failed:', err);
      session.setError('Verification failed. Please try again.');
      session.setLoadingProvider(null);
    }
  };

  const handlePhoneBack = () => {
    session.setPhoneStep('idle');
    session.setLoadingProvider(null);
    session.setError(null);
  };

  // Export debug info
  const exportDebugInfo = () => {
    const info = {
      timestamp: new Date().toISOString(),
      platform: isNativePlatform() ? 'native' : 'web',
      redirectUrl: getAuthRedirectUrl(),
      supabaseConfigured: !!supabase,
      error: session.error,
      debugInfo: session.debugInfo,
      userAgent: navigator.userAgent
    };

    const blob = new Blob([JSON.stringify(info, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zenflow-auth-debug-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return {
    handleGoogleSignIn, handleAppleSignIn, handleFacebookSignIn,
    handlePhoneStart, handleSendOtp, handleVerifyOtp, handlePhoneBack,
    exportDebugInfo,
  };
}
