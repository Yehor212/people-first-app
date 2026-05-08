/**
 * MoodSliderV2 pure helpers — Phase 3-A.4c-ii-d-d.
 *
 * Extracted from MoodSliderV2.tsx to keep the view file under the 400-LOC
 * god-component threshold. Contains only pure functions + constants (no
 * React, no DOM, no side effects beyond localStorage read/write).
 *
 * Why split:
 *  - Testable in isolation (no RTL, no mocks).
 *  - Reusable from other slider-flavoured components without importing
 *    the React memo wrapper.
 *  - Keeps the view file focused on rendering + event wiring.
 */

import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

/** Canonical valence stops (5 snaps: very-unpleasant → very-pleasant). */
export const SNAP_STOPS = [-1, -0.5, 0, 0.5, 1] as const;

/** 5 literary mood label i18n keys (reused from d-a picker). */
export const LABEL_KEYS = [
  "moodVeryUnpleasant",
  "moodUnpleasant",
  "moodNeutral",
  "moodPleasant",
  "moodVeryPleasant",
] as const;

/** 5 Aurora tint hues: memory violet -> trace cyan -> seafoam -> growth. */
export const TINT_HUES = [300, 235, 175, 145, 155] as const;

/** Lightness + chroma tables for OKLCH handle-hue interpolation. */
export const TINT_L = [0.62, 0.68, 0.74, 0.72, 0.76] as const;
export const TINT_C = [0.1, 0.09, 0.08, 0.08, 0.09] as const;

/** English fallbacks — used when an i18n key resolves empty. */
export const LABEL_FALLBACK = [
  "Very unpleasant",
  "Unpleasant",
  "Neutral",
  "Pleasant",
  "Very pleasant",
] as const;

/** localStorage key for the "last committed valence" ghost marker. */
export const STORAGE_KEY = SK.MOOD_SLIDER_V2_LAST_COMMIT;

/** Clamp a raw number to the valence domain [-1, 1]. */
export const clamp = (v: number): number => Math.max(-1, Math.min(1, v));

/** Linear interpolation between two numbers. */
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/** Given a valence in [-1, 1], return the index of the nearest snap stop. */
export function nearestStopIndex(v: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < SNAP_STOPS.length; i++) {
    const d = Math.abs(SNAP_STOPS[i] - v);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * Interpolate OKLCH across the 5 stops for the current valence. Returns a
 * CSS color string. Safe to write to a custom prop; browsers without oklch()
 * support still render the fallback gradient on the track.
 *
 * Hue interpolation is a straight lerp across the Aurora rail; no warm stop is
 * used for ordinary mood input.
 */
export function handleOklch(valence: number): string {
  const pos = ((valence + 1) / 2) * (SNAP_STOPS.length - 1);
  const lo = Math.max(0, Math.min(SNAP_STOPS.length - 2, Math.floor(pos)));
  const hi = lo + 1;
  const t = Math.max(0, Math.min(1, pos - lo));
  const L = lerp(TINT_L[lo], TINT_L[hi], t);
  const C = lerp(TINT_C[lo], TINT_C[hi], t);
  const H = lerp(TINT_HUES[lo], TINT_HUES[hi], t);
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
}

/** Read the last committed valence from localStorage (safe failure). */
export function readLastCommit(): number | null {
  const raw = storageGetRaw(STORAGE_KEY, "");
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed)) return null;
  return clamp(parsed);
}

/** Persist the committed valence to localStorage (safe failure). */
export function writeLastCommit(v: number): void {
  storageSetRaw(STORAGE_KEY, v.toString());
}
