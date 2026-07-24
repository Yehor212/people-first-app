import { isNative } from "@/lib/platform";
import { logger } from "./logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BASE_URL } from "@/lib/env";
import {
  JOURNAL_PASSWORD_RESET_PARAM,
  persistJournalPasswordResetProofFromUrl,
} from "@/lib/journalPasswordResetHandoff";
import {
  runWithPkceCallbackUrl,
} from "@/lib/authTransitionCoordinator";
import {
  PKCE_ATTEMPT_PARAM,
} from "@/lib/pkceAttemptStorage";
import {
  ALLOWED_AUTH_REDIRECT_ORIGINS,
  isAllowedLocalOAuthOrigin,
  NATIVE_AUTH_REDIRECT_URL,
} from "@/lib/authRedirectPolicy";

const V2_ROUTE_PATHS = new Set(["/orb", "/habits", "/diary", "/planning", "/settings"]);

export { isAllowedLocalOAuthOrigin } from "@/lib/authRedirectPolicy";

function normalizeBasePath(basePath: string): string {
  const cleanBase = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return cleanBase.endsWith("/") ? cleanBase : `${cleanBase}/`;
}

function stripBasePath(pathname: string, basePath: string): string {
  const baseWithoutTrailingSlash = normalizeBasePath(basePath).replace(/\/$/, "");
  if (baseWithoutTrailingSlash && pathname.startsWith(baseWithoutTrailingSlash)) {
    const stripped = pathname.slice(baseWithoutTrailingSlash.length);
    return stripped || "/";
  }
  return pathname || "/";
}

function normalizeAppRoutePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function getV2RedirectPath(basePath: string): string | null {
  if (typeof window === "undefined") return null;

  const currentUrl = new URL(window.location.href);
  const currentAppPath = normalizeAppRoutePath(stripBasePath(currentUrl.pathname, basePath));
  const shouldReturnToV2 =
    currentUrl.searchParams.get("nav") === "v2" || V2_ROUTE_PATHS.has(currentAppPath);

  if (!shouldReturnToV2) return null;

  const routePath = V2_ROUTE_PATHS.has(currentAppPath) ? currentAppPath : "/orb";
  const redirectParams = new URLSearchParams();
  redirectParams.set("nav", "v2");

  const requestedLayout = currentUrl.searchParams.get("navLayout");
  if (requestedLayout === "phone" || requestedLayout === "web") {
    redirectParams.set("navLayout", requestedLayout);
  }

  const baseWithoutTrailingSlash = normalizeBasePath(basePath).replace(/\/$/, "");
  return `${baseWithoutTrailingSlash}${routePath}?${redirectParams.toString()}`;
}

export function getCleanAuthCallbackUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  const oauthParams = [
    "code",
    "error",
    "error_code",
    "error_description",
    "state",
    "access_token",
    "refresh_token",
    "expires_at",
    "expires_in",
    "token_type",
    "provider_token",
    "provider_refresh_token",
    JOURNAL_PASSWORD_RESET_PARAM,
    PKCE_ATTEMPT_PARAM,
  ];

  for (const param of oauthParams) {
    url.searchParams.delete(param);
  }

  const rawHash = url.hash.replace(/^#/, "");
  if (rawHash) {
    const hashParams = new URLSearchParams(rawHash);
    const hasOAuthHashParam = oauthParams.some((param) => hashParams.has(param));

    if (hasOAuthHashParam) {
      for (const param of oauthParams) {
        hashParams.delete(param);
      }
      const cleanHash = hashParams.toString();
      url.hash = cleanHash ? "#" + cleanHash : "";
    }
  }

  return url.pathname + url.search + url.hash;
}

// Known OAuth error codes for safe display
const KNOWN_ERROR_CODES = [
  "access_denied",
  "invalid_request",
  "unauthorized_client",
  "server_error",
  "temporarily_unavailable",
];

// Sanitize error message - only allow known patterns
export const sanitizeAuthErrorMessage = (message: string): string => {
  // Remove any HTML/script tags
  const cleaned = message.replace(/<[^>]*>/g, "").trim();
  // Limit length
  if (cleaned.length > 200) {
    return "Authentication error occurred";
  }
  // Check for known safe patterns
  if (KNOWN_ERROR_CODES.some((code) => cleaned.toLowerCase().includes(code))) {
    return cleaned;
  }
  // Generic fallback for unknown errors
  return "Authentication failed. Please try again.";
};

