// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const IOS_INFO_PLIST = resolve(process.cwd(), "ios/App/App/Info.plist");
const IOS_PROJECT = resolve(process.cwd(), "ios/App/App.xcodeproj/project.pbxproj");
const ANDROID_ADMOB_SAMPLE_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const IOS_ADMOB_SAMPLE_APP_ID = "ca-app-pub-3940256099942544~1458002511";
const IOS_ADMOB_BUILD_SETTING = "$(ZENFLOW_ADMOB_IOS_APP_ID)";

function extractPlistString(plist: string, key: string): string | undefined {
  const keyTag = `<key>${key}</key>`;
  const keyIndex = plist.indexOf(keyTag);
  if (keyIndex < 0) return undefined;

  const afterKey = plist.slice(keyIndex + keyTag.length);
  const openTag = "<string>";
  const closeTag = "</string>";
  const openIndex = afterKey.indexOf(openTag);
  const closeIndex = openIndex >= 0 ? afterKey.indexOf(closeTag, openIndex + openTag.length) : -1;
  if (openIndex < 0 || closeIndex < 0) return undefined;

  return afterKey.slice(openIndex + openTag.length, closeIndex).trim();
}

describe("iOS native Info.plist", () => {
  it("declares a valid Google Mobile Ads application id", () => {
    const plist = readFileSync(IOS_INFO_PLIST, "utf8");
    const appId = extractPlistString(plist, "GADApplicationIdentifier");

    expect(appId, "Info.plist must include GADApplicationIdentifier").toBeDefined();
    expect(appId).toBe(IOS_ADMOB_BUILD_SETTING);
    expect(appId).not.toBe(ANDROID_ADMOB_SAMPLE_APP_ID);
    expect(appId).not.toBe(IOS_ADMOB_SAMPLE_APP_ID);
  });

  it("fails Release builds that do not inject a non-sample iOS AdMob id", () => {
    const project = readFileSync(IOS_PROJECT, "utf8");

    expect(project).toContain("Verify Release AdMob App ID");
    expect(project).toContain("ZENFLOW_ADMOB_IOS_APP_ID must be injected for Release builds");
    expect(project).toContain(ANDROID_ADMOB_SAMPLE_APP_ID);
    expect(project).toContain(IOS_ADMOB_SAMPLE_APP_ID);
  });
});
