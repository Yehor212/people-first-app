/**
 * Motion Verbs — typed vocabulary for UI actions.
 *
 * Every UI action maps to ONE verb. Never ad-hoc `initial/animate/exit` again.
 *
 *   bloom    open / appear / reveal
 *   fold     close / dismiss / hide
 *   morph    shared element (card ↔ editor, orb ↔ wheel)
 *   settle   drag release / layout settle
 *   breathe  idle pulse (orb, save indicator, recording dot)
 *   ripple   tap acknowledge (buttons, tap targets)
 *
 * Gate every verb usage through `useShouldAnimate()` (React) or
 * `shouldAnimate()` static mirror (non-React). See `gated()` helper below.
 */

import { bloom, bloomStatic } from './bloom';
import { fold, foldStatic } from './fold';
import { morph, morphTiming, withTransitionName } from './morph';
import { settle, settleStatic } from './settle';
import { breathe, breatheStatic } from './breathe';
import { createRipple, RIPPLE_DURATION_MS } from './ripple';
import { shouldAnimate } from '@/lib/animationUtils';

export const verbs = {
  bloom,
  bloomStatic,
  fold,
  foldStatic,
  morph,
  morphTiming,
  settle,
  settleStatic,
  breathe,
  breatheStatic,
  ripple: createRipple,
  rippleDurationMs: RIPPLE_DURATION_MS,
  withTransitionName,
} as const;

export type VerbName = keyof typeof verbs;

/**
 * Return `verb` when animations are permitted, otherwise `fallback`.
 *
 * Uses the static `shouldAnimate()` mirror — safe in non-React contexts.
 * For React components, prefer the hook-aware wrapper components
 * (`<Bloom>`, `<Fold>`, `<Breathe>`) which gate via `useShouldAnimate()`
 * so they re-render when settings change.
 *
 * @example
 *   const variant = gated(verbs.bloom, verbs.bloomStatic);
 */
export function gated<T, F>(verb: T, fallback: F): T | F {
  return shouldAnimate() ? verb : fallback;
}

// Individual re-exports for consumers that want one verb only.
export { bloom, bloomStatic, BLOOM_CSS_CLASS } from './bloom';
export { fold, foldStatic, FOLD_CSS_CLASS } from './fold';
export { morph, morphTiming, withTransitionName } from './morph';
export { settle, settleStatic } from './settle';
export { breathe, breatheStatic, BREATHE_CSS_CLASS } from './breathe';
export { createRipple, RIPPLE_DURATION_MS, RIPPLE_WAVE_CLASS } from './ripple';
export { easings, toCssBezier } from './easings';
export type { EasingName } from './easings';
export type { BloomVariant } from './bloom';
export type { FoldVariant } from './fold';
export type { MorphTiming } from './morph';
export type { SettleTransition } from './settle';
export type { BreatheVariant } from './breathe';
export type { RippleOptions } from './ripple';
