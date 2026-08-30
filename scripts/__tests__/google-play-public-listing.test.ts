import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const checker = require("../check-google-play-public-listing.cjs") as {
  evaluateGooglePlayListingHtml: (input: {
    html: string;
    expectedDeveloperWebsite?: string;
    expectedPrivacyPolicyUrl?: string;
    requiredBannerAdsText?: boolean;
    requireContainsAds?: boolean;
  }) => {
    ok: boolean;
    issues: Array<{ code: string; message: string }>;
    signals: Record<string, boolean>;
  };
  DEFAULT_DEVELOPER_WEBSITE: string;
  DEFAULT_PRIVACY_POLICY_URL: string;
};

describe("Google Play public listing guard", () => {
  it("passes when developer website, privacy policy, Contains ads, and Habits banner copy are public", () => {
    const report = checker.evaluateGooglePlayListingHtml({
      html:
        "Developer website " +
        checker.DEFAULT_DEVELOPER_WEBSITE +
        " Privacy Policy " +
        checker.DEFAULT_PRIVACY_POLICY_URL +
        " Contains ads ZenFlow may show a banner ad on the Habits screen.",
    });

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.signals.developerWebsiteVisible).toBe(true);
    expect(report.signals.privacyPolicyVisible).toBe(true);
    expect(report.signals.containsAdsVisible).toBe(true);
    expect(report.signals.bannerAdsVisible).toBe(true);
  });

  it("rejects a listing that hides the public privacy policy URL", () => {
    const report = checker.evaluateGooglePlayListingHtml({
      html: checker.DEFAULT_DEVELOPER_WEBSITE + " Contains ads ZenFlow may show a banner ad on the Habits screen.",
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "privacy_policy_missing" }));
    expect(report.signals.privacyPolicyVisible).toBe(false);
  });

  it("supports an explicit expected privacy policy URL override", () => {
    const customPrivacyUrl = "https://example.com/zenflow/privacy";
    const report = checker.evaluateGooglePlayListingHtml({
      expectedPrivacyPolicyUrl: customPrivacyUrl,
      html:
        checker.DEFAULT_DEVELOPER_WEBSITE +
        " " +
        customPrivacyUrl +
        " Contains ads ZenFlow may show a banner ad on the Habits screen.",
    });

    expect(report.ok).toBe(true);
    expect(report.signals.privacyPolicyVisible).toBe(true);
  });

  it("rejects the stale no-ads claim even when the website is present", () => {
    const report = checker.evaluateGooglePlayListingHtml({
      html:
        checker.DEFAULT_DEVELOPER_WEBSITE +
        " " +
        checker.DEFAULT_PRIVACY_POLICY_URL +
        " Contains ads No ads. No selling your data. Ever.",
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "old_no_ads_claim_visible" }));
  });

  it("rejects missing public ads disclosure", () => {
    const report = checker.evaluateGooglePlayListingHtml({
      html: checker.DEFAULT_DEVELOPER_WEBSITE + " " + checker.DEFAULT_PRIVACY_POLICY_URL + " Habits banner ad",
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "contains_ads_missing" }));
  });
});
