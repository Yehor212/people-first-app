/**
 * Fold verb — close / dismiss / hide.
 *
 * Semantics: a surface recedes. Mirror of Bloom but with ease-in (fast-start).
 * Exit-focused verb — `animate` is the "about to leave" state.
 *
 * Use for: modal/sheet close, delete gesture, dismissal.
 */

import { easings } from './easings';

export const fold = {
  initial: { scale: 1, opacity: 1, y: 0 },
  animate: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 0.96, opacity: 0, y: 8 },
  transition: { duration: 0.24, ease: easings.foldIn },
} as const;

/** Identity fallback for reduced-motion. Opacity-only exit. */
export const foldStatic = {
  initial: { scale: 1, opacity: 1, y: 0 },
  animate: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 1, opacity: 0, y: 0 },
  transition: { duration: 0 },
} as const;

export const FOLD_CSS_CLASS = 'zen-fold';

export type FoldVariant = typeof fold;
