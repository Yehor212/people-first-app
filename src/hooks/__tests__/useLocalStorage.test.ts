import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock safeJsonParse
vi.mock('@/lib/safeJson', () => ({
  safeJsonParse: <T>(json: string, fallback: T): T => {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  },
}));

describe('useLocalStorage', () => {
  const DEBOUNCE_MS = 300;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ============================================
  // INITIAL VALUE
  // ============================================

  describe('initial value', () => {
    it('returns initial value when localStorage is empty', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      expect(result.current[0]).toBe('default');
    });

    it('returns stored value when localStorage has data', () => {
      localStorage.setItem('test-key', JSON.stringify('stored-value'));
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      expect(result.current[0]).toBe('stored-value');
    });

    it('returns initial value for invalid JSON in localStorage', () => {
      localStorage.setItem('test-key', 'not-valid-json');
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      expect(result.current[0]).toBe('default');
    });

    it('handles complex initial values', () => {
      const initial = { name: 'John', age: 30, hobbies: ['coding'] };
      const { result } = renderHook(() => useLocalStorage('user', initial));
      expect(result.current[0]).toEqual(initial);
    });

    it('handles array initial values', () => {
      const initial = [1, 2, 3];
      const { result } = renderHook(() => useLocalStorage('numbers', initial));
      expect(result.current[0]).toEqual(initial);
    });

    it('handles boolean initial values', () => {
      const { result } = renderHook(() => useLocalStorage('flag', true));
      expect(result.current[0]).toBe(true);
    });

    it('handles number initial values', () => {
      const { result } = renderHook(() => useLocalStorage('count', 42));
      expect(result.current[0]).toBe(42);
    });

    it('handles null initial value', () => {
      const { result } = renderHook(() => useLocalStorage('nullable', null));
      expect(result.current[0]).toBeNull();
    });
  });

  // ============================================
  // SET VALUE
  // ============================================

  describe('setValue', () => {
    it('updates state immediately', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('new-value');
      });

      expect(result.current[0]).toBe('new-value');
    });

    it('accepts function updater', () => {
      const { result } = renderHook(() => useLocalStorage('count', 0));

      act(() => {
        result.current[1](prev => prev + 1);
      });

      expect(result.current[0]).toBe(1);
    });

    it('writes to localStorage after debounce', async () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('new-value');
      });

      // Before debounce
      expect(localStorage.getItem('test-key')).toBeNull();

      // After debounce
      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });

      expect(localStorage.getItem('test-key')).toBe(JSON.stringify('new-value'));
    });

    it('debounces multiple rapid updates', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('value1');
        result.current[1]('value2');
        result.current[1]('value3');
      });

      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });

      // Only the last value should be written
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify('value3'));
    });

    it('updates complex objects', () => {
      const { result } = renderHook(() =>
        useLocalStorage('user', { name: 'John', age: 30 })
      );

      act(() => {
        result.current[1]({ name: 'Jane', age: 25 });
      });

      expect(result.current[0]).toEqual({ name: 'Jane', age: 25 });

      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });

      expect(JSON.parse(localStorage.getItem('user'))).toEqual({
        name: 'Jane',
        age: 25,
      });
    });

    it('handles array updates', () => {
      const { result } = renderHook(() => useLocalStorage('items', ['a', 'b']));

      act(() => {
        result.current[1](prev => [...prev, 'c']);
      });

      expect(result.current[0]).toEqual(['a', 'b', 'c']);
    });
  });

  // ============================================
  // KEY CHANGES
  // ============================================

  describe('key changes', () => {
    it('maintains initial key value after rerender', () => {
      // Note: This hook's useState initializer only runs once,
      // so changing the key prop doesn't re-read from localStorage.
      // This tests the actual behavior (not ideal but documented).
      localStorage.setItem('key1', JSON.stringify('value1'));
      localStorage.setItem('key2', JSON.stringify('value2'));

      const { result, rerender } = renderHook(
        ({ key }) => useLocalStorage(key, 'default'),
        { initialProps: { key: 'key1' } }
      );

      expect(result.current[0]).toBe('value1');

      // After rerender with new key, state persists from initial render
      // (this is a known limitation of this hook implementation)
      rerender({ key: 'key2' });

      // State doesn't change on key change - it's the same hook instance
      expect(result.current[0]).toBe('value1');
    });
  });

  // ============================================
  // ERROR HANDLING
  // ============================================

  describe('error handling', () => {
    it('handles localStorage.getItem errors gracefully', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

      expect(result.current[0]).toBe('default');

      getItemSpy.mockRestore();
    });

    it('handles localStorage.setItem errors gracefully', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      // Should not throw
      act(() => {
        result.current[1]('new-value');
      });

      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });

      // State should still be updated
      expect(result.current[0]).toBe('new-value');

      setItemSpy.mockRestore();
    });
  });

  // ============================================
  // UNMOUNT BEHAVIOR
  // ============================================

  describe('unmount', () => {
    it('flushes pending write on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      );

      act(() => {
        result.current[1]('pending-value');
      });

      // Value not yet written (debounce pending)
      expect(localStorage.getItem('test-key')).toBeNull();

      // Unmount triggers flush
      unmount();

      // Value should now be written
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify('pending-value'));
    });

    it('clears pending timeout on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { result, unmount } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      );

      act(() => {
        result.current[1]('new-value');
      });

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });

  // ============================================
  // TYPE SAFETY
  // ============================================

  describe('type safety', () => {
    it('preserves type through updates', () => {
      interface User {
        name: string;
        age: number;
      }

      const { result } = renderHook(() =>
        useLocalStorage<User>('user', { name: 'John', age: 30 })
      );

      // TypeScript would catch type errors here
      act(() => {
        result.current[1]({ name: 'Jane', age: 25 });
      });

      expect(result.current[0].name).toBe('Jane');
      expect(result.current[0].age).toBe(25);
    });

    it('handles union types', () => {
      const { result } = renderHook(() =>
        useLocalStorage<string | null>('nullable-string', null)
      );

      act(() => {
        result.current[1]('not null');
      });

      expect(result.current[0]).toBe('not null');

      act(() => {
        result.current[1](null);
      });

      expect(result.current[0]).toBeNull();
    });
  });
});
