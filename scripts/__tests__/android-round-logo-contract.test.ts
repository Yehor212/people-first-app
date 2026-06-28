import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Android round logo contract", () => {
  it("keeps Android round/adaptive launcher wiring under the canonical brand logo checker", () => {
    const checker = readFileSync("scripts/check-brand-logo-assets.cjs", "utf8");

    expect(checker).toContain("assertAndroidLauncherIconContract");
    expect(checker).toContain("AndroidManifest.xml");
    expect(checker).toContain("android:roundIcon");
    expect(checker).toContain("@mipmap/ic_launcher_round");
    expect(checker).toContain("ic_launcher_round.png");
    expect(checker).toContain("ic_launcher_round.xml");
  });
});
