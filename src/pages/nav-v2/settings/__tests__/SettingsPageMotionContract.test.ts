import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { motionPresets } from "@/lib/animationUtils";

const pageSource = readFileSync(
  "src/pages/nav-v2/settings/components/SettingsPageComponents.tsx",
  "utf8",
);
const motionSource = readFileSync(
  "src/pages/nav-v2/settings/components/SettingsMotionSurface.tsx",
  "utf8",
);
const appearanceSource = readFileSync(
  "src/pages/nav-v2/settings/V2SettingsAppearanceBasics.tsx",
  "utf8",
);

describe("Settings mobile transition contract", () => {
  it("keeps exiting list and detail surfaces mounted, inert, and animated", () => {
    expect(pageSource).toContain("AnimatePresence");
    expect(pageSource).toContain('mode="wait"');
    expect(pageSource).toContain("SettingsMotionSurface");
    expect(motionSource).toContain("useIsPresent");
    expect(motionSource).toContain('inert={!isPresent ? "" : undefined}');
    expect(motionSource).toContain("exit=");
  });

  it("collapses spatial motion when the effective motion gate is off", () => {
    expect(pageSource).toContain("useShouldAnimate");
    expect(motionSource).toContain("motionPresets.fadeIn");
    expect(motionSource).toContain("zenMotion.exit");
    expect(motionSource).toContain("zenMotion.instant");
    expect(appearanceSource).toContain("motionPresets.scaleIn");
    expect(appearanceSource).toContain("zenMotion.instant");
    expect(motionSource).not.toContain("duration: shouldAnimate");
    expect(appearanceSource).not.toContain("duration: shouldAnimate");
  });

  it("avoids transforming large glass surfaces during the transition", () => {
    expect(motionSource).toContain("initial={false}");
    expect(motionPresets.fadeIn.initial).toEqual({ opacity: 0 });
    expect(motionPresets.fadeIn.animate).toEqual({ opacity: 1 });
    expect(motionPresets.fadeIn.initial).not.toHaveProperty("x");
    expect(motionPresets.fadeIn.animate).not.toHaveProperty("x");
  });
});
