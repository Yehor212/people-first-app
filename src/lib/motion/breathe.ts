/**
 * Breathe verb — idle pulse (orb at rest, save indicator, recording dot).
 *
 * Scale 1 → 1.015 → 1, opacity 0.88 → 1 → 0.88 over 4 seconds, infinite loop.
 * Ease-in-out for symmetric inhale/exhale feel. Subtle enough to never become
 * the focal point — it exists to prove the surface is "alive".
 *
 * IMPORTANT: Always pair with `useShouldAnimate()` gating. When reduced-motion
 * is on, battery is low, or app motion is off, consume `breatheStatic` instead so the
 * infinite animation does NOT run (GPU + accessibility).
 */

import { easings } from './easings';

export const breathe = {
  animate: { scale: [1, 1.015, 1], opacity: [0.88, 1, 0.88] },
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: easings.breathe,
  },
} as const;

/** Static fallback — MUST be used when `useShouldAnimate()` returns false. */
export const breatheStatic = {
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0 },
} as const;

/** Class name consumers apply for the CSS-only variant (non-React idle pulses). */
export const BREATHE_CSS_CLASS = 'zen-breathe';

export type BreatheVariant = typeof breathe;
