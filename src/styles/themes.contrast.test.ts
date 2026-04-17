/**
 * Phase 0-C — Paper Theme Contrast Validation (Law 9: Accessibility)
 *
 * Verifies WCAG 2.2 contrast ratios for all three themes (paper, ink, oled)
 * by:
 *   1. Converting OKLCH → linear sRGB (Björn Ottosson's 2020 reference impl)
 *   2. Computing relative luminance per WCAG 2.x §1.4.3 formula
 *   3. Computing contrast ratio (L1 + 0.05) / (L2 + 0.05)
 *
 * No external color library — avoids adding a dependency for a single test.
 * References:
 *   - WCAG 2.2 SC 1.4.3 (Contrast Minimum) + 1.4.6 (Enhanced, AAA ≥ 7.0)
 *   - WCAG 2.2 SC 1.4.11 (Non-text Contrast ≥ 3.0 for UI components)
 *   - OKLCH reference impl: https://bottosson.github.io/posts/oklab/
 *
 * Source of truth: values are parsed from src/generated/tokens.css so a drift
 * between tokens.json and this test becomes impossible.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Color math
// ---------------------------------------------------------------------------
// Note: sRGB gamma encoding helper is intentionally omitted — the OKLab →
// sRGB reference implementation below returns LINEAR-light sRGB already, and
// WCAG 2.x §1.4.3 luminance uses linear-light coefficients directly. No gamma
// round-trip needed.

/** OKLCH → OKLab (polar → rectangular). Hue in degrees. */
function oklchToOklab(L: number, C: number, H: number): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  return [L, C * Math.cos(hRad), C * Math.sin(hRad)];
}

/** OKLab → linear sRGB per Björn Ottosson's OKLab reference implementation.
 *  Returns values that may be out of [0,1] gamut — caller should clamp. */
function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Clamp a channel to 0..1. */
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Relative luminance per WCAG 2.x §1.4.3. Takes OKLCH and returns Y in [0,1].
 *  Internally: OKLCH → OKLab → linear sRGB → clamp → Y = 0.2126 R + 0.7152 G + 0.0722 B. */
function oklchRelativeLuminance(L: number, C: number, H: number): number {
  const [la, aa, ba] = oklchToOklab(L, C, H);
  const [r, g, b] = oklabToLinearSrgb(la, aa, ba);
  const R = clamp01(r);
  const G = clamp01(g);
  const B = clamp01(b);
  // These are already LINEAR sRGB values; WCAG luminance uses linear-light
  // coefficients, no gamma step needed here.
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG contrast ratio between two OKLCH colors. */
function contrastRatio(
  [L1, C1, H1]: readonly [number, number, number],
  [L2, C2, H2]: readonly [number, number, number],
): number {
  const y1 = oklchRelativeLuminance(L1, C1, H1);
  const y2 = oklchRelativeLuminance(L2, C2, H2);
  const lighter = Math.max(y1, y2);
  const darker = Math.min(y1, y2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Parse tokens.css to guarantee this test reflects shipped CSS values
// ---------------------------------------------------------------------------

const TOKENS_CSS_PATH = join(__dirname, '..', 'generated', 'tokens.css');

function loadThemeColors(theme: 'paper' | 'ink' | 'oled'): Record<string, [number, number, number]> {
  const css = readFileSync(TOKENS_CSS_PATH, 'utf-8');
  // Token names are kebab-cased, e.g. --color-theme-paper-surface, ink-muted, etc.
  const prefix = `--color-theme-${theme}-`;
  const pattern = new RegExp(
    String.raw`${prefix.replace(/-/g, '\\-')}([a-z-]+):\s*oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)`,
    'g',
  );
  const colors: Record<string, [number, number, number]> = {};
  for (const match of css.matchAll(pattern)) {
    const [, role, L, C, H] = match;
    colors[role] = [parseFloat(L), parseFloat(C), parseFloat(H)];
  }
  return colors;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 0-C theme contrast (WCAG 2.2 AAA)', () => {
  describe('paper theme', () => {
    const paper = loadThemeColors('paper');

    it('loads all 8 paper roles from tokens.css', () => {
      expect(Object.keys(paper).sort()).toEqual([
        'border',
        'ink',
        'ink-muted',
        'primary',
        'primary-fg',
        'surface',
        'surface-card',
        'surface-muted',
      ]);
    });

    it('surface vs ink reaches WCAG AAA (≥ 7.0) — target ~12.4:1', () => {
      const ratio = contrastRatio(paper.surface, paper.ink);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
      expect(ratio).toBeGreaterThanOrEqual(10.0);
    });

    it('surface vs ink-muted reaches WCAG AA (≥ 4.5) for secondary text', () => {
      const ratio = contrastRatio(paper.surface, paper['ink-muted']);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('surface vs border meets WCAG 1.4.11 non-text contrast (≥ 3.0)', () => {
      const ratio = contrastRatio(paper.surface, paper.border);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('primary vs primary-fg meets button text AA (≥ 4.5)', () => {
      const ratio = contrastRatio(paper.primary, paper['primary-fg']);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('ink theme', () => {
    const ink = loadThemeColors('ink');

    it('loads all 8 ink roles from tokens.css', () => {
      expect(Object.keys(ink)).toHaveLength(8);
    });

    it('surface vs ink reaches WCAG AAA (≥ 7.0) — target ~14:1', () => {
      const ratio = contrastRatio(ink.surface, ink.ink);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
      expect(ratio).toBeGreaterThanOrEqual(12.0);
    });

    it('surface vs ink-muted reaches WCAG AAA (≥ 7.0)', () => {
      const ratio = contrastRatio(ink.surface, ink['ink-muted']);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });

    it('surface vs border meets WCAG 1.4.11 (≥ 3.0)', () => {
      const ratio = contrastRatio(ink.surface, ink.border);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe('oled theme', () => {
    const oled = loadThemeColors('oled');

    it('loads all 8 oled roles from tokens.css', () => {
      expect(Object.keys(oled)).toHaveLength(8);
    });

    it('surface (true black) vs ink reaches WCAG AAA+ (≥ 7.0) — target ~18:1', () => {
      const ratio = contrastRatio(oled.surface, oled.ink);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
      expect(ratio).toBeGreaterThanOrEqual(15.0);
    });

    it('surface vs ink-muted reaches WCAG AAA (≥ 7.0)', () => {
      const ratio = contrastRatio(oled.surface, oled['ink-muted']);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });
  });

  describe('contrastRatio math sanity', () => {
    it('pure black vs pure white equals 21:1 (reference)', () => {
      const black: [number, number, number] = [0, 0, 0];
      const white: [number, number, number] = [1, 0, 0];
      const ratio = contrastRatio(black, white);
      expect(ratio).toBeGreaterThan(20.5);
      expect(ratio).toBeLessThanOrEqual(21.1);
    });

    it('identical colors have ratio 1.0', () => {
      const c: [number, number, number] = [0.5, 0.05, 180];
      expect(contrastRatio(c, c)).toBeCloseTo(1.0, 3);
    });
  });
});
