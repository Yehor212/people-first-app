import { useState, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeJson';

const DEBOUNCE_MS = 300;

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    return safeLocalStorageGet<T>(key, initialValue);
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<T>(storedValue);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        // Flush pending write on unmount
        if (!safeLocalStorageSet(key, pendingValueRef.current)) {
          logger.error(`Error flushing localStorage key "${key}"`);
        }
      }
    };
  }, [key]);

  // Debounced write to localStorage
  useEffect(() => {
    pendingValueRef.current = storedValue;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (!safeLocalStorageSet(key, storedValue)) {
        logger.error(`Error setting localStorage key "${key}"`);
        // Emit storage error event for user notification
        window.dispatchEvent(new CustomEvent('zenflow:storage-error', {
          detail: {
            type: 'localStorage_write_failed',
            message: 'Unable to save data. You may be in Private Mode or storage is full.',
            key,
          }
        }));
      }
      timeoutRef.current = null;
    }, DEBOUNCE_MS);
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
