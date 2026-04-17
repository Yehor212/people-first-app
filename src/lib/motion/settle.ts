/**
 * Settle verb — drag release / layout settle.
 *
 * Spring physics: stiffness 200, damping 24, mass 1. Perceived ~300ms.
 * Integrates with Framer Motion's `layoutId` / `layout` animation pipeline:
 *
 *   <motion.div layout transition={settle}>
 *
 * Custom tuning rather than reusing `springs.dragDrop` (damping:20 — too
 * loose for layout settle) — the spec calls for damping:24 for a crisper
 * hand-off. Exporting as a typed const so callers get autocomplete.
 */

export const settle = {
  type: 'spring',
  stiffness: 200,
  damping: 24,
  mass: 1,
} as const;

/** Identity fallback for reduced-motion — zero-duration linear tween. */
export const settleStatic = {
  duration: 0,
} as const;

export type SettleTransition = typeof settle;
