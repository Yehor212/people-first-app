import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("production AdMob no-mockdata contract", () => {
  it("keeps production ad configuration banner-only and free of Google sample IDs", () => {
    const adConfig = read("src/lib/adConfig.ts");
    const adController = read("src/lib/adController.ts");
    const androidBuild = read("android/app/build.gradle");

    for (const productionSource of [adConfig, adController, androidBuild]) {
      expect(productionSource).not.toContain("3940256099942544");
      expect(productionSource).not.toContain("GOOGLE_ADMOB_TEST_IDS");
    }

    expect(adConfig).toContain("getBannerAdUnitId");
    expect(adConfig).not.toContain("getRewardedAdUnitId");
    expect(adController).toContain("initializeForTesting: false");
    expect(adController).toContain("!IS_DEV");
    expect(adController).toContain("showHabitsBanner");
    expect(adController).not.toContain("showRewardedAd");
  });

  it("fails closed when the real Android AdMob application ID is absent", () => {
    const androidBuild = read("android/app/build.gradle");

    expect(androidBuild).not.toMatch(/VITE_ADMOB_APP_ID_ANDROID[\s\S]*\?:\s*["']ca-app-pub-/);
    expect(androidBuild).toContain("Release builds require ZENFLOW_ADMOB_ANDROID_APP_ID");
    expect(androidBuild).toContain("throw new GradleException");
  });

  it("removes rewarded production surfaces instead of leaving an unreachable fallback", () => {
    expect(existsSync("src/components/ads/RewardedAdPrompt.tsx")).toBe(false);

    const adContext = read("src/contexts/AdContext.tsx");
    expect(adContext).toContain("setHabitsBannerActive");
    expect(adContext).not.toContain("rewardedVideo");
    expect(adContext).not.toContain("showRewardedAd");
  });

  it("hides the native banner behind global drawers and sensitive overlays", () => {
    const navigation = read("src/components/navigation-v2/NavV2Orchestrator.tsx");

    expect(navigation).toContain("setGlobalAdOverlayOpen");
    expect(navigation).toContain("commandPaletteOpen");
    expect(navigation).toContain("showMindfulMoment");
    expect(navigation).toContain("focusIsRunning");
  });

  it("keeps every shipped privacy policy aligned with the adaptive Habits banner", () => {
    for (const path of [
      "docs/privacy-policy.html",
      "public/privacy-policy.html",
      "public/privacy.html",
    ]) {
      const policy = read(path);
      expect(policy, path).toMatch(/adaptive banner/i);
      expect(policy, path).not.toMatch(/rewarded ads|rewarded video/i);
    }
  });
});
