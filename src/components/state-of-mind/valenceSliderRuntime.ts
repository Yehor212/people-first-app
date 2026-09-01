import { useLayoutEffect, useRef } from 'react';
import type { Translations } from '@/i18n/types';

export interface ValenceSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export const TRACK_HEIGHT = 8;
export const THUMB_SIZE = 28;
export const TOUCH_PADDING = 10;
export const KEYBOARD_COMMIT_DELAY_MS = 90;

export const SNAP_POSITIONS = [-1.0, -0.667, -0.333, 0.0, 0.333, 0.667, 1.0] as const;

export const SNAP_LABELS: (keyof Translations)[] = [
  'somVeryUnpleasant',
  'somUnpleasant',
  'somSlightlyUnpleasant',
  'somNeutral',
  'somSlightlyPleasant',
  'somPleasant',
  'somVeryPleasant',
];

export function nearestSnapIndex(value: number): number {
  let best = 0;
  let bestDistance = Math.abs(value - SNAP_POSITIONS[0]);
  for (let index = 1; index < SNAP_POSITIONS.length; index += 1) {
    const distance = Math.abs(value - SNAP_POSITIONS[index]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

export function useValenceLabelAnimation(label: string) {
  const labelSurfaceRef = useRef<HTMLSpanElement>(null);
  const previousLabelRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (previousLabelRef.current === null) {
      previousLabelRef.current = label;
      return;
    }
    if (previousLabelRef.current === label) return;
    previousLabelRef.current = label;

    const labelSurface = labelSurfaceRef.current;
    const reducedMotion =
      document.body.classList.contains('reduce-motion') ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!labelSurface || reducedMotion || typeof labelSurface.animate !== 'function') return;

    const animation = labelSurface.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 200,
      easing: 'ease-out',
    });
    return () => animation.cancel();
  }, [label]);

  return labelSurfaceRef;
}
