/**
 * useCountUp — Animate a number from previous to target value.
 *
 * Uses requestAnimationFrame for smooth 60fps interpolation.
 * Respects shouldAnimate() — returns target instantly if disabled.
 * Integer-only output (no decimal jitter).
 */

import { useEffect, useRef, useState } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';

/**
 * @param target - The number to animate towards
 * @param duration - Animation duration in ms (default 400)
 * @param from - Optional initial value on first mount (e.g., 0 to animate from zero)
 */
export function useCountUp(target: number, duration = 400, from?: number): number {
  const [display, setDisplay] = useState(from ?? target);
  const prevRef = useRef(from ?? target);
  const rafRef = useRef(0);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = target;

    if (!shouldAnimate() || prev === target) {
      setDisplay(target);
      return;
    }

    const start = performance.now();
    const diff = target - prev;

    function frame(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(prev + diff * eased));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}
