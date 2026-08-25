export const TELEGRAM_OIDC_ISSUER = "https://oauth.telegram.org";
export const TELEGRAM_OIDC_AUTHORIZATION_ENDPOINT = `${TELEGRAM_OIDC_ISSUER}/auth`;
export const TELEGRAM_OIDC_TOKEN_ENDPOINT = `${TELEGRAM_OIDC_ISSUER}/token`;
export const TELEGRAM_OIDC_JWKS_URI = `${TELEGRAM_OIDC_ISSUER}/.well-known/jwks.json`;
export const TELEGRAM_OIDC_PUBLIC_BASE_URL =
  "https://bwgfslmxmueyglpumkbf.supabase.co/functions/v1/telegram-oidc";

export type TelegramJwk = Record<string, unknown> & {
  alg?: string;
  crv?: string;
  kid?: string;
};

export interface TelegramJwks {
  keys: TelegramJwk[];
}

export interface TelegramOidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  response_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  scopes_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
  claims_supported: string[];
}

export interface HeaderReader {
  get(name: string): string | null;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/g, "");
}

export function buildTelegramOidcDiscovery(baseUrl: string): TelegramOidcDiscovery {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    issuer: TELEGRAM_OIDC_ISSUER,
    authorization_endpoint: TELEGRAM_OIDC_AUTHORIZATION_ENDPOINT,
    token_endpoint: TELEGRAM_OIDC_TOKEN_ENDPOINT,
    jwks_uri: `${normalizedBaseUrl}/jwks`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256", "ES256", "EdDSA"],
    scopes_supported: ["openid", "profile", "phone", "telegram:bot_access"],
    token_endpoint_auth_methods_supported: ["client_secret_basic"],
    code_challenge_methods_supported: ["S256"],
    claims_supported: [
      "sub",
      "iss",
      "iat",
      "exp",
      "id",
      "name",
      "given_name",
      "family_name",
      "preferred_username",
      "picture",
      "phone_number",
    ],
  };
}

export function buildTelegramOidcFunctionBaseUrl(requestUrl: string, headers?: HeaderReader): string {
  const url = new URL(requestUrl);
  const forwardedHost = headers?.get("x-forwarded-host");
  const hostHeader = headers?.get("host");
  const host = forwardedHost || hostHeader || url.host;
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);

  if (!localHost) return TELEGRAM_OIDC_PUBLIC_BASE_URL;

  const forwardedProto = headers?.get("x-forwarded-proto");
  const proto = forwardedProto || url.protocol.replace(/:$/g, "");

  return `${proto}://${host}/functions/v1/telegram-oidc`;
}

export function isUnsupportedTelegramJwk(jwk: TelegramJwk): boolean {
  const alg = typeof jwk.alg === "string" ? jwk.alg.toUpperCase() : "";
  const crv = typeof jwk.crv === "string" ? jwk.crv.toLowerCase() : "";

  return alg === "ES256K" || crv === "secp256k1";
}

export function filterTelegramJwks(jwks: TelegramJwks): TelegramJwks {
  return {
    keys: jwks.keys.filter((key) => !isUnsupportedTelegramJwk(key)),
  };
}

export function isTelegramJwks(value: unknown): value is TelegramJwks {
  return Boolean(value && typeof value === "object" && Array.isArray((value as TelegramJwks).keys));
}
