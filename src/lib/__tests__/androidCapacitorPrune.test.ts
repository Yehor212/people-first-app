import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Android Capacitor native asset pruning", () => {
  it("cleans duplicate native artifacts again after Android Capacitor sync", () => {
    const scripts = JSON.parse(readSource("package.json")).scripts as Record<string, string>;

    expect(scripts["cap:sync:android"]).toContain("npx cap sync android &&");
    expect(scripts["cap:sync:android"]).toContain(
      "cross-env CAPACITOR_BUILD=true node scripts/capacitor-prune-assets.cjs"
    );
  });

  it("targets Android resource, web asset, app build, and Cordova plugin duplicates", () => {
    const source = readSource("scripts/capacitor-prune-assets.cjs");

    expect(source).toContain("const ANDROID_PUBLIC");
    expect(source).toContain("const ANDROID_RES");
    expect(source).toContain("const ANDROID_APP_BUILD");
    expect(source).toContain("const ANDROID_CORDOVA_PLUGINS");
    expect(source).toContain("pruneMacDuplicateArtifacts");
    expect(source).toContain("/ \\d+(?=\\.|$)/");
    expect(source).toContain('pruneMacDuplicateArtifacts(ANDROID_PUBLIC, "android-public")');
    expect(source).toContain('pruneMacDuplicateArtifacts(ANDROID_RES, "android-res")');
    expect(source).toContain('pruneMacDuplicateArtifacts(ANDROID_APP_BUILD, "android-app-build")');
    expect(source).toContain('pruneMacDuplicateArtifacts(ANDROID_CORDOVA_PLUGINS, "android-cordova-plugins")');
  });
});
