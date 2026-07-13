import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Settings legacy concept removal", () => {
  it("does not ship a Dopamine/ADHD/high-feedback Settings surface or runtime API", () => {
    const activeSources = [
      "src/App.tsx",
      "src/lib/animationUtils.ts",
      "src/lib/haptics.ts",
      "src/hooks/useShouldAnimate.ts",
      "src/pages/nav-v2/settings/V2SettingsAppearancePanel.tsx",
      "src/pages/nav-v2/settings/V2SettingsSoundPanel.tsx",
      "src/components/Celebrations.tsx",
      "src/components/StreakBanner.tsx",
      "src/components/XpPopup.tsx",
      "src/contexts/EmotionThemeContext.tsx",
      "src/components/state-of-mind/ValenceOrb.tsx",
    ].map(read).join("\n");

    expect(activeSources).not.toMatch(/dopamin|\badhd\b|high feedback/i);
    expect(activeSources).not.toMatch(
      /useDopamineSettings|dopamine-settings-change|DOPAMINE_SETTINGS/,
    );
  });

  it("keeps only direct, purpose-named motion and haptics controls", () => {
    const appearance = read("src/pages/nav-v2/settings/V2SettingsAppearancePanel.tsx");
    const sound = read("src/pages/nav-v2/settings/V2SettingsSoundPanel.tsx");

    expect(appearance).toContain("useMotionPreference");
    expect(appearance).toContain("trySetReduceMotion");
    expect(sound).toContain("useHapticsPreference");
    expect(sound).toContain("trySetHapticsEnabled");
    expect(sound).toContain("settingsVibration");
  });

  it("does not leave the retired modal, hook, or legacy panel in the source tree", () => {
    for (const removedPath of [
      "src/components/DopamineSettings.tsx",
      "src/hooks/useDopamineSettings.ts",
      "src/lib/dopamineSettings.ts",
      "src/components/SettingsPanel.tsx",
      "src/lib/adhdHooks.ts",
      "src/hooks/useADHDHooks.ts",
      "src/lib/quickActions.ts",
      "src/hooks/useQuickActions.ts",
      "src/hooks/useCloudSyncEffects.ts",
      "src/components/settings/NotificationsSection.tsx",
      "src/components/settings/AboutSection.tsx",
      "src/components/settings/PrivacySection.tsx",
      "src/components/settings/ProfileSection.tsx",
      "src/components/settings/SecuritySection.tsx",
      "src/components/settings/WhatsNewBanner.tsx",
      "src/components/settings/data-section/DataSection.tsx",
    ]) {
      expect(() => read(removedPath), removedPath).toThrow();
    }
  });
});
