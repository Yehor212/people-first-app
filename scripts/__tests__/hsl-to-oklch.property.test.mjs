/**
 * Property-based tests for HSL → OKLCH color math.
 *
 * Phase 2-B.1 foundation hardening — Police 2 finding 3:
 * scripts/hsl-to-oklch.mjs had only example tests; math drift undetectable
 * by existing suite. fast-check adds 100+ random-input runs per property
 * plus 3 Björn Ottosson reference points to catch regressions in the
 * HSL→sRGB→linear→Oklab→OKLCH pipeline.
 *
 * References:
 * - Björn Ottosson, "A perceptual color space for image processing" (2020)
 *   https://bottosson.github.io/posts/oklab/
 * - CSS Color Module Level 4 §10 (OKLab/OKLCH)
 *
 * Run: vitest run scripts/__tests__/hsl-to-oklch.property.test.mjs
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  hslToOklch,
  hslToSrgb,
  linearSrgbToOklab,
  oklabToOklch,
} from "../hsl-to-oklch.mjs";

/** HSL string builder for arbitrary integer inputs. */
const hslArb = fc.tuple(
  fc.integer({ min: 0, max: 359 }),
  fc.integer({ min: 0, max: 100 }),
  fc.integer({ min: 0, max: 100 }),
);

describe("hslToOklch — property-based", () => {
  it("always produces valid OKLCH for any HSL input", () => {
    fc.assert(
      fc.property(hslArb, ([h, s, l]) => {
        const [L, C, H] = hslToOklch(`${h} ${s}% ${l}%`);

        // L in [0, 1] with tiny floating tolerance
        expect(L).toBeGreaterThanOrEqual(-1e-9);
        expect(L).toBeLessThanOrEqual(1 + 1e-9);

        // Chroma non-negative
        expect(C).toBeGreaterThanOrEqual(-1e-9);

        // Hue in [0, 360]
        expect(H).toBeGreaterThanOrEqual(0);
        expect(H).toBeLessThanOrEqual(360);

        // All finite (no NaN / Infinity from edge-case gamut)
        expect(Number.isFinite(L)).toBe(true);
        expect(Number.isFinite(C)).toBe(true);
        expect(Number.isFinite(H)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("gray HSL (s=0) always has chroma ≈ 0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 359 }),
        fc.integer({ min: 0, max: 100 }),
        (h, l) => {
          const [, C] = hslToOklch(`${h} 0% ${l}%`);
          // Chroma of achromatic gray must collapse to ≤1e-3 (rounded 3dp output)
          expect(C).toBeLessThanOrEqual(1e-3);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("L increases monotonically with HSL lightness when s=0", () => {
    // Sanity: s=0 gray ramp — L should be non-decreasing in lightness
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 90 }),
        fc.integer({ min: 1, max: 10 }),
        (lStart, delta) => {
          const [L1] = hslToOklch(`0 0% ${lStart}%`);
          const [L2] = hslToOklch(`0 0% ${Math.min(100, lStart + delta)}%`);
          expect(L2).toBeGreaterThanOrEqual(L1 - 1e-6);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("pipeline is referentially transparent (same input → same output)", () => {
    fc.assert(
      fc.property(hslArb, ([h, s, l]) => {
        const a = hslToOklch(`${h} ${s}% ${l}%`);
        const b = hslToOklch(`${h} ${s}% ${l}%`);
        expect(a).toEqual(b);
      }),
      { numRuns: 50 },
    );
  });
});

describe("hslToOklch — Björn Ottosson reference points", () => {
  // Oracle: reference values computed via the canonical Ottosson reference
  // implementation (bottosson.github.io/posts/oklab/) for pure primaries.
  // Tolerance ±0.01 accounts for 3dp rounding of our implementation
  // plus any sub-ULP drift in JS Math.cbrt vs reference.

  it("pure red HSL 0 100% 50% → OKLCH L≈0.628, C≈0.258, H≈29.2", () => {
    const [L, C, H] = hslToOklch("0 100% 50%");
    expect(L).toBeCloseTo(0.628, 2);
    expect(C).toBeCloseTo(0.258, 2);
    expect(H).toBeCloseTo(29.2, 1);
  });

  it("pure green HSL 120 100% 50% → OKLCH L≈0.866, H≈142.5", () => {
    const [L, C, H] = hslToOklch("120 100% 50%");
    expect(L).toBeCloseTo(0.866, 2);
    expect(C).toBeGreaterThan(0.2); // strong green chroma
    expect(H).toBeCloseTo(142.5, 1);
  });

  it("pure blue HSL 240 100% 50% → OKLCH L≈0.452, C≈0.313, H≈264.1", () => {
    const [L, C, H] = hslToOklch("240 100% 50%");
    expect(L).toBeCloseTo(0.452, 2);
    expect(C).toBeCloseTo(0.313, 2);
    expect(H).toBeCloseTo(264.1, 1);
  });

  it("pure white HSL 0 0% 100% → OKLCH L≈1, C≈0", () => {
    const [L, C] = hslToOklch("0 0% 100%");
    expect(L).toBeCloseTo(1.0, 2);
    expect(C).toBeCloseTo(0, 2);
  });

  it("pure black HSL 0 0% 0% → OKLCH L≈0, C≈0", () => {
    const [L, C] = hslToOklch("0 0% 0%");
    expect(L).toBeCloseTo(0, 2);
    expect(C).toBeCloseTo(0, 2);
  });
});

describe("hslToOklch — sub-pipeline invariants", () => {
  it("hslToSrgb outputs in [0, 1] for all valid HSL", () => {
    fc.assert(
      fc.property(hslArb, ([h, s, l]) => {
        const rgb = hslToSrgb(`${h} ${s}% ${l}%`);
        for (const c of rgb) {
          expect(c).toBeGreaterThanOrEqual(-1e-9);
          expect(c).toBeLessThanOrEqual(1 + 1e-9);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("oklabToOklch polar conversion: C=sqrt(a²+b²)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: -0.5, max: 0.5, noNaN: true }),
        fc.double({ min: -0.5, max: 0.5, noNaN: true }),
        (L, a, b) => {
          const [, C] = oklabToOklch([L, a, b]);
          const expectedC = Math.sqrt(a * a + b * b);
          expect(C).toBeCloseTo(expectedC, 9);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("linearSrgbToOklab produces finite Oklab triples", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (r, g, b) => {
          const [L, a, bb] = linearSrgbToOklab([r, g, b]);
          expect(Number.isFinite(L)).toBe(true);
          expect(Number.isFinite(a)).toBe(true);
          expect(Number.isFinite(bb)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
