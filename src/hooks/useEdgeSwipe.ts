import { useEffect, useRef, useCallback } from 'react';
import { hapticTap } from '@/lib/haptics';

interface UseEdgeSwipeOptions {
  enabled: boolean;
  edgeWidth?: number;
  threshold?: number;
  velocityThreshold?: number;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  isRTL?: boolean;
}

const isAndroid = /android/i.test(navigator.userAgent);
const ANDROID_BACK_ZONE = 35;

function isInsideHorizontalScroll(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null;
  while (node && node !== document.body) {
    const ox = getComputedStyle(node).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth > node.clientWidth) return true;
    node = node.parentElement;
  }
  return false;
}

export function useEdgeSwipe(options: UseEdgeSwipeOptions): void {
  const {
    enabled,
    edgeWidth = 20,
    threshold = 50,
    velocityThreshold = 0.3,
    onSwipeRight,
    onSwipeLeft,
    isRTL = false,
  } = options;

  const touch = useRef<{ x: number; y: number; t: number; edge: 'left' | 'right' } | null>(null);

  const onStart = useCallback(
    (e: TouchEvent) => {
      if (isInsideHorizontalScroll(e.target)) return;
      const x = e.touches[0].clientX;
      const w = window.innerWidth;
      const fromLeft = x <= edgeWidth;
      const fromRight = x >= w - edgeWidth;
      if (!fromLeft && !fromRight) return;
      if (isAndroid) {
        if (fromLeft && x < ANDROID_BACK_ZONE) return;
        if (fromRight && x > w - ANDROID_BACK_ZONE) return;
      }
      touch.current = { x, y: e.touches[0].clientY, t: Date.now(), edge: fromLeft ? 'left' : 'right' };
    },
    [edgeWidth],
  );

  const onEnd = useCallback(
    (e: TouchEvent) => {
      const start = touch.current;
      if (!start) return;
      touch.current = null;
      const end = e.changedTouches[0];
      const dx = end.clientX - start.x;
      const dy = end.clientY - start.y;
      if (Math.abs(dy) > Math.abs(dx)) return; // vertical-dominant
      const dist = Math.abs(dx);
      const velocity = dist / (Date.now() - start.t || 1);
      if (dist < threshold && velocity < velocityThreshold) return;

      const swipedRight = dx > 0;
      const expandDir = isRTL ? !swipedRight : swipedRight;

      if (expandDir) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
      void hapticTap();
    },
    [threshold, velocityThreshold, isRTL, onSwipeRight, onSwipeLeft],
  );

  useEffect(() => {
    if (!enabled) return;
    const opts: AddEventListenerOptions = { passive: true };
    document.addEventListener('touchstart', onStart, opts);
    document.addEventListener('touchend', onEnd, opts);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [enabled, onStart, onEnd]);
}
