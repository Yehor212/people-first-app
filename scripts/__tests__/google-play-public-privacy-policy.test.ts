import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const checker = require("../check-public-privacy-policy.cjs") as {
  DEFAULT_PRIVACY_POLICY_URL: string;
  evaluatePublicPrivacyPolicyHtml: (input: { html: string; requiredUrl?: string }) => {
    ok: boolean;
    issues: Array<{ code: string; message: string }>;
    signals: Record<string, boolean>;
  };
  loadPrivacyPolicyHtml: (input: { file?: string; url?: string }) => Promise<{
    html: string;
    source: string;
    status: string | number;
  }>;
};

const completePolicy = `
  ZenFlow Privacy Policy
  Optional rewarded ads after consent.
  AdMob / Google Mobile Ads.
  Google User Messaging Platform (UMP) privacy choices.
  Advertising ID and ad-services declarations.
  Google Mobile Ads SDK may collect and share IP address, user product interactions, diagnostic information, and device/account identifiers for advertising, analytics, and fraud prevention.
`;

describe("Google Play public privacy policy guard", () => {
  it("passes when the policy discloses the current Google Mobile Ads and UMP surface", () => {
    const report = checker.evaluatePublicPrivacyPolicyHtml({ html: completePolicy });

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.signals.googleMobileAdsVisible).toBe(true);
    expect(report.signals.umpVisible).toBe(true);
    expect(report.signals.advertisingIdVisible).toBe(true);
    expect(report.signals.googleMobileAdsDataVisible).toBe(true);
    expect(report.signals.rewardedAdsVisible).toBe(true);
  });

  it("rejects a policy that mentions ads but omits Google Mobile Ads SDK data disclosures", () => {
    const report = checker.evaluatePublicPrivacyPolicyHtml({
      html: "ZenFlow Privacy Policy AdMob Google Mobile Ads UMP Advertising ID optional rewarded ads",
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "google_mobile_ads_data_missing" }));
    expect(report.signals.googleMobileAdsDataVisible).toBe(false);
  });

  it("rejects the stale no-ads claim", () => {
    const report = checker.evaluatePublicPrivacyPolicyHtml({
      html: completePolicy + " No ads. No selling your data. Ever.",
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "old_no_ads_claim_visible" }));
  });

  it("restricts local artifact checks to known privacy policy files", async () => {
    await expect(checker.loadPrivacyPolicyHtml({ file: "../package.json" })).rejects.toThrow(
      /Unsupported local privacy policy file/,
    );
  });

  it("keeps the local public and docs privacy files aligned with the ads disclosure contract", () => {
    for (const file of ["public/privacy.html", "public/privacy-policy.html", "docs/privacy-policy.html"]) {
      const report = checker.evaluatePublicPrivacyPolicyHtml({ html: readFileSync(file, "utf8") });
      expect(report, file).toMatchObject({ ok: true });
    }
  });

  it("exposes a repeatable public privacy policy check command and includes this guard in release contracts", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const releaseContracts = packageJson.scripts["test:release-contracts"];

    expect(packageJson.scripts["google-play:privacy:public-check"]).toBe(
      "node scripts/check-public-privacy-policy.cjs",
    );
    expect(packageJson.scripts["google-play:privacy:artifact-check"]).toBe(
      "node scripts/check-public-privacy-policy.cjs --file output/pages-artifact.nosync/privacy.html",
    );
    expect(releaseContracts).toContain("scripts/__tests__/google-play-public-privacy-policy.test.ts");
    expect(checker.DEFAULT_PRIVACY_POLICY_URL).toBe("https://yehor212.github.io/people-first-app/privacy.html");
  });
});
