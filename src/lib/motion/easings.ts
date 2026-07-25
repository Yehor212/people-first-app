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

  /* ------------------------------------------------------------------
   * Named easing tokens, aligned with the Material Design 3 motion
   * easing system (m3.material.io/styles/motion/easing-and-duration).
   * Direction rule: entering elements decelerate (fast start, soft
   * landing); exiting elements accelerate. Use these instead of
   * hardcoded cubic-bezier tuples at call sites.
   * ---------------------------------------------------------------- */

  /** M3 standard — transitions that begin and end on screen. cubic-bezier(0.2, 0, 0, 1). */
  standard: [0.2, 0, 0, 1] as const,
  /** M3 standard decelerate — elements entering the screen. cubic-bezier(0, 0, 0, 1). */
  standardDecelerate: [0, 0, 0, 1] as const,
  /** M3 standard accelerate — elements leaving the screen. cubic-bezier(0.3, 0, 1, 1). */
  standardAccelerate: [0.3, 0, 1, 1] as const,
  /** M3 emphasized decelerate — hero/emphasized entrances, soft landing. cubic-bezier(0.05, 0.7, 0.1, 1). */
  emphasizedDecelerate: [0.05, 0.7, 0.1, 1] as const,
  /** M3 emphasized accelerate — emphasized exits. cubic-bezier(0.3, 0, 0.8, 0.15). */
  emphasizedAccelerate: [0.3, 0, 0.8, 0.15] as const,
} as const;

export type EasingName = keyof typeof easings;

/** Format a 4-tuple easing as a CSS cubic-bezier() string. */
export function toCssBezier(easing: readonly [number, number, number, number]): string {
  return `cubic-bezier(${easing[0]}, ${easing[1]}, ${easing[2]}, ${easing[3]})`;
}
