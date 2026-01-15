import { useState, useEffect, useCallback, useRef } from 'react';
import { Table } from 'dexie';

// Event emitter for cross-hook data refresh
type RefreshListener = () => void;
const refreshListeners = new Set<RefreshListener>();

export const triggerDataRefresh = () => {
  console.log('[useIndexedDB] Triggering data refresh for all hooks');
  refreshListeners.forEach(listener => listener());
};

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
  const [refreshCounter, setRefreshCounter] = useState(0);
  const initializedRef = useRef(false);

  // Load data function (used both on init and refresh)
  const loadData = useCallback(async (isInitialLoad = false) => {
    try {
      // For settings table with key field
      if (idField === 'key') {
        const record = await table.get(localStorageKey);
        if (record?.value !== undefined) {
          setData(record.value as T);
        } else if (isInitialLoad) {
          // Try localStorage fallback only on initial load
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
        } else if (isInitialLoad) {
          // Try localStorage fallback only on initial load
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
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, [table, localStorageKey, idField]);

  // Initial load
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    loadData(true);
  }, [loadData]);

  // Subscribe to refresh events
  useEffect(() => {
    const handleRefresh = () => {
      setRefreshCounter(c => c + 1);
    };
    refreshListeners.add(handleRefresh);
    return () => {
      refreshListeners.delete(handleRefresh);
    };
  }, []);

  // Reload data when refresh is triggered
  useEffect(() => {
    if (refreshCounter > 0) {
      loadData(false);
    }
  }, [refreshCounter, loadData]);

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
