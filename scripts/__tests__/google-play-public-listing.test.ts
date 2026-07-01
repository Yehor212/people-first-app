import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const checker = require("../check-google-play-public-listing.cjs") as {
  evaluateGooglePlayListingHtml: (input: {
    html: string;
    expectedDeveloperWebsite?: string;
    requiredRewardedAdsText?: boolean;
    requireContainsAds?: boolean;
  }) => {
    ok: boolean;
    issues: Array<{ code: string; message: string }>;
    signals: Record<string, boolean>;
  };
  DEFAULT_DEVELOPER_WEBSITE: string;
};

describe("Google Play public listing guard", () => {
  it("passes when developer website, Contains ads, and rewarded copy are public", () => {
    const report = checker.evaluateGooglePlayListingHtml({
      html: "Developer website " + checker.DEFAULT_DEVELOPER_WEBSITE + " Contains ads ZenFlow may offer optional rewarded ads.",
    });

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.signals.developerWebsiteVisible).toBe(true);
    expect(report.signals.containsAdsVisible).toBe(true);
    expect(report.signals.rewardedAdsVisible).toBe(true);
  });

  it("rejects the stale no-ads claim even when the website is present", () => {
    const report = checker.evaluateGooglePlayListingHtml({
      html: checker.DEFAULT_DEVELOPER_WEBSITE + " Contains ads No ads. No selling your data. Ever.",
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "old_no_ads_claim_visible" }));
  });

  it("rejects missing public ads disclosure", () => {
    const report = checker.evaluateGooglePlayListingHtml({
      html: checker.DEFAULT_DEVELOPER_WEBSITE + " optional rewarded ads",
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "contains_ads_missing" }));
  });
});
