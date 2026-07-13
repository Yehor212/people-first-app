/**
 * Choreography — staggered timing for a single "scene" of motion.
 *
 * The grammar's premise: when multiple elements animate together, their
 * entrances must be offset so the eye can parse the composition. Per the
 * Phase 2 rollout plan (§4.3), every surface follows the same five-stage
 * ladder:
 *
 *   background  0ms   — backdrop, base surface
 *   chrome      80ms  — nav, toolbar, header
 *   primary     140ms — the element the user tapped to get here
 *   secondary   220ms — supporting elements (lists, cards)
 *   cta         360ms — call-to-action buttons, last
 *
 * Numbers are in milliseconds. Framer Motion's `transition.delay` is in
 * seconds, so we divide by 1000 at the boundary.
 *
 * App/OS reduced-motion and low-battery paths return `{ duration: 0 }`
 * so the element appears instantly with no delay — same shape, zero motion.
 *
 * Consumers that cannot call a React hook (non-component contexts) use the
 * static `shouldAnimateStatic()` mirror from `@/lib/animationUtils`.
 */

import type { Transition } from 'framer-motion';
import { shouldAnimate } from '@/lib/animationUtils';

/** Stage ladder in milliseconds. Immutable. */
export const stages = {
  background: 0,
  chrome: 80,
  primary: 140,
  secondary: 220,
  cta: 360,
} as const;

export type Stage = keyof typeof stages;

/** True when the stage name is a valid key of `stages`. Type-guard. */
export function isStage(name: string): name is Stage {
  return Object.prototype.hasOwnProperty.call(stages, name);
}

/**
 * Return a Framer Motion `transition` object that applies the stage's delay.
 *
 * When animation is suppressed (app/OS reduced motion or low battery),
 * returns `{ duration: 0 }` so the element appears immediately.
 */
export function staggerDelay(stage: Stage): Transition {
  if (!shouldAnimate()) return { duration: 0 };
  return { delay: stages[stage] / 1000 };
}

/**
 * Stagger a group of children anchored at `baseStage`. Children animate
 * sequentially with 40ms between each and 20ms lead-in from the parent.
 *
 * Pair with Framer Motion `staggerChildren` on the parent's variants and
 * children variants that read `parent.delay` via `delayChildren`.
 */
export function childrenStagger(count: number, baseStage: Stage = 'secondary'): Transition {
  if (!shouldAnimate()) return { duration: 0 };
  // `count` is accepted for API symmetry and future per-count tuning;
  // current shape is uniform-stagger so count does not change the config.
  void count;
  return {
    delay: stages[baseStage] / 1000,
    staggerChildren: 0.04,
    delayChildren: 0.02,
  };
}

/** Human-readable ms → seconds helper for tests and call sites. */
export function stageSeconds(stage: Stage): number {
  return stages[stage] / 1000;
}
