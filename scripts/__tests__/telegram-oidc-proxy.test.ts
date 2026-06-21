import { describe, expect, it } from "vitest";

import {
  TELEGRAM_OIDC_ISSUER,
  buildTelegramOidcDiscovery,
  buildTelegramOidcFunctionBaseUrl,
  filterTelegramJwks,
} from "../../supabase/functions/telegram-oidc/telegram_oidc";

describe("Telegram OIDC compatibility proxy", () => {
  it("keeps Telegram as issuer while routing JWKS through the project proxy", () => {
    const discovery = buildTelegramOidcDiscovery("https://api.zenflowapp.online/functions/v1/telegram-oidc");

    expect(discovery.issuer).toBe(TELEGRAM_OIDC_ISSUER);
    expect(discovery.authorization_endpoint).toBe("https://oauth.telegram.org/auth");
    expect(discovery.token_endpoint).toBe("https://oauth.telegram.org/token");
    expect(discovery.jwks_uri).toBe("https://api.zenflowapp.online/functions/v1/telegram-oidc/jwks");
    expect(discovery.id_token_signing_alg_values_supported).not.toContain("ES256K");
  });

  it("builds a public Supabase Functions base URL from the Edge runtime request URL", () => {
    const baseUrl = buildTelegramOidcFunctionBaseUrl("http://api.zenflowapp.online/telegram-oidc/.well-known/openid-configuration");
    const edgeRuntimeBaseUrl = buildTelegramOidcFunctionBaseUrl("https://edge-runtime.supabase.com/telegram-oidc/.well-known/openid-configuration");

    expect(baseUrl).toBe("https://api.zenflowapp.online/functions/v1/telegram-oidc");
    expect(edgeRuntimeBaseUrl).toBe("https://api.zenflowapp.online/functions/v1/telegram-oidc");
  });

  it("removes Telegram secp256k1 keys before Supabase Auth reads the JWKS", () => {
    const filtered = filterTelegramJwks({
      keys: [
        { kid: "rsa", kty: "RSA", alg: "RS256", use: "sig", n: "fixture", e: "AQAB" },
        { kid: "p256", kty: "EC", alg: "ES256", crv: "P-256", use: "sig", x: "fixture", y: "fixture" },
        { kid: "ed25519", kty: "OKP", alg: "EdDSA", crv: "Ed25519", use: "sig", x: "fixture" },
        { kid: "k1", kty: "EC", alg: "ES256K", crv: "secp256k1", use: "sig", x: "fixture", y: "fixture" },
      ],
    });

    expect(filtered.keys).toHaveLength(3);
    expect(filtered.keys.map((key) => key.kid)).toEqual(["rsa", "p256", "ed25519"]);
    expect(filtered.keys).not.toContainEqual(expect.objectContaining({ crv: "secp256k1" }));
    expect(filtered.keys).not.toContainEqual(expect.objectContaining({ alg: "ES256K" }));
  });
});
