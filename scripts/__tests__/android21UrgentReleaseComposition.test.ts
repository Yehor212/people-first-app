import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (relativePath: string) =>
  readFileSync(resolve(root, relativePath), "utf8");

describe("Android 2.1 urgent release composition", () => {
  it("binds the Play identity to API 36 and version 2.1.0 (35)", () => {
    const packageJson = JSON.parse(read("package.json"));
    const packageLock = JSON.parse(read("package-lock.json"));
    const variables = read("android/variables.gradle");
    const appGradle = read("android/app/build.gradle");

    expect(packageJson.version).toBe("2.1.0");
    expect(packageLock.version).toBe("2.1.0");
    expect(packageLock.packages[""].version).toBe("2.1.0");
    expect(variables).toMatch(/compileSdkVersion\s*=\s*36/);
    expect(variables).toMatch(/targetSdkVersion\s*=\s*36/);
    expect(appGradle).toMatch(/versionCode\s+35/);
    expect(appGradle).toMatch(/versionName\s+"2\.1\.0"/);
  });

  it("keeps the urgent production candidate compile-time Ads-OFF", () => {
    const packageJson = read("package.json");
    const capacitorConfig = read("capacitor.config.ts");
    const appGradle = read("android/app/build.gradle");
    const manifest = read("android/app/src/main/AndroidManifest.xml");

    expect(packageJson).not.toContain("@capacitor-community/admob");
    expect(capacitorConfig).not.toContain("@capacitor-community/admob");
    expect(appGradle).not.toContain("ZENFLOW_ADMOB_ANDROID_APP_ID");
    expect(manifest).not.toContain("com.google.android.gms.ads.APPLICATION_ID");
    expect(manifest).toContain('android:name="com.google.android.gms.permission.AD_ID"');
    expect(manifest).toContain('tools:node="remove"');
  });
});
