/**
 * Centralized environment configuration (TD-22)
 * Single source of truth for all import.meta.env access
 */

// Vite built-ins
export const IS_DEV = import.meta.env.DEV;
export const MODE = import.meta.env.MODE;

function normalizeBaseUrl(value: string): string {
  if (!value || value === "/") return "/";
  return value.endsWith("/") ? value : `${value}/`;
}

function inferClassicBaseUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.endsWith("/v2/") ? normalized.slice(0, -3) : normalized;
}

export const BASE_URL = normalizeBaseUrl(import.meta.env.BASE_URL || "/");
export const FORCE_NAV_V2 = import.meta.env.VITE_FORCE_NAV_V2 === "true";
export const IS_DESKTOP_RUNTIME = import.meta.env.VITE_DESKTOP_RUNTIME === "true";
export const CLASSIC_BASE_URL = normalizeBaseUrl(
  (import.meta.env.VITE_CLASSIC_BASE_URL as string | undefined) || inferClassicBaseUrl(BASE_URL),
);

// Supabase
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Sentry
export const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// Spotify
export const SPOTIFY_CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string) || "";

// Google OAuth (public Web Client ID — must match Supabase dashboard config)
// Security: no hardcoded fallback — set VITE_GOOGLE_WEB_CLIENT_ID in .env
export const GOOGLE_WEB_CLIENT_ID = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string) || "";
export const ENABLE_FACEBOOK_AUTH = import.meta.env.VITE_ENABLE_FACEBOOK_AUTH !== "false";
export const ENABLE_TELEGRAM_AUTH = import.meta.env.VITE_ENABLE_TELEGRAM_AUTH !== "false";

// AdMob — IDs must come from environment variables, no hardcoded production IDs
export const ADMOB_APP_ID_ANDROID =
  (import.meta.env.VITE_ADMOB_APP_ID_ANDROID as string) || "";
export const ADMOB_REWARDED_ID_ANDROID =
  (import.meta.env.VITE_ADMOB_REWARDED_ID_ANDROID as string) || "";
export const ADMOB_BANNER_ID_ANDROID =
  (import.meta.env.VITE_ADMOB_BANNER_ID_ANDROID as string) || "";
export const ADMOB_REWARDED_ID_IOS = (import.meta.env.VITE_ADMOB_REWARDED_ID_IOS as string) || "";
export const ADMOB_BANNER_ID_IOS = (import.meta.env.VITE_ADMOB_BANNER_ID_IOS as string) || "";
