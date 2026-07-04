#!/usr/bin/env node
"use strict";

const DEFAULT_PACKAGE_NAME = "com.zenflow.app";
const DEFAULT_DEVELOPER_WEBSITE = "https://yehor212.github.io/people-first-app/";
const DEFAULT_PRIVACY_POLICY_URL = "https://yehor212.github.io/people-first-app/privacy.html";
const DEFAULT_LOCALE = "en_US";
const OLD_NO_ADS_CLAIM = "No ads. No selling your data. Ever.";

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ");
}

function evaluateGooglePlayListingHtml({
  html,
  expectedDeveloperWebsite = DEFAULT_DEVELOPER_WEBSITE,
  expectedPrivacyPolicyUrl = DEFAULT_PRIVACY_POLICY_URL,
  requiredRewardedAdsText = true,
  requireContainsAds = true,
}) {
  const body = normalizeText(html);
  const issues = [];
  const signals = {
    developerWebsiteVisible: body.includes(expectedDeveloperWebsite),
    privacyPolicyVisible: body.includes(expectedPrivacyPolicyUrl),
    oldNoAdsClaimVisible: body.includes(OLD_NO_ADS_CLAIM),
    rewardedAdsVisible: /optional rewarded ads|rewarded ads/i.test(body),
    containsAdsVisible: /Contains ads/i.test(body),
  };

  if (!signals.developerWebsiteVisible) {
    issues.push({ code: "developer_website_missing", message: "Public listing must expose " + expectedDeveloperWebsite });
  }
  if (!signals.privacyPolicyVisible) {
    issues.push({ code: "privacy_policy_missing", message: "Public listing must expose " + expectedPrivacyPolicyUrl });
  }
  if (signals.oldNoAdsClaimVisible) {
    issues.push({ code: "old_no_ads_claim_visible", message: "Public listing must not expose the old no-ads claim" });
  }
  if (requiredRewardedAdsText && !signals.rewardedAdsVisible) {
    issues.push({ code: "rewarded_ads_copy_missing", message: "Public listing must disclose optional rewarded ads copy" });
  }
  if (requireContainsAds && !signals.containsAdsVisible) {
    issues.push({ code: "contains_ads_missing", message: "Public listing must show the Google Play Contains ads signal" });
  }

  return { ok: issues.length === 0, issues, signals };
}

function listingUrl({ packageName, locale }) {
  const url = new URL("https://play.google.com/store/apps/details");
  url.searchParams.set("id", packageName);
  url.searchParams.set("hl", locale);
  url.searchParams.set("cacheBust", String(Date.now()));
  return url.toString();
}

async function main() {
  const packageName = process.env.ZENFLOW_GOOGLE_PLAY_PACKAGE || DEFAULT_PACKAGE_NAME;
  const locale = process.env.ZENFLOW_GOOGLE_PLAY_LOCALE || DEFAULT_LOCALE;
  const expectedDeveloperWebsite = process.env.ZENFLOW_PLAY_DEVELOPER_WEBSITE || DEFAULT_DEVELOPER_WEBSITE;
  const expectedPrivacyPolicyUrl = process.env.ZENFLOW_PLAY_PRIVACY_POLICY_URL || DEFAULT_PRIVACY_POLICY_URL;
  const url = process.env.ZENFLOW_GOOGLE_PLAY_LISTING_URL || listingUrl({ packageName, locale });

  const response = await fetch(url, { redirect: "follow" });
  const html = await response.text();
  const report = evaluateGooglePlayListingHtml({ html, expectedDeveloperWebsite, expectedPrivacyPolicyUrl });

  if (response.status < 200 || response.status >= 300) {
    report.issues.unshift({ code: "http_status", message: "Google Play listing returned HTTP " + response.status });
    report.ok = false;
  }

  console.log("[google-play-public] " + (report.ok ? "PASS" : "UNVERIFIED") + " - " + packageName + " " + response.status);
  console.log("[google-play-public] developerWebsite=" + (report.signals.developerWebsiteVisible ? "present" : "missing"));
  console.log("[google-play-public] privacyPolicy=" + (report.signals.privacyPolicyVisible ? "present" : "missing"));
  console.log("[google-play-public] containsAds=" + (report.signals.containsAdsVisible ? "present" : "missing"));
  console.log("[google-play-public] rewardedAdsCopy=" + (report.signals.rewardedAdsVisible ? "present" : "missing"));
  console.log("[google-play-public] oldNoAdsClaim=" + (report.signals.oldNoAdsClaimVisible ? "visible" : "absent"));
  for (const issue of report.issues) {
    console.log("[google-play-public] issue=" + issue.code + " - " + issue.message);
  }
  process.exit(report.ok ? 0 : 2);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[google-play-public] ERROR - " + (error.message || error));
    process.exit(2);
  });
}

module.exports = {
  DEFAULT_DEVELOPER_WEBSITE,
  DEFAULT_PACKAGE_NAME,
  DEFAULT_PRIVACY_POLICY_URL,
  OLD_NO_ADS_CLAIM,
  evaluateGooglePlayListingHtml,
};
