/**
 * Bloom verb — open / appear / reveal.
 *
 * Semantics: a surface materialises. Scale from 0.92, opacity 0→1,
 * small y-lift (8px → 0). Decelerate easing, 320ms.
 *
 * Use for: modal/sheet open, new item entrance, reveal on tap.
 * CSS variant uses `@starting-style` for non-React mount transitions
 * (e.g. native `popover` attribute).
 */

import { easings } from './easings';

export const bloom = {
  initial: { scale: 0.92, opacity: 0, y: 8 },
  animate: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 0.96, opacity: 0, y: 8 },
  transition: { duration: 0.32, ease: easings.bloomOut },
} as const;

/** Identity fallback for reduced-motion. Same shape, zero-duration, no transform offset. */
export const bloomStatic = {
  initial: { scale: 1, opacity: 1, y: 0 },
  animate: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 1, opacity: 0, y: 0 },
  transition: { duration: 0 },
} as const;

/** Class name consumers apply to opt into the CSS @starting-style variant. */
export const BLOOM_CSS_CLASS = 'zen-bloom';

export type BloomVariant = typeof bloom;
