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
const SETTINGS_V2_EMERALD_NIGHT_VARS = [
  "--settings-v2-night-sky-top",
  "--settings-v2-night-sky-mid",
  "--settings-v2-night-sky-bottom",
  "--settings-v2-night-aurora",
  "--settings-v2-night-nebula-a",
  "--settings-v2-night-nebula-b",
  "--settings-v2-night-nebula-c",
  "--settings-v2-night-vignette",
  "--settings-v2-night-star",
  "--settings-v2-night-star-halo",
];
const OLED_DRAWER_VISIBILITY_SELECTOR =
  ':root[data-theme="oled"] [data-theme-region="drawer-v2"] [data-testid^="drawer-v2-destination-"]';

function themeBlock(theme: "paper" | "ink" | "oled"): string {
  const pattern = new RegExp(String.raw`:root\[data-theme="${theme}"\]\s*\{([\s\S]*?)\n\}`, "g");
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

function settingsReadablePageRuleBlock(): string {
  const match = css.match(
    /:root\[data-theme="paper"\] \[data-v2-readable-page="settings"\],[\s\S]*?:root\[data-theme="oled"\] \[data-v2-readable-page="settings"\] \{([\s\S]*?)\n\}/
  );
  if (!match) {
    throw new Error("Missing Settings readable page liquid glass rule");
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

    expect(paper).not.toMatch(
      /--zf-role-(body|mind|focus|rest|energy|release|diary|space|gratitude|settings):/
    );
  });

  it("settings liquid glass page background includes layered optical light over a shell base", () => {
    const rule = settingsReadablePageRuleBlock();

    expect(rule).toContain("hsl(var(--settings-v2-shell)");
    expect(rule).toContain("radial-gradient(circle at 12% 6%");
    expect(rule).toContain("radial-gradient(circle at 92% 2%");
    expect(rule).toContain("linear-gradient(180deg");
  });

  it("settings shell background follows the liquid glass page", () => {
    const rule = cssRuleBlock('.v2-edge-to-edge-surface[data-active-page="settings"]');

    expect(rule).toContain("hsl(var(--settings-v2-shell)");
    expect(rule).toContain("linear-gradient(180deg");
  });

  it("settings surfaces have dedicated comfort tokens in every theme", () => {
    for (const theme of ["paper", "ink", "oled"] as const) {
      const block = themeBlock(theme);
      for (const cssVar of SETTINGS_V2_COMFORT_VARS) {
        expect(readVar(block, cssVar)).toBeTruthy();
      }
    }
  });

  it("paper settings tokens use exact icon-derived leaf glass colors", () => {
    const paper = themeBlock("paper");
    const shell = readVar(paper, "--settings-v2-shell");
    const card = readVar(paper, "--settings-v2-card");
    const panel = readVar(paper, "--settings-v2-panel");
    const settingsLightness = [shell, card, panel].map(hslLightness);

    expect(shell).toBe("148 31% 90%");
    expect(card).toBe("148 31% 90%");
    expect(panel).toBe("155 29% 77%");
    expect(Math.max(...settingsLightness) - Math.min(...settingsLightness)).toBeGreaterThanOrEqual(
      8
    );
    expect(hslHue(shell)).toBe(148);
    expect(hslHue(card)).toBe(148);
    expect(hslHue(panel)).toBe(155);
    expect(readVar(paper, "--settings-v2-border")).toBe("89 12% 37%");
    expect(readVar(paper, "--settings-v2-accent")).toBe("152 32% 36%");
    expect(readVar(paper, "--settings-v2-glass-blur")).toBe("24px");
    expect(readVar(paper, "--settings-v2-rim-light")).toBe("148 31% 90%");
  });

  it("ink theme preserves the V2 bridge while replacing the rejected swamp Settings palette", () => {
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

    expect(readVar(ink, "--settings-v2-shell")).toBe("165 67% 2%");
    expect(readVar(ink, "--settings-v2-card")).toBe("159 55% 6%");
    expect(readVar(ink, "--settings-v2-panel")).toBe("159 43% 10%");
    expect(readVar(ink, "--settings-v2-border")).toBe("158 30% 53%");
    expect(readVar(ink, "--settings-v2-accent")).toBe("155 29% 77%");
    expect(readVar(ink, "--settings-v2-card-alpha")).toBe("0.92");
    expect(readVar(ink, "--settings-v2-panel-alpha")).toBe("0.9");
    expect(readVar(ink, "--settings-v2-glass-blur")).toBe("14px");
    expect(readVar(ink, "--settings-v2-rim-light")).toBe("157 100% 96%");

    for (const cssVar of SETTINGS_V2_EMERALD_NIGHT_VARS) {
      expect(readVar(ink, cssVar)).toBeTruthy();
    }
  });

  it("keeps the OLED Settings snapshot true black and separate from emerald ink", () => {
    const oled = themeBlock("oled");

    expect(readVar(oled, "--settings-v2-shell")).toBe("0 0% 0%");
    expect(readVar(oled, "--settings-v2-card")).toBe("64 11% 14%");
    expect(readVar(oled, "--settings-v2-panel")).toBe("152 32% 18%");
    expect(readVar(oled, "--settings-v2-border")).toBe("153 22% 42%");
    for (const cssVar of SETTINGS_V2_EMERALD_NIGHT_VARS) {
      expect(() => readVar(oled, cssVar)).toThrow(`Missing ${cssVar}`);
    }
  });

  it("uses an ink-only logical backdrop with bounded core motion and safe fallbacks", () => {
    expect(css).toContain(':root[data-theme="ink"] .settings-emerald-night-backdrop');
    expect(css).toContain('data-nav-layout="web"');
    expect(css).toContain('data-nav-rail="expanded"');
    expect(css).toContain('data-nav-rail="compact"');
    expect(css).toContain("inset-inline-start");
    expect(css).toContain('data-mobile-detail="true"');
    expect(css).toContain("animation: none");
    expect(css).toContain(".settings-emerald-night-backdrop__star-core");
    expect(css).toContain("@keyframes settings-emerald-star-breathe");
    expect(css).toContain('[data-motion-compact="true"]');
    expect(css).toContain('[data-motion-desktop="true"]');
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*?\.settings-emerald-night-backdrop[\s\S]*?display:\s*none/
    );
    expect(css).toMatch(
      /:root\[data-theme="ink"\] \.v2-edge-to-edge-surface\[data-active-page="settings"\][\s\S]*?hsl\(var\(--settings-v2-night-sky-mid\)\)/
    );
    expect(css).toMatch(
      /:root\[data-theme="ink"\] \[data-v2-readable-page="settings"\][\s\S]*?background:\s*transparent/
    );

    const start = css.indexOf(".settings-emerald-night-backdrop");
    const end = css.indexOf("/* V2 habits night polish", start);
    const backdropCss = css.slice(start, end === -1 ? undefined : end);
    expect(backdropCss).not.toMatch(/(?:^|[;{]\s*)(?:left|right)\s*:/m);
    expect(backdropCss).toMatch(
      /:root\[dir="rtl"\][\s\S]*?\.settings-emerald-night-backdrop__star[\s\S]*?transform:\s*translate3d\(50%,\s*-50%,\s*0\)/
    );
    const keyframeStart = backdropCss.indexOf("@keyframes settings-emerald-star-breathe");
    const keyframeEnd = backdropCss.indexOf("\n}\n\n", keyframeStart);
    const keyframeBody = backdropCss.slice(keyframeStart, keyframeEnd + 3);
    expect(keyframeStart).toBeGreaterThanOrEqual(0);
    expect(keyframeEnd).toBeGreaterThan(keyframeStart);
    expect(keyframeBody).toContain("transform:");
    expect(keyframeBody).toContain("opacity:");
    expect(keyframeBody).toContain("scale3d(0.96, 0.96, 1)");
    expect(keyframeBody).toContain("scale3d(1.06, 1.06, 1)");
    expect(keyframeBody).not.toMatch(/\n\s*50%\s*\{/);
    expect(keyframeBody).not.toMatch(/0%,\s*100%/);
    expect(keyframeBody).not.toContain("filter:");
    expect(backdropCss).toMatch(
      /settings-emerald-star-breathe[\s\S]*?cubic-bezier\(0\.4, 0, 0\.2, 1\)[\s\S]*?infinite alternate/
    );
    expect(backdropCss).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("uses the shared Paper daylight material as a motion-gated logical Settings backdrop", () => {
    const start = css.indexOf(".settings-day-cosmic-backdrop");
    const end = css.indexOf("/* Approved Variant A", start);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const dayBackdropCss = css.slice(start, end);
    expect(dayBackdropCss).toContain("position: fixed");
    expect(dayBackdropCss).toContain("var(--app-viewport-height)");
    expect(dayBackdropCss).toContain("pointer-events: none");
    expect(dayBackdropCss).toContain("contain: paint");
    expect(dayBackdropCss).toContain('data-nav-rail="expanded"');
    expect(dayBackdropCss).toContain('data-nav-rail="compact"');
    expect(dayBackdropCss).toContain("inset-inline-start");
    expect(dayBackdropCss).toContain('data-animated="false"');
    expect(dayBackdropCss).toContain("will-change: auto");
    expect(dayBackdropCss).toContain("backdrop-filter: none");
    expect(dayBackdropCss).not.toContain("backdrop-filter: blur(");
    expect(dayBackdropCss).not.toMatch(/(?:^|[;{]\s*)(?:left|right)\s*:/m);
    expect(dayBackdropCss).toMatch(/--settings-v2-text-strong:\s*176 55% 5%/);
    expect(dayBackdropCss).toMatch(/--foreground:\s*var\(--settings-v2-text-strong\)/);
    expect(dayBackdropCss).toMatch(/--v2-readable-foreground:\s*var\(--settings-v2-text-strong\)/);
    expect(css).toMatch(/--settings-v2-text-muted:\s*176 40% 12%/);
    expect(dayBackdropCss).toMatch(/--settings-v2-text-muted:\s*176 45% 6%/);
    expect(dayBackdropCss).toMatch(/--muted-foreground:\s*var\(--settings-v2-text-muted\)/);
    expect(dayBackdropCss).toMatch(/--v2-readable-muted:\s*var\(--settings-v2-text-muted\)/);
    expect(dayBackdropCss).toMatch(
      /\[data-testid="settings-support-footer"\][\s\S]*?background-color:\s*hsl\(var\(--settings-v2-card\)\)[\s\S]*?background-image:\s*linear-gradient[\s\S]*?backdrop-filter:\s*none/
    );

    expect(css).toMatch(
      /:root\[data-theme="paper"\] \[data-v2-readable-page="settings"\][\s\S]*?background:\s*transparent/
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-transparency: no-preference\)[\s\S]*?:root\[data-theme="paper"\][\s\S]*?background:\s*linear-gradient[\s\S]*?backdrop-filter:\s*none/
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-transparency: reduce\)[\s\S]*?\.settings-day-cosmic-backdrop[\s\S]*?display:\s*none/
    );
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*?\.settings-day-cosmic-backdrop[\s\S]*?display:\s*none !important/
    );
    expect(css).toMatch(
      /:root\[data-theme="paper"\]\[data-theme-contrast="high"\] \.settings-day-cosmic-backdrop[\s\S]*?display:\s*none/
    );
  });

  it("uses opaque ink cards as the cross-browser baseline and opts into translucency explicitly", () => {
    const inkCardRule = css.match(
      /:root\[data-theme="ink"\]\s+\[data-v2-readable-page="settings"\]\s+\[data-testid="settings-page-control-card"\],[^{}]+\[data-testid="settings-theme-strip"\]\s*\{([^}]*)\}/
    )?.[1];

    expect(inkCardRule).toBeTruthy();
    expect(inkCardRule).toContain("background: hsl(var(--settings-v2-card));");
    expect(inkCardRule).toContain("-webkit-backdrop-filter: none;");
    expect(inkCardRule).toContain("backdrop-filter: none;");
    expect(css).toMatch(
      /@media \(prefers-reduced-transparency: no-preference\)[\s\S]*?background:\s*hsl\(var\(--settings-v2-card\)\s*\/\s*var\(--settings-v2-card-alpha, 0\.92\)\)[\s\S]*?-webkit-backdrop-filter:\s*none[\s\S]*?backdrop-filter:\s*none/
    );
    const backdropStart = css.indexOf(".settings-emerald-night-backdrop");
    const backdropEnd = css.indexOf("/* V2 habits night polish", backdropStart);
    expect(css.slice(backdropStart, backdropEnd === -1 ? undefined : backdropEnd)).not.toContain(
      "backdrop-filter: blur("
    );
  });

  it("keeps a safe logical drawer rail while compacting other chrome below 360px", () => {
    const feedbackGridStart = css.indexOf('[data-slot="settings-appearance-feedback"]');
    const feedbackGridRule = css.slice(feedbackGridStart, feedbackGridStart + 300);
    expect(feedbackGridStart).toBeGreaterThan(-1);
    expect(feedbackGridRule).toContain("grid-template-columns: repeat(");
    expect(feedbackGridRule).toContain("calc(8rem * var(--font-scale, 1))");
    expect(css).toMatch(
      /@media \(max-width: 359px\)[\s\S]*?\n\s{2}:root\[data-theme\] \[data-v2-readable-page="settings"\]\s*\{[\s\S]*?padding-inline-start:\s*calc\(var\(--safe-inline-start\) \+ var\(--v2-phone-drawer-rail\)\)[\s\S]*?padding-inline-end:\s*max\(var\(--v2-phone-content-inline-end\), var\(--safe-inline-end\)\)/
    );
    expect(css).toMatch(
      /@media \(max-width: 359px\)[\s\S]*?\[data-testid="nav-v2-open-drawer"\][\s\S]*?inline-size:\s*var\(--v2-phone-drawer-size\)[\s\S]*?block-size:\s*var\(--v2-phone-drawer-size\)/
    );
    expect(css).toMatch(
      /@media \(max-width: 359px\)[\s\S]*?\[data-slot="settings-panel-header"\][\s\S]*?gap:\s*12px/
    );
    expect(css).toMatch(
      /@media \(max-width: 359px\)[\s\S]*?\[data-slot="settings-panel-icon"\][\s\S]*?inline-size:\s*40px[\s\S]*?block-size:\s*40px/
    );
    expect(css).toMatch(
      /@media \(max-width: 359px\)[\s\S]*?\[data-slot="settings-footer-legal-action"\][\s\S]*?padding-inline:\s*4px/
    );
    expect(css).toMatch(
      /@media \(max-width: 359px\)[\s\S]*?\[data-slot="settings-appearance-feedback-rail"\][\s\S]*?inset-inline-start:\s*max\(16px, var\(--safe-inline-start\)\)[\s\S]*?inset-inline-end:\s*max\(16px, var\(--safe-inline-end\)\)/
    );
    expect(css).toMatch(
      /@media \(max-width: 359px\)[\s\S]*?\[data-slot="settings-appearance-feedback"\][\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 48px[\s\S]*?gap:\s*8px[\s\S]*?padding-inline:\s*12px/
    );
    expect(css).toMatch(
      /@media \(max-width: 359px\)[\s\S]*?\[data-slot="settings-appearance-feedback-message"\][\s\S]*?grid-column:\s*1 \/ -1/
    );
    expect(css).toMatch(
      /@media \(max-width: 359px\)[\s\S]*?\[data-slot="settings-appearance-feedback-dismiss"\][\s\S]*?inline-size:\s*48px[\s\S]*?block-size:\s*48px/
    );
  });

  it("keeps mobile Settings detail hierarchy identical across visual themes", () => {
    const inkOnlyDetailHero =
      /:root\[data-theme="ink"\]\s+\[data-v2-readable-page="settings"\]\[data-mobile-detail="true"\]\s+\[data-testid="settings-page-control-card"\]\s*\{/;
    const themeNeutralDetailHero =
      /@media \(max-width: 639px\) \{[\s\S]*?\n\s{2}\[data-v2-readable-page="settings"\]\[data-mobile-detail="true"\]\s+\[data-testid="settings-page-control-card"\]\s*\{\s*display:\s*none;/;

    expect(css).not.toMatch(inkOnlyDetailHero);
    expect(css).toMatch(themeNeutralDetailHero);
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

  it("does not retain selectors for removed appearance controls", () => {
    expect(css).not.toContain("data-theme-style");
    expect(css).not.toContain("data-theme-transparency");
    expect(css).not.toContain("settings-v2-appearance-glass-card");
    expect(css).not.toContain("settings-v2-accent-swatch-row");
  });

  it("applies high-contrast readability and focus tokens across V2 instead of only Settings", () => {
    expect(css).toContain(':root[data-theme-contrast="high"]');
    expect(css).toContain("--foreground: var(--settings-v2-text-strong)");
    expect(css).toContain("--muted-foreground: var(--settings-v2-text-muted)");
    expect(css).toContain("--ring: var(--settings-v2-focus)");
    expect(css).not.toContain(
      ':root[data-theme-contrast="high"] [data-v2-readable-page="settings"] {'
    );
  });

  it("uses a strong readable label color for every selected Settings choice", () => {
    const primitiveSource = readFileSync(
      join(__dirname, "../pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx"),
      "utf-8"
    );
    expect(primitiveSource).toContain("bg-[hsl(var(--settings-v2-accent)/0.1)] text-foreground");
    const selectedChoiceSource = primitiveSource.slice(
      primitiveSource.indexOf("const SETTINGS_CHOICE_SELECTED_CLASS"),
      primitiveSource.indexOf("export function PanelFrame")
    );
    expect(selectedChoiceSource).not.toContain(
      "bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))]"
    );
  });
});
