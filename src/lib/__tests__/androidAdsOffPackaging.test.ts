import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(__dirname, "../../..");
const readSource = (relativePath: string) =>
  readFileSync(resolve(repositoryRoot, relativePath), "utf8");

describe("Android ads-off native packaging contract", () => {
  it("keeps the ADR-undecided runtime from packaging the AdMob native surface", () => {
    const capacitorConfig = readSource("capacitor.config.ts");
    const appGradle = readSource("android/app/build.gradle");
    const manifest = readSource("android/app/src/main/AndroidManifest.xml");

    expect(capacitorConfig).toContain("areAdsRuntimeEnabled");
    expect(capacitorConfig).toContain("includePlugins");
    expect(capacitorConfig).not.toContain("@capacitor-community/admob");
    expect(appGradle).not.toContain("ZENFLOW_ADMOB_ANDROID_APP_ID");
    expect(appGradle).not.toContain("VITE_ADMOB_APP_ID_ANDROID");
    expect(appGradle).not.toContain("adMobApplicationId");
    expect(manifest).not.toContain("com.google.android.gms.ads.APPLICATION_ID");
    expect(manifest).toContain('android:name="com.google.android.gms.permission.AD_ID"');
    expect(manifest).toContain('tools:node="remove"');
  });
});
