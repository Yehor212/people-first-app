import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_CUSTOMIZATION,
  THEME_ACCENT_FAMILIES,
  THEME_INTENSITIES,
  applyThemeCustomizationToDOM,
  getThemeCustomizationRecipe,
  normalizeThemeCustomization,
} from "../themeCustomization";

function parseHslToken(token: string): [number, number, number] {
  const match = token.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) throw new Error(`Invalid HSL token: ${token}`);
  return [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100];
}

function hslToRgb([hue, saturation, lightness]: [number, number, number]): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const second = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
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
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe("themeCustomization", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme-style");
    document.documentElement.removeAttribute("data-theme-accent");
    document.documentElement.removeAttribute("data-theme-comfort");
  });

  afterEach(() => {
    applyThemeCustomizationToDOM("paper", DEFAULT_THEME_CUSTOMIZATION);
  });

  it("normalizes corrupted persisted values back to the ZenFlow default", () => {
    expect(
      normalizeThemeCustomization({
        paletteId: "raw-neon",
        accentFamily: "unsafe-css",
        intensity: 99,
        warmth: "lava",
        depth: "floating-card-stack",
        contrastMode: "invisible",
        reduceGlow: "yes",
        reduceTransparency: 1,
        injectedCss: "body{display:none}",
      }),
    ).toEqual(DEFAULT_THEME_CUSTOMIZATION);
  });

  it("maps Morning Hearth paper mode to approved Warm Porcelain glass tokens", () => {
    const recipe = getThemeCustomizationRecipe("paper", {
      ...DEFAULT_THEME_CUSTOMIZATION,
      paletteId: "morningHearth",
      accentFamily: "clay",
      intensity: "balanced",
      warmth: "warm",
      depth: "soft",
    });

    expect(recipe.cssVars["--settings-v2-shell"]).toBe("35 44% 92%");
    expect(recipe.cssVars["--settings-v2-card"]).toBe("40 58% 97%");
    expect(recipe.cssVars["--settings-v2-panel"]).toBe("33 38% 88%");
    expect(recipe.cssVars["--settings-v2-border"]).toBe("31 24% 58%");
    expect(recipe.cssVars["--settings-v2-accent"]).toBe("18 44% 42%");
    expect(recipe.cssVars["--settings-v2-panel-alpha"]).toBe("0.64");
    expect(recipe.cssVars["--settings-v2-glass-blur"]).toBe("18px");
    expect(recipe.cssVars["--settings-v2-rim-light"]).toBe("40 70% 99%");
    expect(recipe.metaThemeColor).toBe("#a46a4f");
  });

  it("maps Velvet Library dark mode to approved Nocturne Velvet glass tokens", () => {
    const recipe = getThemeCustomizationRecipe("ink", {
      ...DEFAULT_THEME_CUSTOMIZATION,
      paletteId: "velvetLibrary",
      accentFamily: "plum",
      intensity: "balanced",
      depth: "soft",
    });

    expect(recipe.cssVars["--settings-v2-shell"]).toBe("263 26% 8%");
    expect(recipe.cssVars["--settings-v2-card"]).toBe("258 24% 12%");
    expect(recipe.cssVars["--settings-v2-panel"]).toBe("254 18% 18%");
    expect(recipe.cssVars["--settings-v2-border"]).toBe("262 18% 38%");
    expect(recipe.cssVars["--settings-v2-accent"]).toBe("274 44% 72%");
    expect(recipe.cssVars["--settings-v2-panel-alpha"]).toBe("0.7");
    expect(recipe.cssVars["--settings-v2-glass-blur"]).toBe("20px");
    expect(recipe.cssVars["--settings-v2-rim-light"]).toBe("274 70% 78%");
    expect(recipe.metaThemeColor).toBe("#6d588f");
  });

  it("returns allowlisted token recipes without accepting raw CSS values", () => {
    const recipe = getThemeCustomizationRecipe("paper", {
      ...DEFAULT_THEME_CUSTOMIZATION,
      paletteId: "morningHearth",
      accentFamily: "clay",
      intensity: "vivid",
      warmth: "warm",
      depth: "cozy",
    });

    expect(recipe.cssVars["--settings-v2-accent"]).toBeDefined();
    expect(recipe.cssVars["--settings-v2-card"]).toBeDefined();
    expect(Object.keys(recipe.cssVars)).not.toContain("injectedCss");
    expect(recipe.metaThemeColor).toMatch(/^#[0-9a-f]{6}$/i);
  });


  it("keeps custom primary action text at WCAG AA contrast", () => {
    for (const appliedTheme of ["paper", "ink", "oled"] as const) {
      for (const accent of THEME_ACCENT_FAMILIES) {
        for (const intensity of THEME_INTENSITIES) {
          const recipe = getThemeCustomizationRecipe(appliedTheme, {
            ...DEFAULT_THEME_CUSTOMIZATION,
            paletteId: "morningHearth",
            accentFamily: accent.id,
            intensity: intensity.id,
          });
          const ratio = contrastRatio(
            recipe.cssVars["--primary"],
            recipe.cssVars["--primary-foreground"],
          );

          expect(
            ratio,
            `${appliedTheme}/${accent.id}/${intensity.id} primary contrast`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });


  it("updates the browser theme-color meta when a custom style is previewed", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#000000";
    document.head.appendChild(meta);

    applyThemeCustomizationToDOM("paper", {
      ...DEFAULT_THEME_CUSTOMIZATION,
      paletteId: "morningHearth",
      accentFamily: "clay",
    });

    expect(meta.content).toBe("#a46a4f");

    applyThemeCustomizationToDOM("paper", DEFAULT_THEME_CUSTOMIZATION);
    expect(meta.content).toBe("#4a9d7c");

    meta.remove();
  });

  it("applies custom tokens for preview and clears them for the default style", () => {
    applyThemeCustomizationToDOM("paper", {
      ...DEFAULT_THEME_CUSTOMIZATION,
      paletteId: "velvetLibrary",
      accentFamily: "plum",
      contrastMode: "high",
      reduceGlow: true,
      reduceTransparency: true,
    });

    expect(document.documentElement.dataset.themeStyle).toBe("velvetLibrary");
    expect(document.documentElement.dataset.themeAccent).toBe("plum");
    expect(document.documentElement.dataset.themeComfort).toBe("high-contrast");
    expect(document.documentElement.style.getPropertyValue("--settings-v2-accent")).not.toBe("");

    applyThemeCustomizationToDOM("paper", DEFAULT_THEME_CUSTOMIZATION);

    expect(document.documentElement.dataset.themeStyle).toBe("zenflow");
    expect(document.documentElement.style.getPropertyValue("--settings-v2-accent")).toBe("");
  });
});
