/**
 * Readability contrast contract — shadcn/zf HSL bridge tokens (WCAG 2.2 AA).
 *
 * Complements themes.contrast.test.ts (OKLCH design tokens) by pinning the
 * cascade-resolved HSL pairs that real V2 surfaces render with:
 *   - muted/helper text (--zf-text-muted) on page and card surfaces
 *   - accent text (--primary) on nav item surface and page background
 *   - warning foreground (--zf-warning-foreground) on tinted cards
 *   - input boundaries (--input) vs card (WCAG 1.4.11 non-text ≥ 3.0)
 *
 * Cascade resolution mirrors the shipped order documented in
 * src/styles/themes.css (Task #39): :root → .dark / .dark.oled (@layer base,
 * index.css) → un-layered :root[data-theme=...] bridges (themes.css win).
 *
 * Evidence baseline (2026-07-25 audit, output/readability-audit/):
 *   paper zf-text-muted/bg 3.69, paper primary/nav-item 4.29,
 *   paper warning-text 1.63, ink zf-text-muted/card 4.46, inputs 1.43–2.05.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// HSL color math (WCAG 2.x §1.4.3)
// ---------------------------------------------------------------------------

type Hsl = [number, number, number];

function hslToLinearRgb([h, s, l]: Hsl): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  const hue = ((h % 360) + 360) % 360;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return [lin(r + m), lin(g + m), lin(b + m)];
}

function luminance(hsl: Hsl): number {
  const [r, g, b] = hslToLinearRgb(hsl);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: Hsl, bg: Hsl): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ---------------------------------------------------------------------------
// Cascade-resolving CSS var parser
// ---------------------------------------------------------------------------

const THEMES_CSS = readFileSync(join(__dirname, 'themes.css'), 'utf-8');
const INDEX_CSS = readFileSync(join(__dirname, '..', 'index.css'), 'utf-8');

type VarMap = Map<string, string>;

function collectVars(css: string, selectorPattern: RegExp): VarMap {
  const vars: VarMap = new Map();
  for (const match of css.matchAll(selectorPattern)) {
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let i = bodyStart;
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    const body = css.slice(bodyStart, i - 1);
    for (const decl of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      vars.set(decl[1], decl[2].trim());
    }
  }
  return vars;
}

function mergeInto(base: VarMap, overlay: VarMap): VarMap {
  const next = new Map(base);
  for (const [k, v] of overlay) next.set(k, v);
  return next;
}

const HSL_VALUE = /^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/;

function resolveHsl(vars: VarMap, name: string): Hsl {
  let current = vars.get(name);
  for (let hop = 0; hop < 8; hop += 1) {
    if (current === undefined) {
      throw new Error(`CSS var ${name} is not defined in the resolved theme map`);
    }
    const literal = current.match(HSL_VALUE);
    if (literal) {
      return [parseFloat(literal[1]), parseFloat(literal[2]), parseFloat(literal[3])];
    }
    const ref = current.match(/^var\((--[a-z0-9-]+)\)$/i);
    if (!ref) {
      throw new Error(`CSS var ${name} resolves to non-HSL value: ${current}`);
    }
    current = vars.get(ref[1]);
  }
  throw new Error(`CSS var ${name} has a var() cycle`);
}

function themeVars(theme: 'paper' | 'ink' | 'oled'): VarMap {
  const root = collectVars(INDEX_CSS, /^:root\s*\{/gm);
  let scoped = root;
  if (theme === 'ink') {
    scoped = mergeInto(scoped, collectVars(INDEX_CSS, /^\s*\.dark\s*\{/gm));
  }
  if (theme === 'oled') {
    scoped = mergeInto(scoped, collectVars(INDEX_CSS, /^\s*\.dark\.oled\s*\{/gm));
  }
  // Un-layered :root[data-theme="..."] bridges in themes.css win (Cascade L5).
  scoped = mergeInto(
    scoped,
    collectVars(THEMES_CSS, new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{`, 'g')),
  );
  return scoped;
}

// ---------------------------------------------------------------------------
// Contract: every pair must hold WCAG 2.2 AA in every shipped theme
// ---------------------------------------------------------------------------

const AA_TEXT = 4.5;
const AA_NONTEXT = 3.0;

interface Pair {
  fg: string;
  bg: string;
  min: number;
  label: string;
}

const PAIRS: Pair[] = [
  { fg: '--zf-text-muted', bg: '--background', min: AA_TEXT, label: 'helper text on page' },
  { fg: '--zf-text-muted', bg: '--card', min: AA_TEXT, label: 'helper text on card' },
  { fg: '--primary', bg: '--nav-v2-item-surface', min: AA_TEXT, label: 'active bottom-nav tab label' },
  { fg: '--primary', bg: '--background', min: AA_TEXT, label: 'accent/link text on page' },
  { fg: '--primary-foreground', bg: '--primary', min: AA_TEXT, label: 'primary button text' },
  { fg: '--zf-warning-foreground', bg: '--card', min: AA_TEXT, label: 'warning text on tinted card' },
  { fg: '--zf-role-focus-foreground', bg: '--card', min: AA_TEXT, label: 'focus accent text on tint' },
  { fg: '--zf-role-rest-foreground', bg: '--card', min: AA_TEXT, label: 'rest accent text on tint' },
  { fg: '--zf-role-energy-foreground', bg: '--card', min: AA_TEXT, label: 'energy accent text on tint' },
  { fg: '--zf-role-body-foreground', bg: '--card', min: AA_TEXT, label: 'body accent text on tint' },
  { fg: '--zf-role-gratitude-foreground', bg: '--card', min: AA_TEXT, label: 'gratitude accent text on tint' },
  { fg: '--zf-role-space-foreground', bg: '--card', min: AA_TEXT, label: 'space accent text on tint' },
  { fg: '--zf-growth-foreground', bg: '--card', min: AA_TEXT, label: 'growth accent text on tint' },
  { fg: '--zf-trace-foreground', bg: '--card', min: AA_TEXT, label: 'trace accent text on tint' },
  { fg: '--zf-memory-foreground', bg: '--card', min: AA_TEXT, label: 'memory accent text on tint' },
  { fg: '--muted-foreground', bg: '--background', min: AA_TEXT, label: 'secondary text on page' },
  { fg: '--foreground', bg: '--background', min: AA_TEXT, label: 'body text on page' },
  { fg: '--input', bg: '--card', min: AA_NONTEXT, label: 'input boundary (1.4.11)' },
];

describe('Readability contrast contract (WCAG 2.2 AA, cascade-resolved)', () => {
  for (const theme of ['paper', 'ink', 'oled'] as const) {
    describe(`${theme} theme`, () => {
      const vars = themeVars(theme);
      for (const pair of PAIRS) {
        it(`${pair.label}: ${pair.fg} on ${pair.bg} ≥ ${pair.min}:1`, () => {
          const ratio = contrast(resolveHsl(vars, pair.fg), resolveHsl(vars, pair.bg));
          expect(ratio).toBeGreaterThanOrEqual(pair.min);
        });
      }
    });
  }

  it('sanity: pure white vs pure black equals 21:1', () => {
    expect(contrast([0, 0, 100], [0, 0, 0])).toBeGreaterThan(20.9);
  });
});
