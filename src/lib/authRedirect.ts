import { Capacitor } from "@capacitor/core";
import { logger } from "./logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const NATIVE_REDIRECT_URL = "com.zenflow.app://login-callback";

// Known OAuth error codes for safe display
const KNOWN_ERROR_CODES = [
  'access_denied',
  'invalid_request',
  'unauthorized_client',
  'server_error',
  'temporarily_unavailable'
];

// Sanitize error message - only allow known patterns
const sanitizeErrorMessage = (message: string): string => {
  // Remove any HTML/script tags
  const cleaned = message.replace(/<[^>]*>/g, '').trim();
  // Limit length
  if (cleaned.length > 200) {
    return 'Authentication error occurred';
  }
  // Check for known safe patterns
  if (KNOWN_ERROR_CODES.some(code => cleaned.toLowerCase().includes(code))) {
    return cleaned;
  }
  // Generic fallback for unknown errors
  return 'Authentication failed. Please try again.';
};

export const getAuthRedirectUrl = () => {
  if (Capacitor.isNativePlatform()) {
    return NATIVE_REDIRECT_URL;
  }
  return `${window.location.origin}${import.meta.env.BASE_URL || "/"}`;
};

export const isNativePlatform = () => Capacitor.isNativePlatform();

export const handleAuthCallback = async (supabaseClient: SupabaseClient, url: string) => {
  if (!supabaseClient || !url) return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid callback URL');
  }

  const searchParams = new URLSearchParams(parsed.search);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));

  // Handle errors with sanitized messages
  const errorDescription = searchParams.get("error_description") || hashParams.get("error_description");
  if (errorDescription) {
    throw new Error(sanitizeErrorMessage(errorDescription));
  }

  // Try PKCE flow first - exchange code for session (most secure)
  const code = searchParams.get("code") || hashParams.get("code");
  if (code) {
    // Validate code format (should be alphanumeric)
    if (!/^[A-Za-z0-9_-]+$/.test(code) || code.length > 256) {
      throw new Error('Invalid authorization code');
    }

    const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);

    if (error) {
      logger.error('[Auth] exchangeCodeForSession error:', error.message);
      throw new Error(`Session exchange failed: ${error.message}`);
    }

    if (!data.session) {
      throw new Error('Session exchange succeeded but no session returned');
    }

    logger.log('[Auth] PKCE session exchange successful, user:', data.session.user.email);
    return;
  }

  // Fallback: Implicit flow - tokens directly in URL hash (used by Supabase for mobile)
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    logger.log('[Auth] Implicit flow detected, setting session from tokens');

    const { data, error } = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      logger.error('[Auth] setSession error:', error.message);
      throw new Error(`Session setup failed: ${error.message}`);
    }

    if (!data.session) {
      throw new Error('Session setup succeeded but no session returned');
    }

    logger.log('[Auth] Implicit flow session set, user:', data.session.user.email);
    return;
  }

  // No valid authentication method found
  throw new Error('No valid authentication code or tokens found');
};

// Event name for OAuth completion notification
export const AUTH_COMPLETE_EVENT = 'zenflow-auth-complete';

// Notify GoogleAuthScreen that auth completed in Index.tsx
export const notifyAuthComplete = () => {
  window.dispatchEvent(new CustomEvent(AUTH_COMPLETE_EVENT));
};

// Store pending auth URL for processing when supabase is ready
let pendingAuthUrl: string | null = null;

export const setPendingAuthUrl = (url: string | null) => {
  pendingAuthUrl = url;
  logger.log('[Auth] Pending auth URL set:', url ? 'yes' : 'null');
};

export const getPendingAuthUrl = (): string | null => {
  const url = pendingAuthUrl;
  pendingAuthUrl = null; // Clear after reading
  return url;
};

export const hasPendingAuthUrl = (): boolean => {
  return pendingAuthUrl !== null;
};
