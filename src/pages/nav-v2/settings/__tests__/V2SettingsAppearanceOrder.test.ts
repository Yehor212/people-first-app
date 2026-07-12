import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("V2 settings Appearance canvas hierarchy", () => {
  it("anchors Appearance with one icon-derived glass object before dense customization", () => {
    const source = [
      "../V2SettingsAppearanceBasics.tsx",
      "../V2SettingsAppearanceAdvanced.tsx",
      "../V2SettingsAppearancePanel.tsx",
    ]
      .map((file) => readFileSync(resolve(__dirname, file), "utf8"))
      .join("\n");

    const anchor = source.indexOf('data-testid="settings-v2-identity-anchor"');
    const mode = source.indexOf('data-testid="settings-v2-theme-mode-field"');
    const advanced = source.indexOf('data-testid="settings-v2-advanced-appearance-details"');
    const mood = source.indexOf('data-testid="settings-v2-mood-palette-field"');
    const accent = source.indexOf('data-testid="settings-v2-accent-field"');
    const actions = source.indexOf('data-testid="settings-v2-appearance-actions"');

    expect({ anchor, mode, advanced, mood, accent, actions }).toEqual({
      anchor: expect.any(Number),
      mode: expect.any(Number),
      advanced: expect.any(Number),
      mood: expect.any(Number),
      accent: expect.any(Number),
      actions: expect.any(Number),
    });
    expect(anchor, "The first viewport needs one ZenFlow glass anchor before controls").toBeGreaterThan(-1);
    expect(advanced, "Dense palette and accent controls must be behind progressive disclosure").toBeGreaterThan(-1);
    expect(anchor).toBeLessThan(mode);
    expect(mode).toBeLessThan(advanced);
    expect(advanced).toBeLessThan(mood);
    expect(mood).toBeLessThan(accent);
    expect(accent).toBeLessThan(actions);
  });

  it("keeps Apply tied to unsaved appearance changes instead of Preview state", () => {
    const source = readFileSync(
      resolve(__dirname, "../V2SettingsAppearancePanel.tsx"),
      "utf8",
    );

    expect(source).toContain("hasUnsavedAppearanceChanges");
    expect(source).toContain("disabled={!hasUnsavedAppearanceChanges}");
    expect(source).not.toContain("disabled={!previewActiveRef.current}");
  });
});
