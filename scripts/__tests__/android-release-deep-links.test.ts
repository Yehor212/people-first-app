import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const intentFilters = Array.from(
  manifest.matchAll(/<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/g),
  (match) => match[0],
);

const hasDataRoute = (filter: string, scheme: string, host: string) =>
  new RegExp(`android:scheme="${scheme}"[\\s\\S]*android:host="${host}"`).test(filter);

describe("Android release deep-link contract", () => {
  it("does not claim the unverified HTTPS challenge App Link", () => {
    const httpsChallengeFilters = intentFilters.filter(
      (filter) =>
        hasDataRoute(filter, "https", "zenflow\\.app") &&
        filter.includes('android:pathPrefix="/challenge"'),
    );

    expect(httpsChallengeFilters).toEqual([]);
  });

  it.each([
    ["com.zenflow.app", "login-callback"],
    ["zenflow", "challenge"],
    ["zenflow", "diary"],
  ])("preserves the %s://%s custom-scheme route", (scheme, host) => {
    const matchingFilter = intentFilters.find((filter) => hasDataRoute(filter, scheme, host));

    expect(matchingFilter).toContain('android:name="android.intent.action.VIEW"');
    expect(matchingFilter).toContain('android:name="android.intent.category.BROWSABLE"');
  });
});
