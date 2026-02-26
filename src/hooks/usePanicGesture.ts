/**
 * usePanicGesture — Detects 3-finger swipe down to trigger instant lock.
 *
 * Used in the diary editor for privacy protection.
 * When user swipes down with 3+ fingers, fires onPanic callback.
 */

import { useEffect, useRef } from 'react';

const SWIPE_THRESHOLD = 80; // px

export function usePanicGesture(enabled: boolean, onPanic: () => void) {
  const onPanicRef = useRef(onPanic);
  onPanicRef.current = onPanic;

  useEffect(() => {
    if (!enabled) return;

    let startY = 0;
    let triggered = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 3) {
        startY = e.touches[0].clientY;
        triggered = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (triggered) return;
      if (e.touches.length >= 3 && e.touches[0].clientY - startY > SWIPE_THRESHOLD) {
        triggered = true;
        onPanicRef.current();
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, [enabled]);
}
