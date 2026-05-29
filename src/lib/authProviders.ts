import type { Provider } from "@supabase/supabase-js";
import { ENABLE_FACEBOOK_AUTH, ENABLE_TELEGRAM_AUTH, SUPABASE_URL } from "@/lib/env";

export type SocialAuthProviderId = "google" | "facebook" | "telegram" | "apple";

export interface SocialAuthProviderConfig {
  id: SocialAuthProviderId;
  supabaseProvider: Provider;
  labelKey: string;
  loadingLabelKey: string;
  nameKey: string;
  fallbackLabel: string;
  fallbackLoadingLabel: string;
  fallbackName: string;
  enabled: boolean;
  scopes?: string;
  queryParams?: Record<string, string>;
  trustedDomains: readonly string[];
}

export interface OAuthCredentialOptions {
  redirectTo: string;
  skipBrowserRedirect?: boolean;
}

export const AUTH_PROVIDER_CONFIGS: Record<SocialAuthProviderId, SocialAuthProviderConfig> = {
  google: {
    id: "google",
    supabaseProvider: "google",
    labelKey: "continueWithGoogle",
    loadingLabelKey: "authSigningInGoogle",
    nameKey: "authProviderGoogle",
    fallbackLabel: "Continue with Google",
    fallbackLoadingLabel: "Signing in with Google...",
    fallbackName: "Google",
    enabled: true,
    queryParams: { prompt: "select_account" },
    trustedDomains: ["accounts.google.com", "google.com"],
  },
  facebook: {
    id: "facebook",
    supabaseProvider: "facebook",
    labelKey: "continueWithFacebook",
    loadingLabelKey: "authSigningInFacebook",
    nameKey: "authProviderFacebook",
    fallbackLabel: "Continue with Facebook",
    fallbackLoadingLabel: "Signing in with Facebook...",
    fallbackName: "Facebook",
    enabled: ENABLE_FACEBOOK_AUTH,
    scopes: "email,public_profile",
    trustedDomains: ["facebook.com"],
  },
  telegram: {
    id: "telegram",
    supabaseProvider: "custom:telegram",
    labelKey: "continueWithTelegram",
    loadingLabelKey: "authSigningInTelegram",
    nameKey: "authProviderTelegram",
    fallbackLabel: "Continue with Telegram",
    fallbackLoadingLabel: "Signing in with Telegram...",
    fallbackName: "Telegram",
    enabled: ENABLE_TELEGRAM_AUTH,
    scopes: "openid profile",
    trustedDomains: ["oauth.telegram.org", "telegram.org"],
  },
  apple: {
    id: "apple",
    supabaseProvider: "apple",
    labelKey: "continueWithApple",
    loadingLabelKey: "authSigningIn",
    nameKey: "authProviderApple",
    fallbackLabel: "Continue with Apple",
    fallbackLoadingLabel: "Signing in...",
    fallbackName: "Apple",
    enabled: false,
    scopes: "name email",
    trustedDomains: ["appleid.apple.com"],
  },
};

export const AUTH_SCREEN_PROVIDER_IDS: readonly SocialAuthProviderId[] = [
  "google",
  "facebook",
  "telegram",
];

export const ACCOUNT_AUTH_PROVIDER_IDS: readonly SocialAuthProviderId[] = [
  "google",
  "facebook",
  "telegram",
];

export function getAuthProviderConfig(id: SocialAuthProviderId): SocialAuthProviderConfig {
  return AUTH_PROVIDER_CONFIGS[id];
}

export function getEnabledAuthScreenProviders(): SocialAuthProviderConfig[] {
  return AUTH_SCREEN_PROVIDER_IDS.map(getAuthProviderConfig).filter((provider) => provider.enabled);
}

export function getEnabledAccountAuthProviders(): SocialAuthProviderConfig[] {
  return ACCOUNT_AUTH_PROVIDER_IDS.map(getAuthProviderConfig).filter((provider) => provider.enabled);
}

export function buildOAuthCredentials(
  providerId: SocialAuthProviderId,
  { redirectTo, skipBrowserRedirect }: OAuthCredentialOptions,
) {
  const provider = getAuthProviderConfig(providerId);
  return {
    provider: provider.supabaseProvider,
    options: {
      redirectTo,
      ...(provider.scopes ? { scopes: provider.scopes } : {}),
      ...(provider.queryParams ? { queryParams: provider.queryParams } : {}),
      ...(skipBrowserRedirect ? { skipBrowserRedirect } : {}),
    },
  };
}

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  const normalizedDomain = domain.replace(/^\./, "").toLowerCase();
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

function getConfiguredSupabaseHostname(): string | null {
  if (!SUPABASE_URL) return null;

  try {
    return new URL(SUPABASE_URL).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isTrustedOAuthRedirectUrl(
  rawUrl: string,
  providerId?: SocialAuthProviderId,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const providerDomains = providerId
    ? getAuthProviderConfig(providerId).trustedDomains
    : Object.values(AUTH_PROVIDER_CONFIGS).flatMap((provider) => provider.trustedDomains);
  const configuredSupabaseHostname = getConfiguredSupabaseHostname();
  const normalizedHostname = parsed.hostname.toLowerCase();
  const matchesConfiguredSupabase =
    !!configuredSupabaseHostname && normalizedHostname === configuredSupabaseHostname;

  return (
    matchesConfiguredSupabase ||
    providerDomains.some((domain) => hostnameMatchesDomain(parsed.hostname, domain))
  );
}
