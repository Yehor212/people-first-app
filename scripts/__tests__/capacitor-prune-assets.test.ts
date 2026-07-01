import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/capacitor-prune-assets.cjs";

describe("capacitor-prune-assets", () => {
  it("covers generated iOS Cordova plugin duplicate artifacts", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("IOS_CORDOVA_PLUGINS");
    expect(script).toContain("ios-cordova-plugins");
    expect(script).toContain("pruneMacDuplicateArtifacts(IOS_CORDOVA_PLUGINS, \"ios-cordova-plugins\")");
    expect(script).toContain("pruneMacDuplicateArtifacts(IOS_CORDOVA_PLUGINS, `ios-cordova-plugins-late-${pass}`)");
  });
});
