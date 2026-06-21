import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  hasOAuthCallbackParams,
  isCompletedInteractiveAuthState,
  parseInteractiveAuthConfig,
  sanitizeInteractiveAuthState,
} = require("../smoke-interactive-auth-completion.cjs") as {
  hasOAuthCallbackParams?: (url: string) => boolean;
  isCompletedInteractiveAuthState?: (state: {
    appHost: string;
    currentHost: string;
    authScreenVisible: boolean;
    googleAuthChecked: boolean;
    hasSupabaseSession: boolean;
    hasOAuthParams: boolean;
  }) => boolean;
  parseInteractiveAuthConfig?: (input?: { argv?: string[]; env?: NodeJS.ProcessEnv }) => {
    provider: string;
    appUrl: string;
    timeoutMs: number;
    headless: boolean;
  };
  sanitizeInteractiveAuthState?: (state: Record<string, unknown>) => Record<string, unknown>;
};

describe("interactive auth completion smoke helpers", () => {
  it("parses provider, URL, timeout, and headed mode without requiring secrets", () => {
    expect(typeof parseInteractiveAuthConfig).toBe("function");

    const config = parseInteractiveAuthConfig?.({
      argv: ["--provider=telegram", "--timeout-ms=120000"],
      env: {
        ZENFLOW_INTERACTIVE_AUTH_URL: "https://yehor212.github.io/people-first-app/",
        ZENFLOW_INTERACTIVE_AUTH_HEADLESS: "false",
      },
    });

    expect(config).toMatchObject({
      provider: "telegram",
      appUrl: "https://yehor212.github.io/people-first-app/",
      timeoutMs: 120000,
      headless: false,
    });
  });

  it("detects OAuth callback params in query and hash URLs", () => {
    expect(typeof hasOAuthCallbackParams).toBe("function");

    expect(
      hasOAuthCallbackParams?.("https://yehor212.github.io/people-first-app/?code=abc&state=xyz")
    ).toBe(true);
    expect(
      hasOAuthCallbackParams?.(
        "https://yehor212.github.io/people-first-app/#access_token=abc&refresh_token=def"
      )
    ).toBe(true);
    expect(hasOAuthCallbackParams?.("https://yehor212.github.io/people-first-app/orb/")).toBe(
      false
    );
  });

  it("requires app return, session marker, cleared OAuth params, and hidden auth screen", () => {
    expect(typeof isCompletedInteractiveAuthState).toBe("function");

    expect(
      isCompletedInteractiveAuthState?.({
        appHost: "yehor212.github.io",
        currentHost: "yehor212.github.io",
        authScreenVisible: false,
        googleAuthChecked: true,
        hasSupabaseSession: true,
        hasOAuthParams: false,
      })
    ).toBe(true);

    expect(
      isCompletedInteractiveAuthState?.({
        appHost: "yehor212.github.io",
        currentHost: "oauth.telegram.org",
        authScreenVisible: false,
        googleAuthChecked: true,
        hasSupabaseSession: true,
        hasOAuthParams: false,
      })
    ).toBe(false);
  });

  it("prints concise CLI validation errors without stack traces", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/smoke-interactive-auth-completion.cjs", "--provider=bad"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Set --provider to one of google, facebook, telegram, apple");
    expect(result.stderr).not.toContain("at parseInteractiveAuthConfig");
  });

  it("redacts storage keys and never exposes token-bearing values in reports", () => {
    expect(typeof sanitizeInteractiveAuthState).toBe("function");

    expect(
      sanitizeInteractiveAuthState?.({
        provider: "telegram",
        finalUrl:
          "https://yehor212.github.io/people-first-app/orb/?nav=v2&code=secret-code#access_token=secret-token&refresh_token=secret-refresh",
        supabaseSessionKeys: ["sb-fixture-auth-token"],
        sampleStoredValue: "eyJhbGciOi.secret.payload",
      })
    ).toEqual({
      provider: "telegram",
      finalUrl: "https://yehor212.github.io/people-first-app/orb/?nav=v2",
      supabaseSessionKeyCount: 1,
    });
  });
});
