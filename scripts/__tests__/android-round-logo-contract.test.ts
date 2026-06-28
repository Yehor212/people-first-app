import { readFileSync } from "node:fs";
import sharp from "sharp";
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
    expect(checker).toContain("minCircleScale");
    expect(checker).toContain("maxCircleScale");
    expect(checker).toContain("minLeafScale");
    expect(checker).toContain("maxLeafScale");
  });

  it("renders legacy Android round launcher PNGs as physical circles with transparent corners", async () => {
    const densities = [
      ["mipmap-mdpi", 48],
      ["mipmap-hdpi", 72],
      ["mipmap-xhdpi", 96],
      ["mipmap-xxhdpi", 144],
      ["mipmap-xxxhdpi", 192],
    ] as const;

    for (const [folder, size] of densities) {
      const roundIcon = await sharp(`android/app/src/main/res/${folder}/ic_launcher_round.png`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const { data, info } = roundIcon;
      const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];

      expect(info.width, folder).toBe(size);
      expect(info.height, folder).toBe(size);
      expect(alphaAt(0, 0), `${folder} top-left corner`).toBeLessThanOrEqual(8);
      expect(alphaAt(info.width - 1, 0), `${folder} top-right corner`).toBeLessThanOrEqual(8);
      expect(alphaAt(0, info.height - 1), `${folder} bottom-left corner`).toBeLessThanOrEqual(8);
      expect(alphaAt(info.width - 1, info.height - 1), `${folder} bottom-right corner`).toBeLessThanOrEqual(8);
      expect(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2)), `${folder} center`).toBeGreaterThanOrEqual(248);
    }
  });
});
