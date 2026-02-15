import { useState, useEffect, useRef } from 'react';
import { Leaf, Loader2, AlertCircle, Phone, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getAuthRedirectUrl, isNativePlatform, AUTH_COMPLETE_EVENT } from '@/lib/authRedirect';
import { canStartAuthFlow, startAuthFlow, endAuthFlow } from '@/lib/authGuard';
import { authenticateWithGoogleNative } from '@/lib/nativeGoogleAuth';
import { App } from '@capacitor/app';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';

// Temporarily disabled auth providers (not production-ready)
const SHOW_APPLE_AUTH = false;
const SHOW_FACEBOOK_AUTH = false;
const SHOW_PHONE_AUTH = false; // Enable when Twilio is configured in Supabase Dashboard

// Phone number validation: E.164 format (+7-15 digits)
const PHONE_REGEX = /^\+\d{7,15}$/;

interface AuthScreenProps {
  onComplete: (userData: { name: string; email: string }) => void;
}

// Track which provider is currently loading
type AuthProvider = 'google' | 'apple' | 'facebook' | 'phone' | null;

// Phone auth flow steps
type PhoneStep = 'idle' | 'input' | 'otp';

export function AuthScreen({ onComplete }: AuthScreenProps) {
  const { t } = useLanguage();
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // Phone auth state
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('idle');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Prevent double onComplete calls (race condition with Index.tsx listener)
  const hasCompletedRef = useRef(false);
  // Ref for OAuth timeout
  const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use ref for onComplete to avoid dependency array issues
  // This ensures callbacks don't cause effect re-runs if parent re-renders
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  // Safe completion helper - ensures onComplete is called exactly once
  // This function atomically checks and sets the flag to prevent race conditions
  // Uses onCompleteRef.current to avoid closure issues
  const tryComplete = (userData: { name: string; email: string }, source: string): boolean => {
    if (hasCompletedRef.current) {
      logger.log(`[Auth] Completion already done, ignoring from ${source}`);
      return false;
    }
    hasCompletedRef.current = true;

    // Clear timeout
    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current);
      oauthTimeoutRef.current = null;
    }

    // Clear loading state
    setLoadingProvider(null);

    // Don't log email (PII)
    logger.log(`[Auth] Completing auth from ${source}`);
    onCompleteRef.current(userData);
    return true;
  };

  // Check if already signed in
  useEffect(() => {
    const checkSession = async () => {
      if (!supabase) return;
      if (hasCompletedRef.current) return; // Already completed

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          logger.error('[Auth] Session check error:', sessionError);
          setDebugInfo(`Session error: ${sessionError.message}`);
          return;
        }

        if (data.session?.user) {
          const metadata = data.session.user.user_metadata;
          const name = metadata?.full_name || metadata?.name || data.session.user.email?.split('@')[0] || 'Friend';
          const email = data.session.user.email || '';

          tryComplete({ name, email }, 'checkSession');
        }
      } catch (err) {
        logger.error('[Auth] Unexpected error checking session:', err);
        setDebugInfo(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    void checkSession();

  }, []); // Removed onComplete from deps - uses onCompleteRef instead

  // Listen for auth state changes (handles OAuth callback)
  useEffect(() => {
    if (!supabase) return;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      logger.log('[Auth] Auth state changed:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        endAuthFlow(); // Clear auth guard flag on successful sign-in
        const metadata = session.user.user_metadata;
        const name = metadata?.full_name || metadata?.name || session.user.email?.split('@')[0] || 'Friend';
        const email = session.user.email || '';

        tryComplete({ name, email }, 'onAuthStateChange');
      } else if (event === 'SIGNED_OUT') {
        endAuthFlow();
        setLoadingProvider(null);
      }
    });

    return () => {
      subscription?.subscription?.unsubscribe?.();
    };
   
  }, []); // Removed onComplete from deps - uses onCompleteRef instead

  // LEVEL 1: Check session when app resumes from OAuth browser
  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const checkSessionOnResume = async () => {
      // Early exit if already completed or not in loading state
      if (!isMounted || !loadingProvider || hasCompletedRef.current) return;

      await new Promise(resolve => setTimeout(resolve, 300));

      // Re-check after delay - another handler might have completed
      if (!isMounted || hasCompletedRef.current) return;

      try {
        const { data } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (data.session?.user) {
          const metadata = data.session.user.user_metadata;
          const name = metadata?.full_name || metadata?.name || data.session.user.email?.split('@')[0] || 'Friend';
          const email = data.session.user.email || '';

          tryComplete({ name, email }, 'checkSessionOnResume');
        } else if (!hasCompletedRef.current) {
          logger.log('[Auth] No session on resume, user may have canceled');
          setLoadingProvider(null);
          if (oauthTimeoutRef.current) {
            clearTimeout(oauthTimeoutRef.current);
            oauthTimeoutRef.current = null;
          }
        }
      } catch (err) {
        logger.error('[Auth] Error checking session on resume:', err);
        if (isMounted && !hasCompletedRef.current) setLoadingProvider(null);
      }
    };

    if (isNativePlatform()) {
      // Setup native app state listener
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && loadingProvider) {
          void checkSessionOnResume();
        }
      }).then(listener => {
        listenerHandle = listener;
      }).catch(err => {
        logger.error('[Auth] Failed to add appStateChange listener:', err);
      });

      return () => {
        isMounted = false;
        if (listenerHandle) {
          listenerHandle.remove().catch(() => {});
        }
      };
    }

    // Web fallback
    const handleFocus = () => {
      if (loadingProvider) void checkSessionOnResume();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
   
  }, [loadingProvider]); // Removed onComplete from deps - uses onCompleteRef instead

  // LEVEL 2: Listen for auth completion from Index.tsx
  useEffect(() => {
    const handleAuthComplete = () => {
      logger.log('[Auth] Received auth complete event from Index.tsx');
      setLoadingProvider(null);
      if (oauthTimeoutRef.current) {
        clearTimeout(oauthTimeoutRef.current);
        oauthTimeoutRef.current = null;
      }
    };

    window.addEventListener(AUTH_COMPLETE_EVENT, handleAuthComplete);
    return () => window.removeEventListener(AUTH_COMPLETE_EVENT, handleAuthComplete);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (oauthTimeoutRef.current) {
        clearTimeout(oauthTimeoutRef.current);
      }
    };
  }, []);

  // Generic OAuth sign-in handler
  const handleOAuthSignIn = async (provider: 'google' | 'apple' | 'facebook') => {
    if (!supabase) {
      setError(t.authSupabaseNotConfigured);
      return;
    }

    // Guard against redirect loops
    if (!canStartAuthFlow()) {
      setError(t.authTooManyAttempts);
      logger.warn('[Auth] Auth flow blocked by guard');
      return;
    }

    startAuthFlow();
    setLoadingProvider(provider);
    setError(null);
    setDebugInfo(null);

    // LEVEL 3: OAuth timeout (60 seconds)
    if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
    oauthTimeoutRef.current = setTimeout(() => {
      if (!hasCompletedRef.current) {
        logger.warn(`[Auth] ${provider} OAuth timeout after 60s`);
        setLoadingProvider(null);
        setError(t.authSignInTooLong);
      }
    }, 60000);

    try {
      const redirectUrl = getAuthRedirectUrl();
      logger.log(`[Auth] Starting ${provider} sign-in with redirect URL:`, redirectUrl);

      // Log platform info for debugging
      const platform = isNativePlatform() ? 'native' : 'web';
      logger.log('[Auth] Platform:', platform);
      setDebugInfo(`Platform: ${platform}, Redirect: ${redirectUrl}`);

      // Provider-specific options
      const options: {
        redirectTo: string;
        scopes?: string;
        queryParams?: Record<string, string>;
      } = {
        redirectTo: redirectUrl,
      };

      if (provider === 'apple') {
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

        // Enhanced error messages (developer-facing OAuth config errors — not user-visible in normal flow)
        let errorMessage = t.authUnexpectedError || `Failed to sign in with ${provider}.`;

        if (signInError.message.includes('invalid_client')) {
          errorMessage = t.authNotConfigured || `${provider} OAuth not configured correctly.`;
        } else if (signInError.message.includes('redirect_uri')) {
          errorMessage = t.authNotConfigured || 'Redirect URI mismatch.';
        } else if (signInError.message.includes('unauthorized')) {
          errorMessage = t.authNotConfigured || `OAuth client not authorized.`;
        }

        setError(errorMessage);
        setDebugInfo(`Error code: ${signInError.status || 'unknown'}, Message: ${signInError.message}`);
        if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
        endAuthFlow();
        setLoadingProvider(null);
        return;
      }

      // Log OAuth URL for debugging
      if (data?.url) {
        logger.log(`[Auth] ${provider} OAuth URL generated:`, data.url);
        setDebugInfo(`OAuth URL generated successfully`);
      }
    } catch (err) {
      logger.error(`[Auth] Unexpected error during ${provider} sign-in:`, err);
      setError(t.authUnexpectedError);
      setDebugInfo(`Exception: ${err instanceof Error ? err.message : String(err)}`);
      if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
      endAuthFlow();
      setLoadingProvider(null);
    }
  };

  // Native Google Sign-In for Android (no browser redirect)
  const handleNativeGoogleSignIn = async () => {
    if (!supabase) {
      setError(t.authSupabaseNotConfigured);
      return;
    }

    if (!canStartAuthFlow()) {
      setError(t.authTooManyAttempts);
      return;
    }

    startAuthFlow();
    setLoadingProvider('google');
    setError(null);
    setDebugInfo(null);

    try {
      const result = await authenticateWithGoogleNative();

      if (result.success && result.user) {
        endAuthFlow();
        tryComplete(result.user, 'nativeGoogleSignIn');
      } else if (result.error === 'cancelled') {
        // User cancelled — just reset UI
        endAuthFlow();
        setLoadingProvider(null);
      } else {
        // Native failed — show error (no browser fallback on Android)
        logger.error('[Auth] Native sign-in failed:', result.error);
        endAuthFlow();
        setLoadingProvider(null);
        setError(t.authGoogleSignInFailed || 'Google Sign-In failed. Please try again.');
        setDebugInfo(result.error || null);
      }
    } catch (err) {
      logger.error('[Auth] Native Google sign-in error:', err);
      endAuthFlow();
      setLoadingProvider(null);
      setError(t.authGoogleSignInFailed || 'Google Sign-In failed. Please try again.');
      setDebugInfo(err instanceof Error ? err.message : null);
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
    setError(null);
    setPhoneStep('input');
    setPhoneNumber('');
    setOtpCode('');
  };

  const handleSendOtp = async () => {
    if (!supabase) return;

    const normalized = phoneNumber.trim();
    if (!PHONE_REGEX.test(normalized)) {
      setError('Enter a valid phone number with country code (e.g. +1234567890)');
      return;
    }

    setLoadingProvider('phone');
    setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalized,
      });

      if (otpError) {
        logger.warn('[Auth] OTP send error:', otpError.message);
        setError(otpError.message);
        setLoadingProvider(null);
        return;
      }

      logger.log('[Auth] OTP sent to phone');
      setPhoneStep('otp');
      setLoadingProvider(null);
    } catch (err) {
      logger.error('[Auth] OTP send failed:', err);
      setError('Failed to send code. Please try again.');
      setLoadingProvider(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (!supabase) return;

    const code = otpCode.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Enter a 6-digit code');
      return;
    }

    setLoadingProvider('phone');
    setError(null);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: phoneNumber.trim(),
        token: code,
        type: 'sms',
      });

      if (verifyError) {
        logger.warn('[Auth] OTP verify error:', verifyError.message);
        setError(verifyError.message);
        setLoadingProvider(null);
        return;
      }

      if (data.session?.user) {
        const phone = data.session.user.phone || phoneNumber.trim();
        const metadata = data.session.user.user_metadata || {};
        const name = metadata.full_name || metadata.name || phone;
        tryComplete({ name, email: data.session.user.email || '' }, 'phoneOtp');
      }
    } catch (err) {
      logger.error('[Auth] OTP verify failed:', err);
      setError('Verification failed. Please try again.');
      setLoadingProvider(null);
    }
  };

  const handlePhoneBack = () => {
    setPhoneStep('idle');
    setLoadingProvider(null);
    setError(null);
  };

  // Export debug info
  const exportDebugInfo = () => {
    const info = {
      timestamp: new Date().toISOString(),
      platform: isNativePlatform() ? 'native' : 'web',
      redirectUrl: getAuthRedirectUrl(),
      supabaseConfigured: !!supabase,
      error: error,
      debugInfo: debugInfo,
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

  const isLoading = loadingProvider !== null;

  return (
    <div
      className="min-h-screen zen-gradient-hero flex items-center justify-center p-4"
      role="main"
      aria-labelledby="auth-title"
    >
      <div className="w-full max-w-md motion-safe:animate-fade-in">
        {/* Logo */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4" aria-hidden="true">
            <div className="p-3 zen-gradient rounded-2xl zen-shadow-glow">
              <Leaf className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 id="auth-title" className="text-3xl font-bold zen-text-gradient mb-2">
            {t.authWelcomeTitle}
          </h1>
          <p className="text-muted-foreground">
            {t.authWelcomeSubtitle}
          </p>
        </header>

        {/* Auth Card */}
        <section
          className="bg-card rounded-2xl p-6 zen-shadow-card mb-4 space-y-3"
          aria-labelledby="auth-methods-title"
          aria-busy={isLoading}
        >
          <h2 id="auth-methods-title" className="text-lg font-semibold text-foreground text-center mb-4">
            {t.authContinueWith}
          </h2>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading || !supabase}
            aria-label={loadingProvider === 'google' ? t.authSigningInGoogle : t.continueWithGoogle}
            aria-disabled={isLoading || !supabase}
            className="w-full py-4 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingProvider === 'google' ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {t.continueWithGoogle}
              </>
            )}
          </button>

          {/* Apple Sign In Button — temporarily hidden */}
          {SHOW_APPLE_AUTH && (
          <button
            onClick={handleAppleSignIn}
            disabled={isLoading || !supabase}
            aria-label={loadingProvider === 'apple' ? t.authSigningIn : t.continueWithApple}
            aria-disabled={isLoading || !supabase}
            className="w-full py-4 bg-black hover:bg-gray-900 text-white font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingProvider === 'apple' ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
                </svg>
                {t.continueWithApple}
              </>
            )}
          </button>
          )}

          {/* Facebook Sign In Button — temporarily hidden */}
          {SHOW_FACEBOOK_AUTH && (
          <button
            onClick={handleFacebookSignIn}
            disabled={isLoading || !supabase}
            aria-label={loadingProvider === 'facebook' ? t.authSigningIn : t.continueWithFacebook}
            aria-disabled={isLoading || !supabase}
            className="w-full py-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingProvider === 'facebook' ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {t.continueWithFacebook}
              </>
            )}
          </button>
          )}

          {/* Phone Sign In */}
          {SHOW_PHONE_AUTH && phoneStep === 'idle' && (
          <button
            onClick={handlePhoneStart}
            disabled={isLoading || !supabase}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Phone className="w-5 h-5" />
            {t.continueWithPhone || 'Continue with Phone'}
          </button>
          )}

          {/* Phone number input */}
          {SHOW_PHONE_AUTH && phoneStep === 'input' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={handlePhoneBack}
                className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-foreground">
                {t.authEnterPhone || 'Enter your phone number'}
              </span>
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl text-base bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
            />
            <button
              onClick={() => void handleSendOtp()}
              disabled={loadingProvider === 'phone' || !phoneNumber.trim()}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingProvider === 'phone' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t.authSendCode || 'Send code'
              )}
            </button>
          </div>
          )}

          {/* OTP verification */}
          {SHOW_PHONE_AUTH && phoneStep === 'otp' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => setPhoneStep('input')}
                className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-muted-foreground">
                {(t.authCodeSentTo || 'Code sent to {phone}').replace('{phone}', phoneNumber)}
              </span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl text-center text-2xl tracking-[0.5em] font-mono bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/30"
            />
            <button
              onClick={() => void handleVerifyOtp()}
              disabled={loadingProvider === 'phone' || otpCode.length !== 6}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingProvider === 'phone' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t.authVerify || 'Verify'
              )}
            </button>
          </div>
          )}

          {!supabase && (
            <div role="alert" className="p-3 bg-destructive/10 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
              <p className="text-sm text-destructive">
                {t.authNotConfiguredMessage}
              </p>
            </div>
          )}

          {error && (
            <div role="alert" aria-live="polite" className="p-3 bg-destructive/10 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm text-destructive whitespace-pre-wrap">
                  {error}
                </p>
                {debugInfo && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {debugInfo}
                  </p>
                )}
                <button
                  onClick={exportDebugInfo}
                  aria-label={t.authExportDebugInfo}
                  className="text-xs text-primary underline mt-2"
                >
                  {t.authExportDebugInfo}
                </button>
              </div>
            </div>
          )}

        </section>

        {/* Privacy Note */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          {t.authPrivacyNote}
        </p>
      </div>
    </div>
  );
}

// Export for backwards compatibility
export { AuthScreen as GoogleAuthScreen };
