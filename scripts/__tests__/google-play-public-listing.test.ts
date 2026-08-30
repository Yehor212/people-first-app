import { readFileSync } from "node:fs";
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
  it("keeps every release-packet locale banner-only", () => {
    const packet = JSON.parse(
      readFileSync("docs/release/google-play/GOOGLE_PLAY_LOCALIZED_LISTING_PACKET.json", "utf8"),
    ) as {
      releasePolicy: { adModel: string };
      locales: Record<string, { fullDescription: string; featureBullets: string[]; whatsNew: string }>;
    };
    const staleRewardedCopy =
      /rewarded|reward|винагород|recompensad|belohn|récompens|リワード|بمكافأة|מתוגמל/i;

    expect(packet.releasePolicy.adModel).toMatch(/banner/i);
    expect(JSON.stringify(packet)).not.toMatch(staleRewardedCopy);
    for (const [locale, listing] of Object.entries(packet.locales)) {
      expect.soft(listing.fullDescription, `${locale}.fullDescription`).not.toMatch(staleRewardedCopy);
      expect.soft(listing.featureBullets.join(" "), `${locale}.featureBullets`).not.toMatch(
        staleRewardedCopy,
      );
      expect.soft(listing.whatsNew, `${locale}.whatsNew`).not.toMatch(staleRewardedCopy);
    }
  });

  it("passes when developer website, privacy policy, Contains ads, and banner copy are public", () => {
    const report = checker.evaluateGooglePlayListingHtml({
      html:
        "Developer website " +
        checker.DEFAULT_DEVELOPER_WEBSITE +
        " Privacy Policy " +
        checker.DEFAULT_PRIVACY_POLICY_URL +
        " Contains ads ZenFlow may show an optional habit list banner.",
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
      html: checker.DEFAULT_DEVELOPER_WEBSITE + " Contains ads ZenFlow may show an optional habit list banner.",
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
        " Contains ads ZenFlow may show an optional habit list banner.",
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
      html: checker.DEFAULT_DEVELOPER_WEBSITE + " " + checker.DEFAULT_PRIVACY_POLICY_URL + " optional habit list banner",
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "contains_ads_missing" }));
  });

  it("rejects stale rewarded-only listing copy for a banner-only release", () => {
    const report = checker.evaluateGooglePlayListingHtml({
      html:
        checker.DEFAULT_DEVELOPER_WEBSITE +
        " " +
        checker.DEFAULT_PRIVACY_POLICY_URL +
        " Contains ads ZenFlow may offer optional rewarded ads.",
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "banner_ads_copy_missing" }));
  });
});
