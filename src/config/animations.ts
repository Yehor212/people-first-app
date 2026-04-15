/**
 * Centralized Animation Configuration — Epic 6 (Telegram-Level Polish)
 *
 * All animation presets for the diary feature set.
 * Complements existing `zenMotion` in src/lib/animationUtils.ts.
 */

/** Spring physics presets for framer-motion transitions */
export const springs = {
  /** Quick response — buttons, toggles (150-200ms feel) */
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
  /** Fast entrance — cards appearing (200ms feel) */
  quick: { type: "spring" as const, stiffness: 300, damping: 25 },
  /** Smooth entrance — modals, panels (250-300ms feel) */
  smooth: { type: "spring" as const, stiffness: 260, damping: 25 },
  /** Bouncy — mood selection, celebratory (underdamped) */
  playful: { type: "spring" as const, stiffness: 200, damping: 15 },
  /** High energy — confetti trigger, milestone pulse */
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

/** Easing presets as cubic-bezier arrays for framer-motion */
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
