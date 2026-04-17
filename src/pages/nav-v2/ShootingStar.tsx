/**
 * ShootingStar — Phase 3-A.3 A+++ WOW-3 (sparse cinematic flourish).
 *
 * Every 8–15 seconds a single star streaks across the upper third at 30° down,
 * 0.8–1.2s duration, then fades. Frequency is sparse on purpose — user should
 * think "wait, was that a shooting star?" not see constant motion (Calm / Stoic
 * reference). Silence is sacred — NO audio.
 *
 * Implementation:
 *   - One <div> with a CSS keyframe animation.
 *   - Key bump per scheduled firing to retrigger the animation.
 *   - Interval randomised via setTimeout + rescheduling on animation end.
 *
 * Gating:
 *   - useShouldAnimate() false → component renders nothing.
 *   - aria-hidden — decorative only, screen readers ignore.
 *   - pointer-events: none — does not intercept orb / slider input.
 *
 * Law 8 (60fps): transform + opacity only. Law 18: timer cleanup on unmount.
 */

import { useEffect, useState, memo } from "react";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import "./ShootingStar.css";

const MIN_INTERVAL_MS = 8_000;
const MAX_INTERVAL_MS = 15_000;

function randomInterval(): number {
  return (
    MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS)
  );
}

export const ShootingStar = memo(function ShootingStar() {
  const shouldAnimate = useShouldAnimate();
  const [fireCount, setFireCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldAnimate) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    const schedule = () => {
      timer = setTimeout(() => {
        if (!mounted) return;
        setFireCount((n) => n + 1);
        setVisible(true);
        // Hide after animation ends (max ~1.2s) and reschedule.
        timer = setTimeout(() => {
          if (!mounted) return;
          setVisible(false);
          schedule();
        }, 1_400);
      }, randomInterval());
    };

    schedule();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [shouldAnimate]);

  if (!shouldAnimate || !visible) return null;

  return (
    <div
      key={fireCount}
      aria-hidden="true"
      data-testid="shooting-star"
      className="shooting-star"
    />
  );
});
