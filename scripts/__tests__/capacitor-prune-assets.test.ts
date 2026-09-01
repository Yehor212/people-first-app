import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/capacitor-prune-assets.cjs";

describe("capacitor-prune-assets", () => {
  it("removes browser-PWA-only metadata and install assets from native bundles", () => {
    const script = readFileSync(scriptPath, "utf8");

    for (const artifact of [
      "manifest.webmanifest",
      "offline.html",
      "pwa-maskable-1024.png",
      "pwa-windows-44.png",
      "pwa-windows-50.png",
      "pwa-windows-71.png",
      "pwa-windows-150.png",
      "pwa-windows-310.png",
      "pwa-windows-wide-310x150.png",
      "pwa-windows-splash-620x300.png",
    ]) {
      expect(script).toContain(`"${artifact}",`);
    }

    expect(script).not.toContain('"pwa-192.png",');
  });

  it("covers generated iOS Cordova plugin duplicate artifacts", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("IOS_CORDOVA_PLUGINS");
    expect(script).toContain("ios-cordova-plugins");
    expect(script).toContain("pruneMacDuplicateArtifacts(IOS_CORDOVA_PLUGINS, \"ios-cordova-plugins\")");
    expect(script).toContain("pruneMacDuplicateArtifacts(IOS_CORDOVA_PLUGINS, `ios-cordova-plugins-late-${pass}`)");
  });
});
