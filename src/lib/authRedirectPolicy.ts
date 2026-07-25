export const NATIVE_AUTH_REDIRECT_URL = "com.zenflow.app://login-callback";

export const ALLOWED_AUTH_REDIRECT_ORIGINS = [
  "https://yehor212.github.io",
  "capacitor://localhost",
  "https://zenflow.app",
] as const;

const LOOPBACK_OAUTH_PORTS = new Set([
  "3000",
  "4173",
  "4174",
  "4175",
  "4176",
  "5173",
  "8080",
]);
const LOOPBACK_OAUTH_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isAllowedLocalOAuthOrigin(rawOrigin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    return false;
  }

  return (
    !parsed.username &&
    !parsed.password &&
    parsed.protocol === "http:" &&
    LOOPBACK_OAUTH_HOSTS.has(parsed.hostname) &&
    LOOPBACK_OAUTH_PORTS.has(parsed.port)
  );
}

/**
 * Validates complete ZenFlow auth redirects before an attempt selector is
 * attached. This is deliberately narrower than accepting arbitrary HTTPS:
 * Supabase must only return users to the same origins configured by ZenFlow.
 */
export function isAllowedAuthRedirectUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) return false;

  if (parsed.protocol === "com.zenflow.app:") {
    return (
      parsed.hostname === "login-callback" &&
      (parsed.pathname === "" || parsed.pathname === "/")
    );
  }

  if (parsed.protocol === "capacitor:") {
    return parsed.hostname === "localhost";
  }

  return (
    (ALLOWED_AUTH_REDIRECT_ORIGINS as readonly string[]).includes(parsed.origin) ||
    isAllowedLocalOAuthOrigin(parsed.origin)
  );
}
