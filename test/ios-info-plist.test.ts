// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const IOS_INFO_PLIST = resolve(process.cwd(), "ios/App/App/Info.plist");
const IOS_PROJECT = resolve(process.cwd(), "ios/App/App.xcodeproj/project.pbxproj");
const IOS_SPM_RESOLVED = resolve(
  process.cwd(),
  "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved",
);
const ADMOB_APP_OR_UNIT_ID = /ca-app-pub-\d{16}[~/]\d+/;

describe("iOS native Info.plist", () => {
  it("keeps the authoritative ADS_OFF plist free of AdMob identifiers and attribution config", () => {
    const plist = readFileSync(IOS_INFO_PLIST, "utf8");

    expect(plist).not.toContain("GADApplicationIdentifier");
    expect(plist).not.toContain("ZENFLOW_ADMOB_IOS_APP_ID");
    expect(plist).not.toContain("SKAdNetworkItems");
    expect(plist).not.toMatch(ADMOB_APP_OR_UNIT_ID);
  });

  it("keeps the ADS_OFF iOS project and package graph free of AdMob and UMP wiring", () => {
    const project = readFileSync(IOS_PROJECT, "utf8");
    const resolvedPackages = readFileSync(IOS_SPM_RESOLVED, "utf8");

    expect(project).not.toContain("Verify Release AdMob App ID");
    expect(project).not.toContain("ZENFLOW_ADMOB_IOS_APP_ID");
    expect(project).not.toMatch(ADMOB_APP_OR_UNIT_ID);
    expect(resolvedPackages).not.toMatch(/GoogleMobileAds|UserMessagingPlatform/i);
    expect(resolvedPackages).not.toContain("swift-package-manager-google-user-messaging-platform");
  });
});
