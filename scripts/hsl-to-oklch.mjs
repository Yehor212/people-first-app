#!/usr/bin/env node
/**
 * hsl-to-oklch — Phase 2-B design-token converter
 *
 * Pure JS HSL → OKLCH conversion with NO external dependencies. Keeps the
 * token generation pipeline self-contained and avoids adding culori/colord
 * to devDependencies (each would pull in 20-40 transitive packages).
 *
 * Math chain:
 *   HSL "h s% l%"
 *     → sRGB (0..1) via HSL-to-RGB
 *     → linear sRGB (gamma decode sRGB transfer function)
 *     → CIE XYZ (D65) via sRGB→XYZ matrix
 *     → Oklab via LMS cone response + cube root
 *     → OKLCH (L, C, H) with L, C rounded to 3dp, H to 1dp
 *
 * References:
 *   - Björn Ottosson, "A perceptual color space for image processing" (2020)
 *     https://bottosson.github.io/posts/oklab/
 *   - CSS Color Module Level 4 §10 (OKLab/OKLCH)
 *     https://www.w3.org/TR/css-color-4/#ok-lab
 *   - HSL→RGB: CSS Color Module Level 4 §6
 *
 * Usage:
 *   import { hslToOklch } from "./hsl-to-oklch.mjs";
 *   hslToOklch("240 5% 96%") → [0.970, 0.005, 256.3]
 */

// HSL "h s% l%" → sRGB [r, g, b] in 0..1
export function hslToSrgb(hslStr) {
  const m = String(hslStr).trim().match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/);
  if (!m) throw new Error(`hslToSrgb: expected "h s% l%", got "${hslStr}"`);
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

// sRGB channel 0..1 → linear sRGB via inverse gamma
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Linear sRGB [r, g, b] → Oklab [L, a, b]
// Matrix from Björn Ottosson's reference
export function linearSrgbToOklab([r, g, b]) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lr = Math.cbrt(l);
  const mr = Math.cbrt(m);
  const sr = Math.cbrt(s);

  return [
    0.2104542553 * lr + 0.793617785 * mr - 0.0040720468 * sr,
    1.9779984951 * lr - 2.428592205 * mr + 0.4505937099 * sr,
    0.0259040371 * lr + 0.7827717662 * mr - 0.808675766 * sr,
  ];
}

// Oklab [L, a, b] → OKLCH [L, C, H]
// H in degrees, 0..360
export function oklabToOklch([L, a, b]) {
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

/**
 * End-to-end: HSL "h s% l%" → [L, C, H] in OKLCH.
 * Rounds L,C to 3dp and H to 1dp for readable token output.
 */
export function hslToOklch(hslStr) {
  const srgb = hslToSrgb(hslStr);
  const linear = srgb.map(srgbToLinear);
  const oklab = linearSrgbToOklab(linear);
  const [L, C, H] = oklabToOklch(oklab);
  return [
    Math.round(L * 1000) / 1000,
    Math.round(C * 1000) / 1000,
    Math.round(H * 10) / 10,
  ];
}

// CLI mode: node scripts/hsl-to-oklch.mjs "240 5% 96%" → [0.97, 0.005, 256.3]
if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node hsl-to-oklch.mjs \"240 5% 96%\"");
    process.exit(1);
  }
  const result = hslToOklch(input);
  console.log(JSON.stringify(result));
}
