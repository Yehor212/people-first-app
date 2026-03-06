import { useEffect } from 'react';

/**
 * Reference-counted scroll lock.
 * Multiple components can lock simultaneously — body is only unlocked
 * when ALL consumers release their lock. Prevents the "stuck body" bug
 * when nested modals (parent + child) both call useScrollLock.
 */

let lockCount = 0;
let savedScrollY = 0;
let savedStyles: {
  overflow: string;
  position: string;
  width: string;
  top: string;
} | null = null;

function lock() {
  lockCount++;
  if (lockCount === 1) {
    // First lock — save original state and apply
    savedScrollY = window.scrollY;
    savedStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      top: document.body.style.top,
    };
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${savedScrollY}px`;
  }
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && savedStyles) {
    // Last unlock — restore original state
    document.body.style.overflow = savedStyles.overflow;
    document.body.style.position = savedStyles.position;
    document.body.style.width = savedStyles.width;
    document.body.style.top = savedStyles.top;
    window.scrollTo(0, savedScrollY);
    savedStyles = null;
  }
}

export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    lock();
    return () => unlock();
  }, [isLocked]);
}