export const getAuthRedirectUrl = () => {
  if (isNative) {
    return NATIVE_AUTH_REDIRECT_URL;
  }

  // Web: construct clean redirect URL with origin allowlist (OWASP L18)
  const rawOrigin = window.location.origin;
  const origin =
    (ALLOWED_AUTH_REDIRECT_ORIGINS as readonly string[]).includes(rawOrigin) ||
    isAllowedLocalOAuthOrigin(rawOrigin)
      ? rawOrigin
      : ALLOWED_AUTH_REDIRECT_ORIGINS[0];
  const basePath = BASE_URL;

  // Ensure proper path format (no double slashes)
  const finalPath = getV2RedirectPath(basePath) || normalizeBasePath(basePath);

  const redirectUrl = `${origin}${finalPath}`;
  logger.log("[Auth] Generated redirect URL:", redirectUrl);

  return redirectUrl;
};

export const isNativePlatform = () => isNative;

export const handleAuthCallback = async (supabaseClient: SupabaseClient, url: string) => {
  if (!supabaseClient || !url) return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid callback URL");
  }

  const searchParams = new URLSearchParams(parsed.search);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));

  // Handle errors with sanitized messages
  const errorCode = searchParams.get("error") || hashParams.get("error");
  const errorDescription =
    searchParams.get("error_description") || hashParams.get("error_description");
  if (errorCode || errorDescription) {
    throw new Error(
      errorDescription
        ? sanitizeAuthErrorMessage(errorDescription)
        : "Authentication failed. Please try again.",
    );
  }

  // Try PKCE flow first - exchange code for session (most secure)
  const code = searchParams.get("code") || hashParams.get("code");
  if (code) {
    const normalizedCode = code.trim();
    if (normalizedCode.length === 0 || normalizedCode.length > 2048) {
      throw new Error("Invalid authorization code");
    }

    const exchange = () => supabaseClient.auth.exchangeCodeForSession(normalizedCode);
    const { data, error } = await runWithPkceCallbackUrl(
      supabaseClient.auth,
      url,
      exchange,
    );

    if (error) {
      logger.error("[Auth] exchangeCodeForSession error:", error.message);
      throw new Error(`Session exchange failed: ${error.message}`);
    }

    if (!data.session) {
      throw new Error("Session exchange succeeded but no session returned");
    }

    // Don't log email (PII) - log user ID instead
    logger.log(
      "[Auth] PKCE session exchange successful, user:",
      `user:${data.session.user.id.slice(0, 8)}`
    );
    persistJournalPasswordResetProofFromUrl(url, data.session.user.id);
    return;
  }

  // Fallback: Implicit flow - tokens directly in URL hash (used by Supabase for mobile)
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    logger.log("[Auth] Implicit flow detected, setting session from tokens");

    const { data, error } = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      logger.error("[Auth] setSession error:", error.message);
      throw new Error(`Session setup failed: ${error.message}`);
    }

    if (!data.session) {
      throw new Error("Session setup succeeded but no session returned");
    }

    // Don't log email (PII) - log user ID instead
    logger.log(
      "[Auth] Implicit flow session set, user:",
      `user:${data.session.user.id.slice(0, 8)}`
    );
    return;
  }

  // No valid authentication method found
  throw new Error("No valid authentication code or tokens found");
};

// Event name for OAuth completion notification
export const AUTH_COMPLETE_EVENT = "zenflow-auth-complete";

// Notify AuthScreen that auth completed in Index.tsx
export const notifyAuthComplete = () => {
  window.dispatchEvent(new CustomEvent(AUTH_COMPLETE_EVENT));
};

// Store pending auth URL for processing when supabase is ready
let pendingAuthUrl: string | null = null;

export const setPendingAuthUrl = (url: string | null) => {
  pendingAuthUrl = url;
  logger.log("[Auth] Pending auth URL set:", url ? "yes" : "null");
};

export const getPendingAuthUrl = (): string | null => {
  const url = pendingAuthUrl;
  pendingAuthUrl = null; // Clear after reading
  return url;
};

export const hasPendingAuthUrl = (): boolean => {
  return pendingAuthUrl !== null;
};
