import { Capacitor } from "@capacitor/core";

const NATIVE_REDIRECT_URL = "com.zenflow.app://login-callback";

export const getAuthRedirectUrl = () => {
  if (Capacitor.isNativePlatform()) {
    return NATIVE_REDIRECT_URL;
  }
  return `${window.location.origin}${import.meta.env.BASE_URL || "/"}`;
};

export const isNativePlatform = () => Capacitor.isNativePlatform();

export const handleAuthCallback = async (supabaseClient: any, url: string) => {
  if (!supabaseClient || !url) return;
  const parsed = new URL(url);
  const searchParams = new URLSearchParams(parsed.search);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));

  const errorDescription = searchParams.get("error_description") || hashParams.get("error_description");
  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const code = searchParams.get("code") || hashParams.get("code");
  if (code) {
    await supabaseClient.auth.exchangeCodeForSession(code);
    return;
  }

  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (accessToken && refreshToken) {
    await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }
};
