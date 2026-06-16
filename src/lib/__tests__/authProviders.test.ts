import { describe, expect, it } from "vitest";
import {
  buildOAuthCredentials,
  getEnabledAuthScreenProviders,
  isTrustedOAuthRedirectUrl,
} from "@/lib/authProviders";
import { SUPABASE_URL } from "@/lib/env";

describe("auth provider config", () => {
  it("exposes Google, Facebook, and Telegram on the entry auth screen", () => {
    expect(getEnabledAuthScreenProviders().map((provider) => provider.id)).toEqual([
      "google",
      "facebook",
      "telegram",
    ]);
  });

  it("builds Facebook OAuth credentials with public profile and email scope", () => {
    const credentials = buildOAuthCredentials("facebook", {
      redirectTo: "com.zenflow.app://login-callback",
      skipBrowserRedirect: true,
    });

    expect(credentials.provider).toBe("facebook");
    expect(credentials.options).toMatchObject({
      redirectTo: "com.zenflow.app://login-callback",
      scopes: "email,public_profile",
      skipBrowserRedirect: true,
    });
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
      expect(isTrustedOAuthRedirectUrl(`${SUPABASE_URL}/auth/v1/authorize`, "telegram")).toBe(
        true,
      );
    }
    expect(isTrustedOAuthRedirectUrl("https://www.facebook.com/v19.0/dialog/oauth", "facebook"))
      .toBe(true);
    expect(isTrustedOAuthRedirectUrl("https://oauth.telegram.org/auth", "telegram")).toBe(true);
  });

  it("rejects unknown, spoofed, and non-HTTPS redirect URLs", () => {
    expect(isTrustedOAuthRedirectUrl("https://evil-facebook.com/oauth", "facebook")).toBe(false);
    expect(isTrustedOAuthRedirectUrl("https://telegram.org.evil.example/auth", "telegram")).toBe(
      false,
    );
    expect(
      isTrustedOAuthRedirectUrl("https://other-project.supabase.co/auth/v1/authorize", "telegram"),
    ).toBe(false);
    expect(isTrustedOAuthRedirectUrl("http://oauth.telegram.org/auth", "telegram")).toBe(false);
    expect(isTrustedOAuthRedirectUrl("javascript:alert(1)", "telegram")).toBe(false);
  });
});
