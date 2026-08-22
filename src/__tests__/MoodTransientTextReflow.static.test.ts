import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readCss = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const scopeCss = readCss("src/pages/nav-v2/MoodScopeSelector.css");
const firstRunCss = readCss("src/pages/nav-v2/MoodFirstRunHint.css");
const valenceCss = readCss("src/components/state-of-mind/ValenceSlider.css");
const legacyConfirmCss = readCss("src/pages/nav-v2/MoodConfirmCta.css");
const legacySliderCss = readCss("src/pages/nav-v2/MoodSliderV2.css");

function cssBlock(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"));
  expect(match, `missing CSS block for ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

function expectScaledFontDeclarations(source: string): void {
  const declarations = [...source.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1]);
  expect(declarations.length).toBeGreaterThan(0);
  expect(declarations.every((value) => value.includes("var(--font-scale"))).toBe(true);
}

describe("mood transient text reflow contracts", () => {
  it("keeps the revealed time picker readable and at least 44px tall", () => {
    const label = cssBlock(scopeCss, ".mood-scope-time-label");
    const input = cssBlock(scopeCss, ".mood-scope-time-input");
    const compactInput = cssBlock(
      scopeCss,
      '.mood-scope-wrapper[data-density="compact"] .mood-scope-time-input',
    );

    expect(label).not.toMatch(/white-space:\s*nowrap/);
    expect(label).toMatch(/overflow-wrap:\s*anywhere/);
    expect(input).toMatch(/min-height:\s*44px/);
    expect(compactInput).toMatch(/min-height:\s*44px/);
    // The global mobile-input guard uses `font-size: 16px !important` to
    // prevent iOS focus zoom.  The time field must explicitly outrank that
    // guard so the user's selected text scale is still respected.
    expect(input).toMatch(/font-size:\s*calc\([^;]+var\(--font-scale[^;]+\)\s*!important/);
    expect(compactInput).toMatch(
      /font-size:\s*calc\([^;]+var\(--font-scale[^;]+\)\s*!important/,
    );
    expectScaledFontDeclarations(scopeCss);
  });

  it("keeps first-run instructions reachable on a short safe-area viewport", () => {
    const backdrop = cssBlock(firstRunCss, ".mood-first-run-backdrop");
    const card = cssBlock(firstRunCss, ".mood-first-run-card");

    expect(backdrop).toContain("var(--safe-top)");
    expect(backdrop).toContain("var(--safe-left)");
    expect(backdrop).toContain("var(--safe-right)");
    expect(card).toMatch(/max-height:\s*calc\(var\(--app-viewport-height\)/);
    expect(card).toMatch(/overflow-y:\s*auto/);
    expect(card).toMatch(/overscroll-behavior:\s*contain/);
    expectScaledFontDeclarations(firstRunCss);
  });

  it("lets the reachable valence label grow and wrap with the user font scale", () => {
    const chip = cssBlock(valenceCss, ".som-valence-chip");
    const text = cssBlock(valenceCss, ".som-valence-chip__text");

    expect(chip).toMatch(/max-width:\s*100%/);
    expect(chip).toMatch(/min-width:\s*0/);
    expect(text).toMatch(/white-space:\s*normal/);
    expect(text).toMatch(/overflow-wrap:\s*anywhere/);
    expectScaledFontDeclarations(valenceCss);
  });

  it("keeps source-defined mood controls safe if they are restored", () => {
    const toast = cssBlock(legacyConfirmCss, ".mood-undo-toast");
    const undo = cssBlock(legacyConfirmCss, ".mood-undo-toast-button");

    expect(toast).not.toMatch(/min-width:\s*18rem/);
    expect(toast).not.toMatch(/overflow:\s*hidden/);
    expect(toast).toMatch(/flex-wrap:\s*wrap/);
    expect(toast).toContain("var(--safe-left)");
    expect(toast).toContain("var(--safe-right)");
    expect(undo).toMatch(/min-height:\s*44px/);
    expectScaledFontDeclarations(legacyConfirmCss);
    expectScaledFontDeclarations(legacySliderCss);
  });
});
