/**
 * Shared easing curves for the motion verb grammar.
 *
 * Each easing is a `cubic-bezier` 4-tuple compatible with:
 *   - Framer Motion `ease` prop (array form)
 *   - CSS `cubic-bezier(...)` (spread via `.join(",")`)
 *
 * Keep this file dependency-free — verb files and tests import from here.
 */

export const easings = {
  /** Bloom open — soft decelerate, generous final glide. cubic-bezier(0.2, 0.9, 0.2, 1). */
  bloomOut: [0.2, 0.9, 0.2, 1] as const,
  /** Fold close — fast-start ease-in. cubic-bezier(0.4, 0, 1, 1). */
  foldIn: [0.4, 0, 1, 1] as const,
  /** Morph shared element — expo ease-out, cinematic continuity. cubic-bezier(0.19, 1, 0.22, 1). */
  morphExpo: [0.19, 1, 0.22, 1] as const,
  /** Breathe idle — symmetric ease-in-out. cubic-bezier(0.4, 0, 0.6, 1). */
  breathe: [0.4, 0, 0.6, 1] as const,
  /** Ripple tap — linear, finite, no deceleration curve. */
  ripple: [0, 0, 1, 1] as const,
} as const;

export type EasingName = keyof typeof easings;

/** Format a 4-tuple easing as a CSS cubic-bezier() string. */
export function toCssBezier(easing: readonly [number, number, number, number]): string {
  return `cubic-bezier(${easing[0]}, ${easing[1]}, ${easing[2]}, ${easing[3]})`;
}
