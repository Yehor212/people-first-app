import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { motionPresets } from "@/lib/animationUtils";

const pageSource = readFileSync(
  "src/pages/nav-v2/settings/components/SettingsPageComponents.tsx",
  "utf8"
);
const motionSource = readFileSync(
  "src/pages/nav-v2/settings/components/SettingsMotionSurface.tsx",
  "utf8"
);
const appearanceSource = readFileSync(
  "src/pages/nav-v2/settings/V2SettingsAppearanceBasics.tsx",
  "utf8"
);
const settingsPageSource = readFileSync("src/pages/nav-v2/SettingsPage.tsx", "utf8");

describe("Settings mobile transition contract", () => {
  it("lets the outgoing surface visibly finish before mounting the next readable layer", () => {
    expect(pageSource).toContain("AnimatePresence");
    expect(pageSource).toContain('mode="wait"');
    expect(pageSource).toContain("SettingsMotionSurface");
    expect(motionSource).toContain("useIsPresent");
    expect(motionSource).toContain("forwardRef");
    expect(motionSource).toContain("ref={ref}");
    expect(motionSource).toContain('inert={!isPresent ? "" : undefined}');
    expect(motionSource).toContain('!isPresent && "pointer-events-none"');
    expect(motionSource).not.toContain('!isPresent && "invisible');
    expect(motionSource).toContain("initial={shouldAnimate ? { opacity: 0.92 } : false}");
    expect(motionSource).toContain("exit={shouldAnimate ? { opacity: 0.35 }");
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
    expect(motionSource).toContain("initial={shouldAnimate ? { opacity: 0.92 } : false}");
    expect(motionPresets.fadeIn.initial).toEqual({ opacity: 0 });
    expect(motionPresets.fadeIn.animate).toEqual({ opacity: 1 });
    expect(motionPresets.fadeIn.initial).not.toHaveProperty("x");
    expect(motionPresets.fadeIn.animate).not.toHaveProperty("x");
  });

  it("keeps the Settings route visible at mount and full-scale through settle and exit", () => {
    expect(settingsPageSource).toMatch(/<Bloom\s+key="settings-page"\s+initial=\{false\}/);
    expect(settingsPageSource).not.toContain(
      "initial={{ opacity: 0, scale: 1, y: 8 }}",
    );
    expect(settingsPageSource).toContain("animate={{ opacity: 1, scale: 1, y: 0 }}");
    expect(settingsPageSource).toContain("exit={{ opacity: 0, scale: 1, y: 8 }}");
  });
});
