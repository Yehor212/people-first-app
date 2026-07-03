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
const SETTINGS_V2_COMFORT_VARS = [
  "--settings-v2-shell",
  "--settings-v2-card",
  "--settings-v2-panel",
  "--settings-v2-border",
  "--settings-v2-accent",
  "--settings-v2-shadow",
  "--settings-v2-glass-blur",
  "--settings-v2-rim-light",
];
const OLED_DRAWER_VISIBILITY_SELECTOR =
  ':root[data-theme="oled"] [data-theme-region="drawer-v2"] [data-testid^="drawer-v2-destination-"]';

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

function cssRuleBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) {
    throw new Error(`Missing CSS rule for ${selector}`);
  }
  return match[1];
}

function hslLightness(value: string): number {
  const match = value.match(/^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) {
    throw new Error(`Expected HSL triplet, got: ${value}`);
  }
  return Number(match[1]);
}
function hslHue(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/);
  if (!match) {
    throw new Error(`Expected HSL triplet, got: ${value}`);
  }
  return Number(match[1]);
}
function hslSaturation(value: string): number {
  const match = value.match(/^\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)%\s+\d+(?:\.\d+)?%$/);
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

  it("paper preserves the Solar Prism V2 snapshot palette", () => {
    const paper = themeBlock("paper");
    const snapshotCriticalVars = new Map([
      ["--background", "174 41% 86%"],
      ["--foreground", "176 48% 9%"],
      ["--card", "158 42% 90%"],
      ["--primary", "166 56% 31%"],
      ["--surface-elevated", "43 52% 87%"],
      ["--surface-overlay", "191 32% 82%"],
      ["--nav-v2-drawer-start", "190 41% 85%"],
      ["--nav-v2-drawer-mid", "158 38% 84%"],
      ["--nav-v2-drawer-end", "263 35% 88%"],
      ["--nav-v2-item-hover", "168 36% 82%"],
    ]);

    for (const [cssVar, value] of snapshotCriticalVars) {
      expect(readVar(paper, cssVar)).toBe(value);
    }

    expect(paper).not.toMatch(/--zf-role-(body|mind|focus|rest|energy|release|diary|space|gratitude|settings):/);
  });

  it("settings surfaces have dedicated comfort tokens in every theme", () => {
    for (const theme of ["paper", "ink", "oled"] as const) {
      const block = themeBlock(theme);
      for (const cssVar of SETTINGS_V2_COMFORT_VARS) {
        expect(readVar(block, cssVar)).toBeTruthy();
      }
    }
  });

  it("paper settings tokens use the approved Warm Porcelain glass base", () => {
    const paper = themeBlock("paper");
    const shell = readVar(paper, "--settings-v2-shell");
    const card = readVar(paper, "--settings-v2-card");
    const panel = readVar(paper, "--settings-v2-panel");
    const settingsLightness = [shell, card, panel].map(hslLightness);

    expect(shell).toBe("35 44% 92%");
    expect(card).toBe("40 58% 97%");
    expect(panel).toBe("33 38% 88%");
    expect(Math.max(...settingsLightness) - Math.min(...settingsLightness)).toBeGreaterThanOrEqual(
      7
    );
    expect(hslHue(shell)).toBeGreaterThanOrEqual(30);
    expect(hslHue(shell)).toBeLessThanOrEqual(45);
    expect(hslSaturation(shell)).toBeGreaterThanOrEqual(35);
    expect(hslLightness(readVar(paper, "--settings-v2-border"))).toBeLessThanOrEqual(60);
    expect(hslHue(readVar(paper, "--settings-v2-accent"))).toBeGreaterThanOrEqual(15);
    expect(hslHue(readVar(paper, "--settings-v2-accent"))).toBeLessThanOrEqual(25);
    expect(readVar(paper, "--settings-v2-glass-blur")).toBe("18px");
    expect(readVar(paper, "--settings-v2-rim-light")).toBe("40 70% 99%");
  });

  it("ink theme preserves the night V2 snapshot bridge while keeping settings tokens separate", () => {
    const ink = themeBlock("ink");
    const snapshotCriticalVars = new Map([
      ["--surface-glass", "hsl(var(--zf-surface-1) / 0.82)"],
      ["--surface-glass-border", "hsl(var(--zf-primary) / 0.18)"],
      ["--zen-shadow-soft", "0 4px 20px -4px hsl(var(--zf-primary) / 0.22)"],
      ["--zf-text-muted", "165 8% 52%"],
      ["--zf-role-body", "158 72% 64%"],
      ["--zf-role-mind", "268 76% 76%"],
      ["--zf-role-focus", "194 92% 64%"],
      ["--zf-role-settings", "215 58% 72%"],
      ["--background", "var(--zf-night-0)"],
      ["--primary", "var(--zf-primary)"],
      ["--secondary", "178 16% 16%"],
      ["--muted", "178 14% 18%"],
      ["--border", "174 16% 22%"],
      ["--nav-v2-drawer-border", "174 16% 28%"],
      ["--nav-v2-drawer-divider", "174 16% 22%"],
      ["--nav-v2-item-hover", "var(--zf-surface-2)"],
    ]);

    for (const [cssVar, value] of snapshotCriticalVars) {
      expect(readVar(ink, cssVar)).toBe(value);
    }

    expect(readVar(ink, "--settings-v2-shell")).toBe("263 26% 8%");
    expect(readVar(ink, "--settings-v2-card")).toBe("258 24% 12%");
    expect(readVar(ink, "--settings-v2-panel")).toBe("254 18% 18%");
    expect(readVar(ink, "--settings-v2-border")).toBe("262 18% 38%");
    expect(readVar(ink, "--settings-v2-accent")).toBe("274 44% 72%");
    expect(readVar(ink, "--settings-v2-glass-blur")).toBe("20px");
    expect(readVar(ink, "--settings-v2-rim-light")).toBe("274 70% 78%");
  });

  it("dark themes avoid theme-local edge-bleed haze overrides", () => {
    expect(themeBlock("ink")).not.toContain("--v2-edge-bleed-background");
    expect(themeBlock("oled")).not.toContain("--v2-edge-bleed-background");
  });

  it("oled drawer destination rows stay visible after motion settles", () => {
    const oled = themeBlock("oled");
    const visibilityRule = cssRuleBlock(OLED_DRAWER_VISIBILITY_SELECTOR);

    expect(hslLightness(readVar(oled, "--nav-v2-item-surface"))).toBeGreaterThanOrEqual(9);
    expect(hslLightness(readVar(oled, "--nav-v2-drawer-border"))).toBeGreaterThanOrEqual(30);
    expect(visibilityRule).toContain("animation-name: none");
    expect(visibilityRule).toContain("opacity: 1");
  });
});
