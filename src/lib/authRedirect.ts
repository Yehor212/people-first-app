import { Capacitor } from "@capacitor/core";

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

// Basic JWT format validation (header.payload.signature)
const isValidJwtFormat = (token: string): boolean => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  // Check each part is base64url encoded
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
  return parts.every(part => part.length > 0 && base64UrlRegex.test(part));
};

export const getAuthRedirectUrl = () => {
  if (Capacitor.isNativePlatform()) {
    return NATIVE_REDIRECT_URL;
  }
  return `${window.location.origin}${import.meta.env.BASE_URL || "/"}`;
};

export const isNativePlatform = () => Capacitor.isNativePlatform();

export const handleAuthCallback = async (supabaseClient: any, url: string) => {
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

  // PKCE flow - exchange code for session (preferred, more secure)
  const code = searchParams.get("code") || hashParams.get("code");
  if (code) {
    // Validate code format (should be alphanumeric)
    if (!/^[A-Za-z0-9_-]+$/.test(code) || code.length > 256) {
      throw new Error('Invalid authorization code');
    }
    await supabaseClient.auth.exchangeCodeForSession(code);
    return;
  }

  // Implicit flow fallback - validate tokens before use
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    // Validate JWT format before setting session
    if (!isValidJwtFormat(accessToken)) {
      throw new Error('Invalid access token format');
    }
    if (!isValidJwtFormat(refreshToken)) {
      throw new Error('Invalid refresh token format');
    }

    await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }
};
