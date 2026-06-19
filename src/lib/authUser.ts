import type { User } from "@supabase/supabase-js";
import type { SocialAuthProviderId } from "@/lib/authProviders";

const DISPLAY_NAME_KEYS = [
  "full_name",
  "name",
  "display_name",
  "preferred_username",
  "user_name",
  "username",
] as const;

function metadataString(
  metadata: Record<string, unknown> | undefined,
  keys: readonly string[],
): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isAppleAuthUser(user: User): boolean {
  const provider = typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : null;
  if (normalizeAuthProviderId(provider) === "apple") return true;
  return (user.identities ?? []).some((identity) => normalizeAuthProviderId(identity.provider) === "apple");
}

export function getAuthUserDisplayName(user: User | null | undefined, fallback = "Friend"): string {
  if (!user) return fallback;
  const metadataName = metadataString(user.user_metadata, DISPLAY_NAME_KEYS);
  if (metadataName) return metadataName;
  if (isAppleAuthUser(user)) return fallback;
  return user.email || user.phone || fallback;
}

export function getAuthUserAccountLabel(user: User | null | undefined): string | null {
  if (!user) return null;
  const username = metadataString(user.user_metadata, ["preferred_username", "user_name", "username"]);
  if (user.email) return user.email;
  if (user.phone) return user.phone;
  if (username) return username.startsWith("@") ? username : `@${username}`;
  return getAuthUserDisplayName(user, `user:${user.id.slice(0, 8)}`);
}

export function normalizeAuthProviderId(provider: string | null | undefined): SocialAuthProviderId | null {
  if (!provider) return null;
  if (provider === "custom:telegram" || provider.toLowerCase().includes("telegram")) return "telegram";
  if (provider === "google" || provider === "facebook" || provider === "apple") return provider;
  return null;
}

export function getLinkedAuthProviderIds(user: User | null | undefined): SocialAuthProviderId[] {
  if (!user) return [];
  const providers = new Set<SocialAuthProviderId>();
  const primaryProvider = normalizeAuthProviderId(
    typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : null,
  );
  if (primaryProvider) providers.add(primaryProvider);

  for (const identity of user.identities ?? []) {
    const normalized = normalizeAuthProviderId(identity.provider);
    if (normalized) providers.add(normalized);
  }

  return Array.from(providers);
}
