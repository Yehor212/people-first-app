import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Android AdMob startup and QA isolation", () => {
  it("gives debug APKs a valid Google sample application id without weakening release ids", () => {
    const gradle = read("android/app/build.gradle");
    const debugStrings = read("android/app/src/debug/res/values/admob.xml");

    expect(gradle).toContain('debug {');
    expect(gradle).toContain('adMobApplicationId: "@string/zenflow_debug_admob_application_id"');
    expect(debugStrings).toMatch(/ca-app-pub-\d{16}~\d{10}/);
    expect(gradle).toContain("Release builds require ZENFLOW_ADMOB_ANDROID_APP_ID");
  });

  it("allows test-banner configuration only in the explicit admob-qa Vite mode", () => {
    const env = read("src/lib/env.ts");
    const config = read("src/lib/adConfig.ts");
    const controller = read("src/lib/adController.ts");

    expect(env).toContain('MODE === "admob-qa"');
    expect(env).toContain("VITE_ADMOB_QA_TEST_MODE");
    expect(config).toContain("isValidQaBannerAdUnitId");
    expect(controller).toContain("IS_ADMOB_QA_TEST_MODE");
    expect(controller).not.toContain("GOOGLE_ADMOB_TEST_IDS");
  });
});
