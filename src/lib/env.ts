/**
 * Centralized environment configuration (TD-22)
 * Single source of truth for all import.meta.env access
 */

// Vite built-ins
export const IS_DEV = import.meta.env.DEV;
export const MODE = import.meta.env.MODE;
export const BASE_URL = import.meta.env.BASE_URL || "/";

// Supabase
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as
  | string
  | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

// Sentry
export const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// Spotify
export const SPOTIFY_CLIENT_ID =
  (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string) || "";

// Google OAuth (public Web Client ID — must match Supabase dashboard config)
export const GOOGLE_WEB_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string) ||
  "830119095963-krjibmbag0tuastn4sk0sf58m1c4v4qa.apps.googleusercontent.com";

// AdMob
export const ADMOB_REWARDED_ID_ANDROID =
  (import.meta.env.VITE_ADMOB_REWARDED_ID_ANDROID as string) ||
  "ca-app-pub-9501460293702808/3235100902";
export const ADMOB_BANNER_ID_ANDROID =
  (import.meta.env.VITE_ADMOB_BANNER_ID_ANDROID as string) ||
  "ca-app-pub-3940256099942544/6300978111";
export const ADMOB_REWARDED_ID_IOS =
  (import.meta.env.VITE_ADMOB_REWARDED_ID_IOS as string) ||
  "ca-app-pub-3940256099942544/1712485313";
export const ADMOB_BANNER_ID_IOS =
  (import.meta.env.VITE_ADMOB_BANNER_ID_IOS as string) ||
  "ca-app-pub-3940256099942544/2934735716";
