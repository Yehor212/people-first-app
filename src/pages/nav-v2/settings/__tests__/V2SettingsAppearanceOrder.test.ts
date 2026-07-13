import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("V2 settings Appearance hierarchy", () => {
  const readAppearance = () =>
    [
      "../V2SettingsAppearanceBasics.tsx",
      "../V2SettingsAppearanceAccent.tsx",
      "../V2SettingsAppearancePanel.tsx",
    ]
      .map((file) => readFileSync(resolve(__dirname, file), "utf8"))
      .join("\n");

  it("keeps only recognizable mode, text, accent, contrast, and motion controls", () => {
    const source = readAppearance();

    for (const testId of [
      "settings-v2-theme-mode-field",
      "settings-v2-text-size-field",
      "settings-v2-accent-field",
      "settings-v2-high-contrast-toggle",
      "settings-v2-motion-toggle",
    ]) {
      expect(source).toMatch(new RegExp(`(?:data-testid|testId)="${testId}"`));
    }
    expect(source).not.toMatch(/Mood palette|Advanced appearance|Comfort|Sparkles/);
    expect(source).not.toMatch(/settings-v2-(style-preview|style-apply|appearance-actions)/);
  });

  it("writes each customization immediately and shows only transient undo feedback", () => {
    const source = readAppearance();

    expect(source).toContain("setThemeCustomization({ ...themeCustomization, ...patch })");
    expect(source).toContain("undoThemeCustomization()");
    expect(source).toContain("window.setTimeout(() => setFeedback(null), 4_000)");
    expect(source).not.toMatch(/draft|handlePreview|handleApply|previewThemeCustomization/);
  });
});
