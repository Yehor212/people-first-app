import { useState, useEffect, useCallback, useRef } from 'react';
import { Table } from 'dexie';

interface UseIndexedDBOptions<T> {
  table: Table<any, string>;
  localStorageKey: string;
  initialValue: T;
  idField?: string;
}

export function useIndexedDB<T>({
  table,
  localStorageKey,
  initialValue,
  idField = 'id'
}: UseIndexedDBOptions<T>): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [data, setData] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const loadData = async () => {
      try {
        // For settings table with key field
        if (idField === 'key') {
          const record = await table.get(localStorageKey);
          if (record?.value !== undefined) {
            setData(record.value as T);
          } else {
            // Try localStorage fallback
            const stored = localStorage.getItem(localStorageKey);
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                setData(parsed as T);
                // Migrate to IndexedDB
                await table.put({ key: localStorageKey, value: parsed });
              } catch {
                // ignore
              }
            }
          }
        } else {
          // For array tables
          const records = await table.toArray();
          if (records.length > 0) {
            setData(records as T);
          } else {
            // Try localStorage fallback
            const stored = localStorage.getItem(localStorageKey);
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setData(parsed as T);
                  // Migrate to IndexedDB
                  await table.bulkPut(parsed);
                }
              } catch {
                // ignore
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading from IndexedDB:', error);
        // Fallback to localStorage
        const stored = localStorage.getItem(localStorageKey);
        if (stored) {
          try {
            setData(JSON.parse(stored) as T);
          } catch {
            // ignore
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [table, localStorageKey, idField]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setData(prev => {
      const newValue = typeof value === 'function' 
        ? (value as (prev: T) => T)(prev) 
        : value;

      // Save to IndexedDB
      (async () => {
        try {
          if (idField === 'key') {
            await table.put({ key: localStorageKey, value: newValue });
          } else if (Array.isArray(newValue)) {
            await table.clear();
            if (newValue.length > 0) {
              await table.bulkPut(newValue);
            }
          }
          // Also save to localStorage as backup
          localStorage.setItem(localStorageKey, JSON.stringify(newValue));
        } catch (error) {
          console.error('Error saving to IndexedDB:', error);
          localStorage.setItem(localStorageKey, JSON.stringify(newValue));
        }
      })();

      return newValue;
    });
  }, [table, localStorageKey, idField]);

  return [data, setValue, isLoading];
}
