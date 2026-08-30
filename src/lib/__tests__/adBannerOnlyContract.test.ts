import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { AD_UNIT_IDS } from "../adConfig";

const root = process.cwd();

describe("production advertising is Android banner-only", () => {
  it("does not expose rewarded units or exact Google test-unit fallbacks from adConfig", () => {
    const config = readFileSync(resolve(root, "src/lib/adConfig.ts"), "utf8");

    expect(Object.keys(AD_UNIT_IDS.android)).toEqual(["banner"]);
    expect(Object.keys(AD_UNIT_IDS.ios)).toEqual(["banner"]);
    expect(config).not.toContain("GOOGLE_ADMOB_TEST_IDS");
    expect(config).not.toContain("ca-app-pub-3940256099942544/6300978111");
    expect(config).not.toContain("ca-app-pub-3940256099942544/2934735716");
  });

  it("does not retain rewarded loading or showing code in the production controller", () => {
    const controller = readFileSync(resolve(root, "src/lib/adController.ts"), "utf8");
    const context = readFileSync(resolve(root, "src/contexts/AdContext.tsx"), "utf8");

    expect(controller).not.toMatch(/prepareReward|showReward|RewardedAd|rewardedReady/);
    expect(context).not.toMatch(/watchRewarded|canShowRewarded|rewardTreats|rewardXp/);
  });

  it("does not retain unreachable rewarded or ad-counter storage keys in production", () => {
    const storageKeys = readFileSync(resolve(root, "src/lib/storageKeys.ts"), "utf8");

    expect(storageKeys).not.toMatch(/AD_DAILY_REWARDED|AD_SESSION_COUNT|AD_LAST_SHOWN|AD_LAST_DISMISS/);
  });

  it("bundles the native AdMob bridge instead of leaving a bare runtime import in WebView", () => {
    const controller = readFileSync(resolve(root, "src/lib/adController.ts"), "utf8");

    expect(controller).toMatch(/from ["']@capacitor-community\/admob["'];/);
    expect(controller).toContain("AdMob,");
    expect(controller).not.toContain("@vite-ignore");
    expect(controller).not.toContain("const moduleName = '@capacitor-community/admob'");
  });
});
