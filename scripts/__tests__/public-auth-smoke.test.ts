import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildOAuthErrorCallbackUrl,
  clickProvider,
  detectProviderRedirectError,
  hasOAuthCallbackParams,
  isAppDiagnosticUrl,
  isRetryableAppLoadFailure,
  parseCsv,
  parsePublicAuthUrls,
  providerRedirectHosts,
  validateOAuthErrorCallbackState,
  resolvePublicAuthUrls,
} = require("../smoke-public-auth-providers.cjs");

describe("public auth smoke URL parsing", () => {
  it("defaults to the canonical public root URL", () => {
    expect(parsePublicAuthUrls(undefined).map((url: URL) => url.toString())).toEqual([
      "https://yehor212.github.io/people-first-app/",
    ]);
  });

  it("treats an explicit empty forbidden-provider list as no forbidden providers", () => {
    expect(parseCsv("", ["facebook", "apple"], { emptyMeansEmpty: true })).toEqual([]);
    expect(parseCsv(undefined, ["facebook", "apple"], { emptyMeansEmpty: true })).toEqual([
      "facebook",
      "apple",
    ]);
  });
  it("keeps multiple canonical URLs in order and drops URL hashes", () => {
    expect(
      parsePublicAuthUrls(
        [
          "https://yehor212.github.io/people-first-app/#ignored",
          "https://yehor212.github.io/people-first-app/orb/?nav=v2&navLayout=phone#ignored",
        ].join(",")
      ).map((url: URL) => url.toString())
    ).toEqual([
      "https://yehor212.github.io/people-first-app/",
      "https://yehor212.github.io/people-first-app/orb/?nav=v2&navLayout=phone",
    ]);
  });

  it("counts diagnostics from the app host but ignores external provider page noise", () => {
    const appHost = "127.0.0.1:4173";

    expect(
      isAppDiagnosticUrl(
        "http://127.0.0.1:4173/people-first-app/assets/index.js",
        "http://127.0.0.1:4173/people-first-app/",
        appHost
      )
    ).toBe(true);
    expect(
      isAppDiagnosticUrl(
        "https://static.xx.fbcdn.net/rsrc.php/v4/yx/r/example.js",
        "https://www.facebook.com/login.php",
        appHost
      )
    ).toBe(false);
    expect(isAppDiagnosticUrl("", "https://www.facebook.com/login.php", appHost)).toBe(false);
    expect(isAppDiagnosticUrl("", "http://127.0.0.1:4173/people-first-app/", appHost)).toBe(true);
    expect(isAppDiagnosticUrl("", "http://127.0.0.1:4173/people-first-app/", appHost, true)).toBe(
      false
    );
  });

  it("builds additional route URLs from the deployed page URL", () => {
    expect(
      resolvePublicAuthUrls({
        baseUrl: "https://yehor212.github.io/people-first-app/",
        additionalPaths: "orb/?nav=v2&navLayout=phone",
      }).map((url: URL) => url.toString())
    ).toEqual([
      "https://yehor212.github.io/people-first-app/",
      "https://yehor212.github.io/people-first-app/orb/?nav=v2&navLayout=phone",
    ]);
  });

  it("trusts the hosted Supabase custom auth domain during provider redirects", () => {
    expect(typeof providerRedirectHosts).toBe("function");

    expect(providerRedirectHosts("telegram")).toEqual(
      expect.arrayContaining(["oauth.telegram.org", "api.zenflowapp.online"])
    );
    expect(providerRedirectHosts("google")).toEqual(
      expect.arrayContaining(["accounts.google.com", "api.zenflowapp.online"])
    );
  });

  it("detects Facebook invalid email scope pages after a valid external redirect", () => {
    expect(
      detectProviderRedirectError({
        provider: "facebook",
        currentHost: "www.facebook.com",
        externalText:
          "Этот контент сейчас недоступен Invalid Scopes: email. This message is only shown to developers.",
      })
    ).toEqual({
      reason: "facebook_invalid_scope_email",
      providerError:
        "Facebook rejected the email permission. Configure email in Meta Use Cases > Authentication and Account Creation.",
    });
  });

  it("builds an OAuth error callback probe URL from the deployed route", () => {
    expect(typeof buildOAuthErrorCallbackUrl).toBe("function");
    expect(typeof hasOAuthCallbackParams).toBe("function");

    const probeUrl = buildOAuthErrorCallbackUrl(
      new URL("https://yehor212.github.io/people-first-app/orb/?nav=v2&navLayout=phone#ignored"),
      "unit"
    );

    expect(probeUrl.toString()).toContain("/people-first-app/orb/?");
    expect(probeUrl.searchParams.get("nav")).toBe("v2");
    expect(probeUrl.searchParams.get("navLayout")).toBe("phone");
    expect(probeUrl.searchParams.get("error")).toBe("access_denied");
    expect(probeUrl.searchParams.get("error_description")).toBe("access_denied");
    expect(probeUrl.searchParams.get("state")).toBe("public-auth-smoke-unit");
    expect(probeUrl.hash).toBe("");
    expect(hasOAuthCallbackParams(probeUrl.toString())).toBe(true);
    expect(hasOAuthCallbackParams("https://yehor212.github.io/people-first-app/orb/?nav=v2")).toBe(
      false
    );
  });

  it("validates OAuth error callback cleanup state", () => {
    expect(typeof validateOAuthErrorCallbackState).toBe("function");

    expect(
      validateOAuthErrorCallbackState(
        {
          finalUrl: "https://yehor212.github.io/people-first-app/orb/?nav=v2&navLayout=phone",
          authScreenVisible: true,
          alertText: "access_denied",
          providers: ["google", "facebook", "telegram"],
          buttons: [
            { provider: "google", disabled: false },
            { provider: "facebook", disabled: false },
            { provider: "telegram", disabled: false },
          ],
        },
        ["google", "facebook", "telegram"],
        ["apple"]
      )
    ).toMatchObject({
      ok: true,
      missingExpected: [],
      forbiddenVisible: [],
      disabledExpected: [],
      hasOAuthParams: false,
    });

    expect(
      validateOAuthErrorCallbackState(
        {
          finalUrl: "https://yehor212.github.io/people-first-app/orb/?nav=v2&error=access_denied",
          authScreenVisible: true,
          alertText: "access_denied",
          providers: ["google", "telegram", "apple"],
          buttons: [
            { provider: "google", disabled: false },
            { provider: "telegram", disabled: true },
            { provider: "apple", disabled: false },
          ],
        },
        ["google", "facebook", "telegram"],
        ["apple"]
      )
    ).toMatchObject({
      ok: false,
      missingExpected: ["facebook"],
      forbiddenVisible: ["apple"],
      disabledExpected: ["telegram"],
      hasOAuthParams: true,
    });
  });

  it("treats post-deploy app asset 503s as retryable smoke infrastructure", () => {
    expect(typeof isRetryableAppLoadFailure).toBe("function");

    expect(
      isRetryableAppLoadFailure(
        {
          ok: false,
          reason: "redirect_check_failed",
          currentUrl: "https://yehor212.github.io/people-first-app/orb/?nav=v2&navLayout=phone",
          consoleMessages: [
            "error: Failed to load resource: the server responded with a status of 503 ()",
          ],
          failedRequests: [
            "GET https://yehor212.github.io/people-first-app/assets/react-dom-4P3QW5sd.js net::ERR_ABORTED",
          ],
        },
        "yehor212.github.io"
      )
    ).toBe(true);

    expect(
      isRetryableAppLoadFailure(
        {
          ok: false,
          reason: "facebook_invalid_scope_email",
          providerError: "Facebook rejected the email permission.",
          currentUrl: "https://www.facebook.com/login.php",
          consoleMessages: [],
          failedRequests: [],
        },
        "yehor212.github.io"
      )
    ).toBe(false);
  });
  it("clicks the provider button ancestor instead of the inner content span", async () => {
    expect(typeof clickProvider).toBe("function");
    const clicks: string[] = [];
    const ancestorLocator = {
      count: async () => 1,
      click: async () => clicks.push("ancestor"),
    };
    const contentLocator = {
      locator: (selector: string) => {
        expect(selector).toContain("ancestor::");
        return ancestorLocator;
      },
      click: async () => clicks.push("content"),
    };
    const page = {
      getByTestId: (testId: string) => {
        expect(testId).toBe("auth-provider-content-google");
        return contentLocator;
      },
    };

    await clickProvider(page, "google", 123);

    expect(clicks).toEqual(["ancestor"]);
  });
});
