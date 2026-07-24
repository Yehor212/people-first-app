import { useSyncExternalStore } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useBatteryState } from "@/hooks/useBatteryState";
import {
  RUNTIME_PERFORMANCE_MODE_EVENT,
  isRuntimePerformanceLimited,
} from "@/observability/runtimePerformanceMode";
import type { ShouldAnimateOptions } from "@/lib/animationUtils";

const LOW_BATTERY_THRESHOLD = 0.15;

const subscribeRuntimePerformanceMode = (onStoreChange: () => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(RUNTIME_PERFORMANCE_MODE_EVENT, onStoreChange);
  return () => window.removeEventListener(RUNTIME_PERFORMANCE_MODE_EVENT, onStoreChange);
};

const getRuntimePerformanceSnapshot = () => isRuntimePerformanceLimited();
const getServerRuntimePerformanceSnapshot = () => false;

/**
 * Reactive source of truth for "should we animate right now?"
 *
 * AND-logic (WCAG 2.3.3 — Animation from Interactions, Law 9):
 *   1. The in-app Reduce motion preference must be OFF.
 *   2. OS `prefers-reduced-motion` must NOT be "reduce" (system accessibility kill-switch).
 *   3. Battery must NOT be critically low (<15%) AND NOT charging.
 *
 * Battery constraint is soft: `null` (API unsupported, e.g. Safari/iOS) counts
 * as "no signal → don't penalise". Charging devices bypass the threshold since
 * the power concern is removed.
 *
 * Use this hook inside React components/JSX. For non-React call sites
 * (audioManager, haptics, lifecycle functions), use `shouldAnimate()` from
 * `@/lib/animationUtils` — that module reads a static mirror of the same signal.
 */
export function useShouldAnimate(options: ShouldAnimateOptions = {}): boolean {
  const { respectRuntimePerformance = true } = options;
  const motionPreference = useMotionPreference();
  const osPrefersReduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const battery = useBatteryState();
  const runtimePerfLimited = useSyncExternalStore(
    subscribeRuntimePerformanceMode,
    getRuntimePerformanceSnapshot,
    getServerRuntimePerformanceSnapshot
  );

  const lowBattery = battery !== null && !battery.charging && battery.level < LOW_BATTERY_THRESHOLD;

  return (
    !motionPreference.reduceMotion &&
    !osPrefersReduce &&
    !lowBattery &&
    (!respectRuntimePerformance || !runtimePerfLimited)
  );
}
