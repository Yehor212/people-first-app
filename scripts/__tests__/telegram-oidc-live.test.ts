import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const script = "scripts/check-telegram-oidc-live.cjs";
const require = createRequire(import.meta.url);
const {
  checkTelegramOidcLive,
  inspectDiscovery,
  inspectJwks,
} = require("../check-telegram-oidc-live.cjs") as {
  checkTelegramOidcLive?: (input?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  }) => Promise<{ status: string; message: string; exitCode: number; failures?: string[] }>;
  inspectDiscovery?: (discovery: Record<string, unknown>, expectedBaseUrl?: string) => string[];
  inspectJwks?: (jwks: Record<string, unknown>) => string[];
};

function runLiveCheck(env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ZENFLOW_TELEGRAM_OIDC_LIVE_REQUIRED: "",
      ZENFLOW_TELEGRAM_OIDC_LIVE_OFFLINE: "",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("check-telegram-oidc-live", () => {
  it("reports UNVERIFIED without failing when offline mode is requested", () => {
    const result = runLiveCheck({ ZENFLOW_TELEGRAM_OIDC_LIVE_OFFLINE: "true" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[telegram-oidc-live] UNVERIFIED");
  });

  it("exits non-zero in required mode when offline mode is requested", () => {
    const result = runLiveCheck({
      ZENFLOW_TELEGRAM_OIDC_LIVE_OFFLINE: "true",
      ZENFLOW_TELEGRAM_OIDC_LIVE_REQUIRED: "true",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[telegram-oidc-live] UNVERIFIED");
  });

  it("requires Telegram issuer metadata and the project JWKS URL", () => {
    expect(typeof inspectDiscovery).toBe("function");

    const failures = inspectDiscovery?.({
      issuer: "https://example.invalid",
      authorization_endpoint: "https://oauth.telegram.org/auth",
      token_endpoint: "https://oauth.telegram.org/token",
      jwks_uri: "https://oauth.telegram.org/.well-known/jwks.json",
      response_types_supported: ["token"],
      code_challenge_methods_supported: [],
      token_endpoint_auth_methods_supported: ["none"],
    });

    expect(failures).toContain("Discovery issuer is not https://oauth.telegram.org");
    expect(failures).toContain(
      "Discovery JWKS URI is not https://api.zenflowapp.online/functions/v1/telegram-oidc/jwks",
    );
    expect(failures).toContain("Discovery does not advertise authorization code flow");
    expect(failures).toContain("Discovery does not advertise PKCE S256");
    expect(failures).toContain("Discovery does not advertise client_secret_basic");
  });

  it("rejects Telegram JWKS keys that hosted Supabase Auth cannot decode", () => {
    expect(typeof inspectJwks).toBe("function");

    const failures = inspectJwks?.({
      keys: [
        { kid: "supported", alg: "RS256" },
        { kid: "unsupported-alg", alg: "ES256K" },
        { kid: "unsupported-crv", alg: "ES256", crv: "secp256k1" },
      ],
    });

    expect(failures).toContain("JWKS contains unsupported Telegram key: unsupported-alg");
    expect(failures).toContain("JWKS contains unsupported Telegram key: unsupported-crv");
  });

  it("passes with valid discovery and filtered JWKS responses", async () => {
    expect(typeof checkTelegramOidcLive).toBe("function");
    const requests: string[] = [];

    const result = await checkTelegramOidcLive?.({
      env: {
        ZENFLOW_TELEGRAM_OIDC_LIVE_URL:
          "https://api.zenflowapp.online/functions/v1/telegram-oidc",
      },
      fetchImpl: (async (url: URL | RequestInfo) => {
        requests.push(String(url));
        if (String(url).endsWith("/.well-known/openid-configuration")) {
          return new Response(JSON.stringify({
            issuer: "https://oauth.telegram.org",
            authorization_endpoint: "https://oauth.telegram.org/auth",
            token_endpoint: "https://oauth.telegram.org/token",
            jwks_uri: "https://api.zenflowapp.online/functions/v1/telegram-oidc/jwks",
            response_types_supported: ["code"],
            code_challenge_methods_supported: ["S256"],
            token_endpoint_auth_methods_supported: ["client_secret_basic"],
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          keys: [
            { kid: "rsa", alg: "RS256" },
            { kid: "p256", alg: "ES256", crv: "P-256" },
            { kid: "eddsa", alg: "EdDSA", crv: "Ed25519" },
          ],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(requests).toEqual([
      "https://api.zenflowapp.online/functions/v1/telegram-oidc/.well-known/openid-configuration",
      "https://api.zenflowapp.online/functions/v1/telegram-oidc/jwks",
    ]);
  });
});
