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

  it("writes each customization immediately and does not time-limit undo", () => {
    const source = readAppearance();

    expect(source).toContain("setThemeCustomization({ ...themeCustomization, ...patch })");
    expect(source).toContain("undoThemeCustomization()");
    expect(source).toContain('data-testid="settings-v2-appearance-feedback-rail"');
    expect(source).toContain('data-slot="settings-appearance-feedback-dismiss"');
    expect(source).not.toContain("setTimeout(() => setFeedback(null)");
    expect(source).not.toContain("[overflow-wrap:anywhere]");
    expect(source).not.toMatch(/draft|handlePreview|handleApply|previewThemeCustomization/);
  });

  it("keeps every Appearance interaction at least 48px tall", () => {
    const source = readAppearance();

    expect(source).toContain('className="flex h-12 w-12 items-center justify-center');
    expect(source).toContain('className="flex min-h-[48px] w-full');
    expect(source).toContain('className="settings-v2-range-control h-12 w-full');
    expect(source).not.toMatch(/\b(?:h|min-h)-11\b/);
  });

  it("keeps the customization wrapper structural inside the containing Appearance surface", () => {
    const source = readAppearance();

    expect(source).toContain('data-slot="settings-appearance-customization"');
    expect(source).not.toContain(
      '<SettingsInset testId="settings-v2-style-customization"'
    );
  });
});
