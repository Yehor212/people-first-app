// Shared motion tokens and the non-React effective-motion gate.

import { getMotionPreference } from "@/lib/motionPreference";
import { isRuntimePerformanceLimited } from "@/observability/runtimePerformanceMode";

/**
 * Standard Framer Motion animation presets
 * Use these for consistent animations across the app.
 *
 * Usage with framer-motion:
 *   <motion.div {...motionPresets.fadeIn}>...</motion.div>
 *   <motion.div {...motionPresets.slideUp}>...</motion.div>
 */
export const motionPresets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.2 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: "easeOut" },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.2, ease: "easeOut" },
  },
  modalEnter: {
    initial: { opacity: 0, scale: 0.97, y: 4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { type: "spring", damping: 25, stiffness: 300 },
  },
} as const;

/**
 * ZenFlow Motion Tokens — standardized spring physics
 * Use these instead of ad-hoc { type: 'spring', stiffness: X, damping: Y }
 *
 * Usage:
 *   <motion.div transition={zenMotion.snappy}>
 *   <motion.div transition={zenMotion.gentle}>
 */
export const zenMotion = {
  /** No transition — accessibility/runtime fallback when effective motion is off. */
  instant: { duration: 0 },

  /** Quick response — buttons, toggles, checkboxes (150-200ms feel) */
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },

  /** Smooth entrance — cards, modals, panels (200-300ms feel) */
  gentle: { type: "spring" as const, stiffness: 260, damping: 25 },

  /** Bottom sheet slide — critically damped, one smooth motion */
  sheet: { type: "spring" as const, stiffness: 300, damping: 26 },

  /** Celebration — critically damped settle, no bounce (Apple Health: one smooth motion) */
  bouncy: { type: "spring" as const, stiffness: 300, damping: 26 },

  /** Exit — always fast, linear (modals closing, toasts dismissing) */
  exit: { duration: 0.15, ease: "easeIn" as const },

  /** Ambient — breathing, floating loops (slow, infinite) */
  breathing: {
    duration: 3,
    ease: "easeInOut" as const,
    repeat: Infinity,
    repeatType: "reverse" as const,
  },
} as const;

/**
 * ZenFlow Tap/Hover Tokens — standardized press feedback
 * Use these instead of ad-hoc whileTap={{ scale: X }}
 */
export const zenTap = {
  /** Standard buttons, FABs — moderate press */
  button: { scale: 0.96 },
  /** Cards, list items — subtle press (large surface) */
  card: { scale: 0.98 },
  /** Small icon buttons (close X, etc.) — Apple: max 5% */
  icon: { scale: 0.95 },
  /** Compact cells (MiniCheckmarkCell) — Apple: large surfaces barely compress */
  cell: { scale: 0.97 },
} as const;

export const zenHover = {
  /** Cards — barely perceptible hover (Apple: almost invisible) */
  lift: { scale: 1.01, y: 0 },
  /** Icon buttons — minimal glow scale (Apple: max 1%) */
  glow: { scale: 1.01 },
} as const;

/**
 * Module-level mirror of the "low battery" signal, written by the React
 * AnimationGate via `setLowBatteryMirror()`. Non-React call sites (audioManager,
 * haptics, lifecycle helpers) read it via `shouldAnimate()` without needing a
 * hook context.
 *
 * Default `false` — "no signal, do not block animations". Mirrors
 * `useBatteryState()` returning `null` on Safari/iOS.
 */
let lowBatteryMirror = false;

/**
 * AnimationGate pushes the current low-battery flag here on every change.
 * Not a public API for feature code — use `useShouldAnimate()` instead.
 */
export function setLowBatteryMirror(isLow: boolean): void {
  lowBatteryMirror = isLow;
}

/** Exposed for tests only. */
export function _getLowBatteryMirror(): boolean {
  return lowBatteryMirror;
}

/**
 * Check if animations should be shown.
 *
 * AND-logic (WCAG 2.3.3, Law 9):
 *   - The in-app Reduce motion preference must be OFF.
 *   - OS `prefers-reduced-motion` must NOT be "reduce".
 *   - `lowBatteryMirror` must be false.
 *   - Runtime performance guard must NOT be in startup/strained mode.
 *
 * Safe to call outside React — reads localStorage + matchMedia synchronously.
 */
export interface ShouldAnimateOptions {
  /**
   * Runtime perf guard is for decorative motion pressure. Canonical renderers
   * may opt out and reduce cadence instead of swapping visual systems.
   */
  respectRuntimePerformance?: boolean;
}

export function shouldAnimate(options: ShouldAnimateOptions = {}): boolean {
  const { respectRuntimePerformance = true } = options;
  if (getMotionPreference().reduceMotion) return false;
  if (respectRuntimePerformance && isRuntimePerformanceLimited()) return false;
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return false;
  }
  if (lowBatteryMirror) return false;
  return true;
}

/**
 * Apply or remove reduce-motion class on document body
 * Call this when effective motion inputs change.
 */
export function applyReduceMotionClass(): void {
  if (typeof document === "undefined") return;

  const animate = shouldAnimate();

  if (animate) {
    document.body.classList.remove("reduce-motion");
  } else {
    document.body.classList.add("reduce-motion");
  }
}
