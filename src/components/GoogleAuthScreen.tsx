import { useState, useEffect, useRef } from 'react';
import { Leaf, Mail, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getAuthRedirectUrl, isNativePlatform, AUTH_COMPLETE_EVENT } from '@/lib/authRedirect';
import { App } from '@capacitor/app';
import { logger } from '@/lib/logger';

interface GoogleAuthScreenProps {
  onComplete: (userData: { name: string; email: string }) => void;
  onSkip: () => void;
}

export function GoogleAuthScreen({ onComplete, onSkip }: GoogleAuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // Prevent double onComplete calls (race condition with Index.tsx listener)
  const hasCompletedRef = useRef(false);
  // Ref for OAuth timeout
  const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safe completion helper - ensures onComplete is called exactly once
  // This function atomically checks and sets the flag to prevent race conditions
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
    setLoading(false);

    logger.log(`[Auth] Completing auth from ${source}:`, userData.email);
    onComplete(userData);
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

    checkSession();
  }, [onComplete]);

  // Listen for auth state changes (handles OAuth callback)
  useEffect(() => {
    if (!supabase) return;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      logger.log('[Auth] Auth state changed:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        const metadata = session.user.user_metadata;
        const name = metadata?.full_name || metadata?.name || session.user.email?.split('@')[0] || 'Friend';
        const email = session.user.email || '';

        tryComplete({ name, email }, 'onAuthStateChange');
      } else if (event === 'SIGNED_OUT') {
        setLoading(false);
      }
    });

    return () => {
      subscription?.subscription?.unsubscribe?.();
    };
  }, [onComplete]);

  // LEVEL 1: Check session when app resumes from OAuth browser
  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const checkSessionOnResume = async () => {
      // Early exit if already completed or not in loading state
      if (!isMounted || !loading || hasCompletedRef.current) return;

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
          setLoading(false);
          if (oauthTimeoutRef.current) {
            clearTimeout(oauthTimeoutRef.current);
            oauthTimeoutRef.current = null;
          }
        }
      } catch (err) {
        logger.error('[Auth] Error checking session on resume:', err);
        if (isMounted && !hasCompletedRef.current) setLoading(false);
      }
    };

    if (isNativePlatform()) {
      // Setup native app state listener
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && loading) {
          checkSessionOnResume();
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
      if (loading) checkSessionOnResume();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, [loading, onComplete]);

  // LEVEL 2: Listen for auth completion from Index.tsx
  useEffect(() => {
    const handleAuthComplete = () => {
      logger.log('[Auth] Received auth complete event from Index.tsx');
      setLoading(false);
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

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setError('Supabase not configured. Please add your Supabase credentials.');
      return;
    }

    setLoading(true);
    setError(null);
    setDebugInfo(null);

    // LEVEL 3: OAuth timeout (60 seconds)
    if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
    oauthTimeoutRef.current = setTimeout(() => {
      if (!hasCompletedRef.current) {
        logger.warn('[Auth] OAuth timeout after 60s');
        setLoading(false);
        setError('Sign-in took too long. Please try again.');
      }
    }, 60000);

    try {
      const redirectUrl = getAuthRedirectUrl();
      logger.log('[Auth] Starting Google sign-in with redirect URL:', redirectUrl);

      // Log platform info for debugging
      const platform = isNativePlatform() ? 'native' : 'web';
      logger.log('[Auth] Platform:', platform);
      setDebugInfo(`Platform: ${platform}, Redirect: ${redirectUrl}`);

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (signInError) {
        logger.error('[Auth] Google sign-in error:', signInError);

        // Enhanced error messages
        let errorMessage = 'Failed to sign in with Google.';

        if (signInError.message.includes('invalid_client')) {
          errorMessage = 'Google OAuth not configured correctly. Please check:\n' +
            '1. SHA-1 fingerprint added to Google Cloud Console\n' +
            '2. Android Client ID added to Supabase\n' +
            '3. Redirect URI added to Supabase';
        } else if (signInError.message.includes('redirect_uri')) {
          errorMessage = 'Redirect URI mismatch. Please add com.zenflow.app://login-callback to Supabase allowed URLs.';
        } else if (signInError.message.includes('unauthorized')) {
          errorMessage = 'OAuth client not authorized. Please enable Google provider in Supabase.';
        }

        setError(errorMessage);
        setDebugInfo(`Error code: ${signInError.status || 'unknown'}, Message: ${signInError.message}`);
        if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
        setLoading(false);
        return;
      }

      // Log OAuth URL for debugging
      if (data?.url) {
        logger.log('[Auth] OAuth URL generated:', data.url);
        setDebugInfo(`OAuth URL generated successfully`);
      }
    } catch (err) {
      logger.error('[Auth] Unexpected error during sign-in:', err);
      setError('Unexpected error occurred. Please try again.');
      setDebugInfo(`Exception: ${err instanceof Error ? err.message : String(err)}`);
      if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
      setLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    // For now, just skip - can implement magic link later
    onSkip();
  };

  const handleSkip = () => {
    onSkip();
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

  return (
    <div className="min-h-screen zen-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 zen-gradient rounded-2xl zen-shadow-glow">
              <Leaf className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold zen-text-gradient mb-2">
            Welcome to ZenFlow
          </h1>
          <p className="text-muted-foreground">
            Sign in to sync your data across devices
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-card rounded-2xl p-6 zen-shadow-card mb-4 space-y-4">
          <h2 className="text-lg font-semibold text-foreground text-center mb-4">
            Continue with
          </h2>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading || !supabase}
            className="w-full py-4 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
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
                Continue with Google
              </>
            )}
          </button>

          {!supabase && (
            <div className="p-3 bg-destructive/10 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">
                Authentication not configured. Configure Supabase to enable sign-in.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
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
                  className="text-xs text-primary underline mt-2"
                >
                  Export debug info
                </button>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Email Sign In Button (Magic Link) */}
          <button
            onClick={handleEmailSignIn}
            disabled={loading}
            className="w-full py-3 bg-secondary text-secondary-foreground font-medium rounded-2xl hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            <Mail className="w-5 h-5" />
            Continue with Email
          </button>
        </div>

        {/* Skip Button */}
        <button
          onClick={handleSkip}
          className="w-full py-3 bg-transparent text-muted-foreground font-medium rounded-2xl hover:bg-secondary/50 transition-colors"
        >
          Skip for now
        </button>

        {/* Privacy Note */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Your data is stored locally and optionally synced to the cloud.
          <br />
          We respect your privacy.
        </p>
      </div>
    </div>
  );
}
