import { useCallback, useRef } from 'react';

/**
 * Returns a throttled version of the callback that can only fire once
 * within the specified delay period. Prevents double-taps and rapid clicks.
 *
 * @param callback - The function to throttle
 * @param delay - Minimum time between invocations in ms (default: 1000)
 */
export function useThrottledCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay: number = 1000
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callbackRef.current(...args);
    }
  }, [delay]);
}
