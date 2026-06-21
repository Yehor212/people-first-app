import { describe, expect, it } from "vitest";
import {
  buildOAuthCredentials,
  getEnabledAccountAuthProviders,
  getEnabledAuthScreenProviders,
  isTrustedOAuthRedirectUrl,
} from "@/lib/authProviders";
import { SUPABASE_URL } from "@/lib/env";

describe("auth provider config", () => {
  it("keeps unavailable public providers hidden by default until hosted access is ready", () => {
    expect(getEnabledAuthScreenProviders().map((provider) => provider.id)).toEqual([
      "google",
      "telegram",
    ]);
  });

  it("keeps Apple hidden on entry auth surfaces until hosted Apple auth is ready", () => {
    expect(
      getEnabledAuthScreenProviders({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
        platform: "iPhone",
        maxTouchPoints: 5,
      }).map((provider) => provider.id)
    ).toEqual(["google", "telegram"]);

    expect(
      getEnabledAuthScreenProviders({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }).map((provider) => provider.id)
    ).toEqual(["google", "telegram"]);
  });

  it("shows Apple on entry auth surfaces when hosted Apple auth is ready", () => {
    expect(
      getEnabledAuthScreenProviders({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        platform: "Win32",
        maxTouchPoints: 0,
        applePublicAccessReady: true,
      }).map((provider) => provider.id)
    ).toEqual(["google", "telegram", "apple"]);
  });

  it("keeps Apple hidden from account sign-in and linking until hosted Apple auth is ready", () => {
    expect(getEnabledAccountAuthProviders().map((provider) => provider.id)).toEqual([
      "google",
      "telegram",
    ]);

    expect(
      getEnabledAccountAuthProviders({ applePublicAccessReady: true }).map(
        (provider) => provider.id
      )
    ).toEqual(["google", "telegram", "apple"]);
  });

  it("keeps Facebook hidden from public auth surfaces until Meta public access is ready", () => {
    expect(
      getEnabledAuthScreenProviders({ facebookPublicAccessReady: false }).map(
        (provider) => provider.id
      )
    ).toEqual(["google", "telegram"]);

    expect(
      getEnabledAccountAuthProviders({ facebookPublicAccessReady: false }).map(
        (provider) => provider.id
      )
    ).toEqual(["google", "telegram"]);
  });

  it("shows Facebook when the provider flag and Meta public access readiness are both enabled", () => {
    expect(
      getEnabledAuthScreenProviders({
        facebookPublicAccessReady: true,
        applePublicAccessReady: true,
      }).map((provider) => provider.id)
    ).toEqual(["google", "facebook", "telegram", "apple"]);

    expect(
      getEnabledAccountAuthProviders({
        facebookPublicAccessReady: true,
        applePublicAccessReady: true,
      }).map((provider) => provider.id)
    ).toEqual(["google", "facebook", "telegram", "apple"]);
  });

  it("builds Facebook OAuth credentials with only the public profile scope", () => {
    const credentials = buildOAuthCredentials("facebook", {
      redirectTo: "com.zenflow.app://login-callback",
      skipBrowserRedirect: true,
    });

    expect(credentials.provider).toBe("facebook");
    expect(credentials.options).toMatchObject({
      redirectTo: "com.zenflow.app://login-callback",
      scopes: "public_profile",
      skipBrowserRedirect: true,
    });
    expect(credentials.options.scopes).not.toContain("email");
  });

  it("builds Telegram as the Supabase custom OIDC provider", () => {
    const credentials = buildOAuthCredentials("telegram", {
      redirectTo: "https://zenflow.app/auth/callback",
    });

    expect(credentials.provider).toBe("custom:telegram");
    expect(credentials.options).toMatchObject({
      redirectTo: "https://zenflow.app/auth/callback",
      scopes: "openid profile",
    });
  });

  it("builds Apple OAuth credentials with name and email scope", () => {
    const credentials = buildOAuthCredentials("apple", {
      redirectTo: "com.zenflow.app://login-callback",
      skipBrowserRedirect: true,
    });

    expect(credentials.provider).toBe("apple");
    expect(credentials.options).toMatchObject({
      redirectTo: "com.zenflow.app://login-callback",
      scopes: "name email",
      skipBrowserRedirect: true,
    });
  });

  it("keeps the existing Google prompt query param unchanged", () => {
    const credentials = buildOAuthCredentials("google", {
      redirectTo: "https://zenflow.app/auth/callback",
    });

    expect(credentials.provider).toBe("google");
    expect(credentials.options?.queryParams).toEqual({ prompt: "select_account" });
  });
});

describe("isTrustedOAuthRedirectUrl", () => {
  it("accepts Supabase and expected provider domains", () => {
    if (SUPABASE_URL) {
      expect(isTrustedOAuthRedirectUrl(`${SUPABASE_URL}/auth/v1/authorize`, "telegram")).toBe(true);
    }
    expect(
      isTrustedOAuthRedirectUrl("https://www.facebook.com/v19.0/dialog/oauth", "facebook")
    ).toBe(true);
    expect(isTrustedOAuthRedirectUrl("https://oauth.telegram.org/auth", "telegram")).toBe(true);
    expect(isTrustedOAuthRedirectUrl("https://appleid.apple.com/auth/authorize", "apple")).toBe(
      true
    );
  });

  it("rejects unknown, spoofed, and non-HTTPS redirect URLs", () => {
    expect(isTrustedOAuthRedirectUrl("https://evil-facebook.com/oauth", "facebook")).toBe(false);
    expect(isTrustedOAuthRedirectUrl("https://telegram.org.evil.example/auth", "telegram")).toBe(
      false
    );
    expect(isTrustedOAuthRedirectUrl("https://core.telegram.org/auth", "telegram")).toBe(false);
    expect(
      isTrustedOAuthRedirectUrl("https://other-project.supabase.co/auth/v1/authorize", "telegram")
    ).toBe(false);
    expect(isTrustedOAuthRedirectUrl("http://oauth.telegram.org/auth", "telegram")).toBe(false);
    expect(isTrustedOAuthRedirectUrl("javascript:alert(1)", "telegram")).toBe(false);
  });
});
