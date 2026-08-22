// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const IOS_INFO_PLIST = resolve(process.cwd(), "ios/App/App/Info.plist");
const IOS_PROJECT = resolve(process.cwd(), "ios/App/App.xcodeproj/project.pbxproj");
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
  it("keeps Google Mobile Ads application metadata absent while advertising is OFF", () => {
    const plist = readFileSync(IOS_INFO_PLIST, "utf8");
    const appId = extractPlistString(plist, "GADApplicationIdentifier");

    expect(appId).toBeUndefined();
    expect(plist).not.toContain("SKAdNetworkItems");
    expect(plist).not.toContain("ca-app-pub-");
  });

  it("keeps the legacy AdMob release-injection phase absent while advertising is OFF", () => {
    const project = readFileSync(IOS_PROJECT, "utf8");

    expect(project).not.toContain("Verify Release AdMob App ID");
    expect(project).not.toContain("ZENFLOW_ADMOB_IOS_APP_ID");
    expect(project).not.toContain("ca-app-pub-");
  });
});
