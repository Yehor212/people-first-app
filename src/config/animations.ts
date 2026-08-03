/**
 * Centralized Animation Configuration — Epic 6 (Telegram-Level Polish)
 *
 * Diary-scoped presets. The canonical spring/easing source of truth is
 * `zenMotion` (src/lib/animationUtils.ts) + `easings` (src/lib/motion/easings.ts);
 * identical values below are aliases, not copies — tune them there.
 * Diary-specific tokens (quick/playful/explosive) stay local to this file.
 *
 * Units note: `durations` and `stagger.perItem` are MILLISECONDS, while
 * framer-motion `duration`/`delay` props and `stagger.delayForIndex()`
 * return SECONDS. Convert at the call site (`/ 1000`).
 */

import { zenMotion } from "@/lib/animationUtils";

/** Spring physics presets for framer-motion transitions */
export const springs = {
  /** Quick response — buttons, toggles. Alias of `zenMotion.snappy`. */
  snappy: zenMotion.snappy,
  /** Fast entrance — cards appearing (200ms feel). Diary-specific. */
  quick: { type: "spring" as const, stiffness: 300, damping: 25 },
  /** Smooth entrance — modals, panels. Alias of `zenMotion.gentle`. */
  smooth: zenMotion.gentle,
  /** Bouncy — mood selection, celebratory (underdamped). Diary-specific. */
  playful: { type: "spring" as const, stiffness: 200, damping: 15 },
  /** High energy — confetti trigger, milestone pulse. Diary-specific. */
  explosive: { type: "spring" as const, stiffness: 600, damping: 15 },
} as const;

/** Duration presets in milliseconds */
export const durations = {
  /** Micro feedback — haptic companion (100ms) */
  micro: 100,
  /** Fast transition — fade in/out (200ms) */
  fast: 200,
  /** Normal transition — standard animations (300ms) */
  normal: 300,
  /** Slow transition — emphasis animations (500ms) */
  slow: 500,
  /** Celebration — confetti, milestone (800ms) */
  celebration: 800,
} as const;

/** Easing presets as cubic-bezier arrays for framer-motion.
 * Legacy diary set — prefer the M3-aligned `easings` from `@/lib/motion`
 * for new code (enter≈standardDecelerate, exit≈standardAccelerate,
 * smooth≈standard; overshoot has no M3 equivalent). */
export const easings = {
  /** Enter — decelerate into view */
  enter: [0.0, 0.0, 0.2, 1.0] as const,
  /** Exit — accelerate out of view */
  exit: [0.4, 0.0, 1.0, 1.0] as const,
  /** Overshoot — slight bounce past target */
  overshoot: [0.34, 1.56, 0.64, 1.0] as const,
  /** Smooth — standard ease in-out */
  smooth: [0.4, 0.0, 0.2, 1.0] as const,
} as const;

/** Stagger configuration for list animations */
export const stagger = {
  /** Delay per item in milliseconds */
  perItem: 40,
  /** Maximum items to stagger (items beyond this appear instantly) */
  maxItems: 5,
  /** Calculate total stagger duration for n items */
  total: (n: number): number => Math.min(n, 5) * 40,
  /** Calculate delay for a specific index (0 for items beyond cap) */
  delayForIndex: (index: number): number => (index < 5 ? index * 0.04 : 0),
} as const;
