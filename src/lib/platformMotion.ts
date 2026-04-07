/**
 * Platform-adaptive animation easing (TD-CP)
 *
 * iOS: Spring physics with subtle overshoot (like UIKit)
 * Android: Material Design 3 standard easing
 * Desktop: Snappy, shorter durations
 *
 * Usage: import { platformMotion, getPlatformTransition } from '@/lib/platformMotion';
 *        <motion.div transition={getPlatformTransition('sheet')} />
 */
import { platform } from "./platform";

type SpringTransition = {
  type: "spring";
  damping: number;
  stiffness: number;
};

type TimedTransition = {
  duration: number;
  ease: readonly number[] | string;
};

type PlatformTransition = SpringTransition | TimedTransition;

interface PlatformMotionConfig {
  sheet: PlatformTransition;
  modal: PlatformTransition;
  tap: PlatformTransition;
  duration: { fast: number; normal: number; slow: number };
}

// iOS: Spring physics with subtle overshoot (like UIKit)
const iosMotion: PlatformMotionConfig = {
  sheet: { type: "spring", damping: 30, stiffness: 300 },
  modal: { type: "spring", damping: 25, stiffness: 250 },
  tap: { type: "spring", damping: 15, stiffness: 400 },
  duration: { fast: 0.25, normal: 0.35, slow: 0.5 },
};

// Android: Material Design 3 easing curves
const androidMotion: PlatformMotionConfig = {
  sheet: { duration: 0.3, ease: [0.2, 0, 0, 1] as const },
  modal: { duration: 0.3, ease: [0.2, 0, 0, 1] as const },
  tap: { duration: 0.15, ease: [0.2, 0, 0, 1] as const },
  duration: { fast: 0.2, normal: 0.3, slow: 0.4 },
};

// Desktop: Snappy, shorter durations
const desktopMotion: PlatformMotionConfig = {
  sheet: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
  modal: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
  tap: { duration: 0.1, ease: "easeOut" },
  duration: { fast: 0.12, normal: 0.2, slow: 0.3 },
};

export const platformMotion: PlatformMotionConfig =
  platform === "ios" ? iosMotion : platform === "android" ? androidMotion : desktopMotion;

/** Get Framer Motion transition for a specific animation type */
export function getPlatformTransition(
  type: "sheet" | "modal" | "tap" = "modal"
): PlatformTransition {
  return platformMotion[type];
}

export type { PlatformMotionConfig, PlatformTransition };
