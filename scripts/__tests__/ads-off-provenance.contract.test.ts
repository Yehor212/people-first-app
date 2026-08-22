import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const sampleId = /ca-app-pub-3940256099942544(?:[~/]\d+)?/g;
const forbiddenNativeSurface = /@capacitor-community\/admob|user-messaging-platform|google_mobile_ads|google\.android\.ump/gi;
const forbiddenGmaSurface = /com\.google\.android\.gms\.ads\.(?!identifier\b)/gi;
const forbiddenRewardPath = /onEarnTreats|onEarnXp|AD_REWARDS|earnTreats\("ad"|rewardedVideoTreats|rewardedVideoXp/;

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function artifactFiles(relativePath: string): string[] {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) return [];
  if (statSync(absolutePath).isFile()) return [absolutePath];
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) =>
    artifactFiles(`${relativePath}/${entry.name}`),
  );
}

function artifactText(relativePath: string): string {
  return artifactFiles(relativePath)
    .map((file) => {
      if (/\.(apk|aab)$/i.test(file)) {
        return execFileSync("unzip", ["-p", file], { maxBuffer: 128 * 1024 * 1024 }).toString("latin1");
      }
      return readFileSync(file).toString("latin1");
    })
    .join("\n");
}

describe("T222-R ADS_OFF provenance contract", () => {
  it("keeps production source fail-closed with no sample ID or active Android AdMob configuration", () => {
    const productionSource = [
      "src/lib/adConfig.ts",
      "capacitor.config.ts",
      "android/app/build.gradle",
      "android/app/capacitor.build.gradle",
      "android/app/src/main/AndroidManifest.xml",
      "android/capacitor.settings.gradle",
      "src/contexts/AdContext.tsx",
      "src/pages/Index.tsx",
      "package.json",
      "package-lock.json",
    ].map(read).join("\n");
    const reachableRuntimeSource = [
      "src/contexts/AdContext.tsx",
      "src/pages/Index.tsx",
    ].map(read).join("\n");

    expect(productionSource).not.toMatch(sampleId);
    expect(productionSource).not.toMatch(forbiddenNativeSurface);
    expect(productionSource).not.toMatch(forbiddenGmaSurface);
    expect(productionSource).not.toContain("@capacitor-community/admob");
    expect(reachableRuntimeSource).not.toMatch(forbiddenRewardPath);
    expect(read("src/lib/adConfig.ts")).not.toMatch(/IS_DEV\s*\?\s*test/i);
  });

  it("requires normal Vite, Capacitor, release APK, AAB, and generated manifest artifacts to be clean", () => {
    const requiredArtifacts = [
      "dist",
      "android/app/src/main/assets/public",
      "android/app/build/outputs/apk/release/app-release-unsigned.apk",
      "android/app/build/outputs/bundle/release/app-release.aab",
      "android/app/build/intermediates/merged_manifests/release",
    ];
    for (const artifact of requiredArtifacts) {
      expect(existsSync(resolve(root, artifact)), artifact).toBe(true);
      const contents = artifactText(artifact);
      expect(contents, artifact).not.toMatch(sampleId);
      expect(contents, artifact).not.toMatch(forbiddenNativeSurface);
      expect(contents, artifact).not.toMatch(forbiddenGmaSurface);
    }

    const capacitorPlugins = read("android/app/src/main/assets/capacitor.plugins.json");
    expect(capacitorPlugins).not.toMatch(forbiddenNativeSurface);
    expect(capacitorPlugins).not.toMatch(forbiddenGmaSurface);
  });
});
