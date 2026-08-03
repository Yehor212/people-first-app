import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const themesCss = readFileSync(resolve(process.cwd(), "src/styles/themes.css"), "utf8");
const normalizedThemesCss = themesCss.replace(/\s+/g, " ");

function blockFor(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = themesCss.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return match?.[1] ?? "";
}

describe("V2 data-theme glass tokens", () => {
  it("bridges V1 glass surfaces into ink and oled themes", () => {
    for (const selector of [':root[data-theme="ink"]', ':root[data-theme="oled"]']) {
      const block = blockFor(selector);

      expect(block).toContain("--surface-glass:");
      expect(block).toContain("--surface-glass-border:");
      expect(block).toContain("--surface-glass-blur:");
      expect(block).toContain("--zen-shadow-soft:");
    }
  });

  it("keeps V2 habits night cards role-colored instead of black-white", () => {
    expect(normalizedThemesCss).toContain(
      ':root[data-theme="ink"] [data-surface="ink-paper"] [data-tile="ritual-deck-card"]',
    );
    expect(normalizedThemesCss).toContain(
      ':root[data-theme="ink"] [data-surface="ritual-library-deck"] [data-card="ritual-library-card"]',
    );
    expect(normalizedThemesCss).toContain(
      ':root[data-theme="ink"] [data-surface="ritual-library-deck"] [data-chip="ritual-library-tab"][aria-pressed="true"]',
    );
    expect(normalizedThemesCss).toContain(':root[data-theme="ink"] .habit-growth-group');
    expect(normalizedThemesCss).toContain(
      ':root[data-theme="ink"] [data-card="ritual-weekly-card"]',
    );
    expect(normalizedThemesCss).toContain(
      ':root[data-theme="ink"] [data-card="ritual-weekly-card"] [data-slot="weekly-stats"]',
    );
    expect(normalizedThemesCss).toContain(
      ':root[data-theme="ink"] [data-surface="habit-create-sheet"] [data-card="ritual-template-picker-card"]',
    );
    expect(normalizedThemesCss).toContain(
      ':root[data-theme="ink"] [data-surface="habit-create-sheet"] [data-card="ritual-custom-habit-action"]',
    );
    expect(themesCss).toContain('[data-card="ritual-weekly-card"] {');
    expect(themesCss).toContain("background: var(--habit-card-background);");
    expect(themesCss).toContain("hsl(var(--habit-role) / 0.34)");
    expect(themesCss).toContain("hsl(var(--zf-role-space) / 0.18)");
    expect(themesCss).toMatch(/hsl\(var\(--habit-role\) \/ 0\.30?\)/);
    expect(themesCss).toMatch(/hsl\(var\(--habit-role\) \/ 0\.40?\)/);
    expect(themesCss).toContain("hsl(var(--habit-role) / 0.44)");
    expect(themesCss).toContain("hsl(var(--habit-role) / 0.28)");
    expect(themesCss).not.toContain('[data-slot="quickpick-symbol"] {\n  display: none;');
    expect(themesCss).not.toContain('[data-slot="quickpick-svg"] {\n  display: block;');
    expect(themesCss).toContain('[data-slot="ritual-library-symbol"]');
    expect(themesCss).not.toContain('[data-slot="ritual-library-icon"] svg');
    expect(themesCss).not.toContain('[data-slot="template-picker-symbol"] {\n  display: none;');
    expect(themesCss).not.toContain('[data-slot="template-picker-svg"] {\n  display: block;');

    const weeklyNightStart = themesCss.indexOf(
      ':root[data-theme="ink"] [data-card="ritual-weekly-card"]',
    );
    const weeklyNightEnd = themesCss.indexOf(
      ':root[data-theme="ink"] [data-surface="habit-create-sheet"]',
      weeklyNightStart,
    );
    expect(themesCss.slice(weeklyNightStart, weeklyNightEnd)).not.toContain("!important");
  });
  it("keeps native habit template picker source charm frames transparent across themes", () => {
    expect(normalizedThemesCss).toContain(
      ':root[data-theme="paper"] [data-surface="habit-create-sheet"] [data-template-picker-icon="true"][data-icon-frame="real-icon-duo-native"]',
    );
    expect(normalizedThemesCss).toContain(
      ':root[data-theme="ink"] [data-surface="habit-create-sheet"] [data-slot="template-picker-icon"][data-icon-frame="real-icon-duo-native"]',
    );
    expect(normalizedThemesCss).toContain(
      ':root[data-theme="oled"] [data-surface="habit-create-sheet"] [data-slot="template-picker-icon"][data-icon-frame="real-icon-duo-native"]',
    );
    expect(themesCss).toContain("background-color: transparent;");
    expect(themesCss).toContain("box-shadow: none;");
  });

  it("keeps the structural Settings detail region presentationless", () => {
    const detailRegionBlock = blockFor(
      '[data-v2-readable-page="settings"] [data-visual-role="settings-detail-region"]',
    );

    expect(detailRegionBlock).toContain("background: transparent !important;");
    expect(detailRegionBlock).toContain("border-color: transparent !important;");
    expect(detailRegionBlock).toContain("box-shadow: none !important;");
    expect(detailRegionBlock).toContain("-webkit-backdrop-filter: none !important;");
    expect(detailRegionBlock).toContain("backdrop-filter: none !important;");
  });

});
