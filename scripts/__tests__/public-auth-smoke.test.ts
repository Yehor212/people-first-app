import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  isAppDiagnosticUrl,
  parsePublicAuthUrls,
  resolvePublicAuthUrls,
} = require("../smoke-public-auth-providers.cjs");

describe("public auth smoke URL parsing", () => {
  it("defaults to the canonical public root URL", () => {
    expect(parsePublicAuthUrls(undefined).map((url: URL) => url.toString())).toEqual([
      "https://yehor212.github.io/people-first-app/",
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
});
