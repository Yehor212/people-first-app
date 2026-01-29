import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { safeJsonParse } from '@/lib/safeJson';

const DEBOUNCE_MS = 300;

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? safeJsonParse<T>(item, initialValue) : initialValue;
    } catch (error) {
      logger.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<T>(storedValue);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        // Flush pending write on unmount
        try {
          window.localStorage.setItem(key, JSON.stringify(pendingValueRef.current));
        } catch (error) {
          logger.error(`Error flushing localStorage key "${key}":`, error);
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
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        logger.error(`Error setting localStorage key "${key}":`, error);
      }
      timeoutRef.current = null;
    }, DEBOUNCE_MS);
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
