import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_CUSTOMIZATION,
  THEME_ACCENT_FAMILIES,
  applyThemeCustomizationToDOM,
  getThemeCustomizationRecipe,
  normalizeThemeCustomization,
} from "../themeCustomization";

function parseHslToken(token: string): [number, number, number] {
  const match = token.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) throw new Error(`Invalid HSL token: ${token}`);
  return [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100];
}

function hslToRgb([hue, saturation, lightness]: [number, number, number]): [
  number,
  number,
  number,
] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) [red, green, blue] = [chroma, second, 0];
  else if (hue < 120) [red, green, blue] = [second, chroma, 0];
  else if (hue < 180) [red, green, blue] = [0, chroma, second];
  else if (hue < 240) [red, green, blue] = [0, second, chroma];
  else if (hue < 300) [red, green, blue] = [second, 0, chroma];
  else [red, green, blue] = [chroma, 0, second];

  return [red + match, green + match, blue + match];
}

function relativeLuminance(token: string): number {
  const [red, green, blue] = hslToRgb(parseHslToken(token)).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe("themeCustomization Variant A", () => {
  beforeEach(() => {
    for (const name of [
      "themeStyle",
      "themeAccent",
      "themeIntensity",
      "themeDepth",
      "themeComfort",
      "themeTransparency",
      "themeGlow",
      "themeContrast",
    ] as const) {
      delete document.documentElement.dataset[name];
    }
  });

  afterEach(() => {
    applyThemeCustomizationToDOM("paper", DEFAULT_THEME_CUSTOMIZATION);
  });

  it("ships only four familiar accent choices", () => {
    expect(THEME_ACCENT_FAMILIES.map((option) => option.id)).toEqual([
      "green",
      "blue",
      "violet",
      "amber",
    ]);
  });

  it("normalizes corrupted persisted values to the visible default model", () => {
    expect(
      normalizeThemeCustomization({
        schemaVersion: 1,
        accentFamily: "unsafe-css",
        highContrast: "yes",
        injectedCss: "body{display:none}",
      }),
    ).toEqual(DEFAULT_THEME_CUSTOMIZATION);
  });

  it("migrates active legacy appearance fields without retaining hidden controls", () => {
    expect(
      normalizeThemeCustomization({
        paletteId: "velvetLibrary",
        accentFamily: "plum",
        intensity: "vivid",
        warmth: "warm",
        depth: "soft",
        contrastMode: "high",
        reduceGlow: true,
        reduceTransparency: false,
      }),
    ).toEqual({
      schemaVersion: 1,
      accentFamily: "violet",
      highContrast: true,
    });
  });

  it("maps legacy reduced transparency to the coherent high-contrast outcome", () => {
    expect(
      normalizeThemeCustomization({
        paletteId: "morningHearth",
        accentFamily: "clay",
        reduceTransparency: true,
      }),
    ).toEqual({
      schemaVersion: 1,
      accentFamily: "amber",
      highContrast: true,
    });
  });

  it("does not mistake a legacy amber accent for the current schema", () => {
    expect(
      normalizeThemeCustomization({
        accentFamily: "amber",
        contrastMode: "high",
        reduceTransparency: true,
      }),
    ).toEqual({
      schemaVersion: 1,
      accentFamily: "amber",
      highContrast: true,
    });
  });

  it("uses a legacy palette as a fallback accent without changing the theme mode", () => {
    expect(normalizeThemeCustomization({ paletteId: "morningHearth" }).accentFamily).toBe(
      "amber",
    );
    expect(normalizeThemeCustomization({ paletteId: "velvetLibrary" }).accentFamily).toBe(
      "violet",
    );
    expect(normalizeThemeCustomization({ paletteId: "botanicalPulse" }).accentFamily).toBe(
      "green",
    );
  });

  it("keeps an accent change isolated from surface opacity, blur, depth, and shadow", () => {
    const recipe = getThemeCustomizationRecipe("paper", {
      schemaVersion: 1,
      accentFamily: "blue",
      highContrast: false,
    });

    expect(recipe.cssVars["--settings-v2-accent"]).toBeDefined();
    expect(recipe.cssVars["--ring"]).toBe(recipe.cssVars["--settings-v2-accent"]);
    expect(recipe.cssVars["--primary"]).toBe(recipe.cssVars["--settings-v2-accent"]);
    for (const unrelatedRole of [
      "--settings-v2-shell",
      "--settings-v2-card",
      "--settings-v2-panel",
      "--settings-v2-card-alpha",
      "--settings-v2-panel-alpha",
      "--settings-v2-shell-alpha",
      "--settings-v2-glass-blur",
      "--zen-shadow-card",
      "--zen-shadow-hover",
    ]) {
      expect(recipe.cssVars[unrelatedRole], unrelatedRole).toBeUndefined();
    }
  });

  it("makes high contrast own readable text, borders, focus, and solid surfaces", () => {
    for (const appliedTheme of ["paper", "ink", "oled"] as const) {
      const recipe = getThemeCustomizationRecipe(appliedTheme, {
        schemaVersion: 1,
        accentFamily: "green",
        highContrast: true,
      });

      expect(recipe.cssVars["--settings-v2-text-strong"]).toBeTruthy();
      expect(recipe.cssVars["--settings-v2-text-muted"]).toBeTruthy();
      expect(recipe.cssVars["--settings-v2-border"]).toBeTruthy();
      expect(recipe.cssVars["--settings-v2-focus"]).toBeTruthy();
      expect(recipe.cssVars["--settings-v2-card-alpha"]).toBe("1");
      expect(recipe.cssVars["--settings-v2-glass-blur"]).toBe("0px");
      for (const surface of [
        "--settings-v2-shell",
        "--settings-v2-card",
        "--settings-v2-panel",
      ]) {
        expect(recipe.cssVars[surface], surface).toBeTruthy();
        expect(
          contrastRatio(
            recipe.cssVars["--settings-v2-text-strong"],
            recipe.cssVars[surface],
          ),
          `${appliedTheme}/${surface}`,
        ).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it("keeps every shipped primary role pair at WCAG AA contrast", () => {
    for (const appliedTheme of ["paper", "ink", "oled"] as const) {
      for (const accent of THEME_ACCENT_FAMILIES) {
        for (const highContrast of [false, true]) {
          const recipe = getThemeCustomizationRecipe(appliedTheme, {
            schemaVersion: 1,
            accentFamily: accent.id,
            highContrast,
          });
          const ratio = contrastRatio(
            recipe.cssVars["--primary"],
            recipe.cssVars["--primary-foreground"],
          );

          expect(
            ratio,
            `${appliedTheme}/${accent.id}/${highContrast ? "high" : "standard"}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("keeps the browser surface color tied to mode rather than accent", () => {
    const bluePaper = getThemeCustomizationRecipe("paper", {
      schemaVersion: 1,
      accentFamily: "blue",
      highContrast: false,
    });
    const amberPaper = getThemeCustomizationRecipe("paper", {
      schemaVersion: 1,
      accentFamily: "amber",
      highContrast: false,
    });

    expect(bluePaper.metaThemeColor).toBe(amberPaper.metaThemeColor);
    expect(getThemeCustomizationRecipe("oled", DEFAULT_THEME_CUSTOMIZATION).metaThemeColor).toBe(
      "#000000",
    );
  });

  it("emits only live data attributes and clears obsolete legacy attributes", () => {
    document.documentElement.dataset.themeStyle = "morningHearth";
    document.documentElement.dataset.themeIntensity = "vivid";
    document.documentElement.dataset.themeDepth = "soft";
    document.documentElement.dataset.themeComfort = "high-contrast";
    document.documentElement.dataset.themeTransparency = "solid";
    document.documentElement.dataset.themeGlow = "reduced";

    applyThemeCustomizationToDOM("ink", {
      schemaVersion: 1,
      accentFamily: "violet",
      highContrast: true,
    });

    expect(document.documentElement.dataset.themeAccent).toBe("violet");
    expect(document.documentElement.dataset.themeContrast).toBe("high");
    expect(document.documentElement.dataset.themeStyle).toBeUndefined();
    expect(document.documentElement.dataset.themeIntensity).toBeUndefined();
    expect(document.documentElement.dataset.themeDepth).toBeUndefined();
    expect(document.documentElement.dataset.themeComfort).toBeUndefined();
    expect(document.documentElement.dataset.themeTransparency).toBeUndefined();
    expect(document.documentElement.dataset.themeGlow).toBeUndefined();
  });
});
