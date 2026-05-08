import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const THEMES_CSS_PATH = join(__dirname, "themes.css");
const css = readFileSync(THEMES_CSS_PATH, "utf-8");

const SHADCN_BRIDGE_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--input",
  "--ring",
];

const NAV_V2_THEME_VARS = [
  "--nav-v2-drawer-start",
  "--nav-v2-drawer-mid",
  "--nav-v2-drawer-end",
  "--nav-v2-drawer-text",
  "--nav-v2-drawer-muted",
  "--nav-v2-drawer-border",
  "--nav-v2-drawer-divider",
  "--nav-v2-item-surface",
  "--nav-v2-item-hover",
  "--nav-v2-icon-surface",
  "--nav-v2-icon-muted",
  "--nav-v2-backdrop",
  "--nav-v2-shadow",
];

function themeBlock(theme: "paper" | "ink" | "oled"): string {
  const pattern = new RegExp(
    String.raw`:root\[data-theme="${theme}"\]\s*\{([\s\S]*?)\n\}`,
    "g",
  );
  return Array.from(css.matchAll(pattern), (match) => match[1]).join("\n");
}

function readVar(block: string, name: string): string {
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const match = block.match(new RegExp(`${escaped}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`Missing ${name}`);
  }
  return match[1].trim();
}

function hslLightness(value: string): number {
  const match = value.match(/^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) {
    throw new Error(`Expected HSL triplet, got: ${value}`);
  }
  return Number(match[1]);
}

describe("theme bridge variables", () => {
  it("paper bridges shadcn variables instead of falling back to bright defaults", () => {
    const paper = themeBlock("paper");

    for (const cssVar of SHADCN_BRIDGE_VARS) {
      expect(readVar(paper, cssVar)).toBeTruthy();
    }

    expect(hslLightness(readVar(paper, "--background"))).toBeLessThanOrEqual(95);
    expect(hslLightness(readVar(paper, "--card"))).toBeLessThanOrEqual(97);
    expect(hslLightness(readVar(paper, "--popover"))).toBeLessThanOrEqual(97);
  });

  it("all themes expose the semantic V2 navigation palette", () => {
    for (const theme of ["paper", "ink", "oled"] as const) {
      const block = themeBlock(theme);
      for (const cssVar of NAV_V2_THEME_VARS) {
        expect(readVar(block, cssVar)).toBeTruthy();
      }
    }
  });
});
