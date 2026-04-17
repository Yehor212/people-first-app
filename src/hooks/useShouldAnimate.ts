import { useDopamineSettings } from "@/components/DopamineSettings";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useBatteryState } from "@/hooks/useBatteryState";

const LOW_BATTERY_THRESHOLD = 0.15;

/**
 * Reactive source of truth for "should we animate right now?"
 *
 * AND-logic (WCAG 2.3.3 — Animation from Interactions, Law 9):
 *   1. Dopamine.animations must be ON (user in-app preference).
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
export function useShouldAnimate(): boolean {
  const dopamine = useDopamineSettings();
  const osPrefersReduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const battery = useBatteryState();

  const dopamineEnabled = dopamine.animations;
  const lowBattery =
    battery !== null && !battery.charging && battery.level < LOW_BATTERY_THRESHOLD;

  return dopamineEnabled && !osPrefersReduce && !lowBattery;
}
