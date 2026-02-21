/**
 * useKeyboardShift — Detects virtual keyboard appearance via visualViewport
 * and returns the offset (px) needed to shift content upward.
 *
 * Returns 0 when keyboard is hidden. Returns positive value when visible.
 */

import { useState, useEffect } from 'react';

export function useKeyboardShift(enabled: boolean): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setOffset(0);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // Difference between window height and viewport height = keyboard height
      const keyboardHeight = window.innerHeight - vv.height;
      setOffset(keyboardHeight > 50 ? keyboardHeight : 0);
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);

    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, [enabled]);

  return offset;
}
