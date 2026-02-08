import { useEffect } from 'react';

/**
 * Locks body scroll when isLocked is true.
 * Preserves and restores scroll position on unlock.
 * Works on all platforms (web, Android via Capacitor).
 */
export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    const scrollY = window.scrollY;
    const originalStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      top: document.body.style.top,
    };

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    return () => {
      document.body.style.overflow = originalStyles.overflow;
      document.body.style.position = originalStyles.position;
      document.body.style.width = originalStyles.width;
      document.body.style.top = originalStyles.top;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}
