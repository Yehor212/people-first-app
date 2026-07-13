/**
 * Morph verb — shared element transition (card ↔ editor, orb ↔ wheel).
 *
 * Consumes the existing `transition()` wrapper from src/lib/viewTransitions.ts
 * which already handles reduced-motion, API-missing fallback (Firefox, older
 * Safari) and effective-motion gating. We add only the verb-level semantics:
 * intended duration (420ms) + cinematic ease-out-expo feel.
 *
 * The DURATION + EASING for Morph are communicated to CSS via verbs.css
 * (`::view-transition-group(name)` rules). The `transition()` wrapper itself
 * is API-orchestration only.
 */

import { transition, withTransitionName } from '@/lib/viewTransitions';
import { easings } from './easings';

/**
 * Run a DOM mutation inside a View Transition with the Morph timing applied
 * by the global verbs.css stylesheet (via `::view-transition-*(name)`).
 *
 * @param name - Unique transition name; the element you pair must carry a
 *               matching `view-transition-name` (set via `withTransitionName`).
 * @param fn   - The state/DOM mutation.
 */
export async function morph(name: string, fn: () => void | Promise<void>): Promise<void> {
  await transition(fn, { name });
}

/** Re-export for a single call site: `import { morph, withTransitionName }`. */
export { withTransitionName };

/** Morph timing constants — surfaced for tests + CSS sync. */
export const morphTiming = {
  durationMs: 420,
  ease: easings.morphExpo,
} as const;

export type MorphTiming = typeof morphTiming;
