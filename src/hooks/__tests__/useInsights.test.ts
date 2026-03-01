/**
 * useInsights Hook Tests
 * Tests insight generation and management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MoodEntry, Habit, FocusSession, Insight } from '@/types';
import { makeTestHabit, datesToEntries } from '@/test/habitFixtures';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock safeJson
vi.mock('@/lib/safeJson', () => ({
  safeJsonParse: vi.fn((str: string | null, defaultVal: unknown) => {
    if (!str) return defaultVal;
    try { return JSON.parse(str); } catch { return defaultVal; }
  }),
  safeLocalStorageGet: vi.fn((key: string, defaultVal: unknown) => {
    try {
      const str = localStorage.getItem(key);
      if (!str) return defaultVal;
      return JSON.parse(str);
    } catch { return defaultVal; }
  }),
  safeLocalStorageSet: vi.fn((key: string, value: unknown) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }),
  storageGetRaw: vi.fn((key: string, fallback = '') => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }),
  storageSetRaw: vi.fn((key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* */ }
  }),
  storageRemove: vi.fn((key: string) => {
    try { localStorage.removeItem(key); } catch { /* */ }
  }),
}));

// Mock insightsEngine
const mockGenerateInsights = vi.fn();
vi.mock('@/lib/insightsEngine', () => ({
  generateInsights: (...args: any[]) => mockGenerateInsights(...args),
}));

// Mock localStorage
let localStorageMock: Record<string, string> = {};

describe('useInsights', () => {
  const mockMoods: MoodEntry[] = [
    { id: '1', value: 4, date: '2024-01-15', timestamp: Date.now() },
    { id: '2', value: 3, date: '2024-01-14', timestamp: Date.now() },
  ];

  const mockHabits: Habit[] = [
    makeTestHabit({
      id: '1',
      name: 'Exercise',
      entries: datesToEntries(['2024-01-15']),
      createdAt: new Date('2024-01-01').getTime(),
    }),
  ];

  const mockFocusSessions: FocusSession[] = [
    {
      id: '1',
      duration: 25,
      completedAt: '2024-01-15T10:00:00Z',
      label: 'Work',
    },
  ];

  const mockInsights: Insight[] = [
    {
      id: 'insight1',
      type: 'mood-habit-correlation',
      title: 'Exercise boosts your mood',
      description: 'Your mood is higher on days you exercise',
      confidence: 0.8,
    },
    {
      id: 'insight2',
      type: 'focus-pattern',
      title: 'Best focus time',
      description: 'You focus best in the morning',
      confidence: 0.7,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock = {};

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key) => localStorageMock[key] || null
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key, value) => { localStorageMock[key] = value; }
    );
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      (key) => { delete localStorageMock[key]; }
    );

    mockGenerateInsights.mockReturnValue(mockInsights);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('generates insights from data', async () => {
      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
        })
      );

      expect(mockGenerateInsights).toHaveBeenCalledWith(
        mockMoods,
        mockHabits,
        mockFocusSessions,
        undefined // translations parameter (optional)
      );
      expect(result.current.insights).toEqual(mockInsights);
    });

    it('returns empty array when no data', async () => {
      mockGenerateInsights.mockReturnValue([]);

      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: [],
          habits: [],
          focusSessions: [],
        })
      );

      expect(result.current.insights).toEqual([]);
    });

    it('handles generation errors gracefully', async () => {
      mockGenerateInsights.mockImplementation(() => {
        throw new Error('Generation failed');
      });

      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
        })
      );

      expect(result.current.insights).toEqual([]);
    });
  });

  describe('hasEnoughData', () => {
    it('returns true when moods >= 7', async () => {
      const manyMoods = Array(7).fill(null).map((_, i) => ({
        id: String(i),
        value: 4,
        date: `2024-01-${i + 1}`,
        timestamp: Date.now(),
      }));

      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: manyMoods,
          habits: [],
          focusSessions: [],
        })
      );

      expect(result.current.hasEnoughData).toBe(true);
    });

    it('returns true when habits >= 1', async () => {
      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: [],
          habits: mockHabits,
          focusSessions: [],
        })
      );

      expect(result.current.hasEnoughData).toBe(true);
    });

    it('returns true when focusSessions >= 3', async () => {
      const manySessions = Array(3).fill(mockFocusSessions[0]);

      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: [],
          habits: [],
          focusSessions: manySessions,
        })
      );

      expect(result.current.hasEnoughData).toBe(true);
    });

    it('returns false when not enough data', async () => {
      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: [mockMoods[0]], // Only 1 mood
          habits: [],
          focusSessions: [],
        })
      );

      expect(result.current.hasEnoughData).toBe(false);
    });
  });

  describe('dismissInsight', () => {
    it('removes insight from visible list', async () => {
      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
        })
      );

      expect(result.current.insights).toHaveLength(2);

      act(() => {
        result.current.dismissInsight('insight1');
      });

      expect(result.current.insights).toHaveLength(1);
      expect(result.current.insights[0].id).toBe('insight2');
    });

    it('saves dismissed to localStorage', async () => {
      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
        })
      );

      act(() => {
        result.current.dismissInsight('insight1');
      });

      expect(localStorageMock['zenflow-insights-dismissed']).toBe(
        JSON.stringify(['insight1'])
      );
    });

    it('preserves insight in allInsights', async () => {
      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
        })
      );

      act(() => {
        result.current.dismissInsight('insight1');
      });

      expect(result.current.allInsights).toHaveLength(2);
    });

    it('updates dismissedCount', async () => {
      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
        })
      );

      expect(result.current.dismissedCount).toBe(0);

      act(() => {
        result.current.dismissInsight('insight1');
      });

      expect(result.current.dismissedCount).toBe(1);
    });
  });

  describe('clearDismissed', () => {
    it('restores all insights', async () => {
      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
        })
      );

      // Dismiss one by one (state updates need separate acts)
      act(() => {
        result.current.dismissInsight('insight1');
      });

      act(() => {
        result.current.dismissInsight('insight2');
      });

      expect(result.current.insights).toHaveLength(0);

      act(() => {
        result.current.clearDismissed();
      });

      expect(result.current.insights).toHaveLength(2);
    });

    it('removes from localStorage', async () => {
      localStorageMock['zenflow-insights-dismissed'] = '["insight1"]';

      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
        })
      );

      act(() => {
        result.current.clearDismissed();
      });

      expect(localStorageMock['zenflow-insights-dismissed']).toBeUndefined();
    });
  });

  describe('insightsByType', () => {
    it('categorizes insights correctly', async () => {
      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
        })
      );

      expect(result.current.insightsByType.habits).toHaveLength(1);
      expect(result.current.insightsByType.focus).toHaveLength(1);
      expect(result.current.insightsByType.timing).toHaveLength(0);
    });
  });

  describe('topInsight', () => {
    it('returns first insight', async () => {
      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
        })
      );

      expect(result.current.topInsight).toEqual(mockInsights[0]);
    });

    it('returns null when no insights', async () => {
      mockGenerateInsights.mockReturnValue([]);

      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: [],
          habits: [],
          focusSessions: [],
        })
      );

      expect(result.current.topInsight).toBeNull();
    });
  });

  describe('status values', () => {
    it('returns correct counts', async () => {
      const { useInsights } = await import('../useInsights');
      const { result } = renderHook(() =>
        useInsights({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
        })
      );

      expect(result.current.totalGenerated).toBe(2);
      expect(result.current.visibleCount).toBe(2);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('memoization', () => {
    it('regenerates insights when data changes', async () => {
      const { useInsights } = await import('../useInsights');
      const { result: _result, rerender } = renderHook(
        ({ moods }) =>
          useInsights({
            moods,
            habits: mockHabits,
            focusSessions: mockFocusSessions,
          }),
        { initialProps: { moods: mockMoods } }
      );

      expect(mockGenerateInsights).toHaveBeenCalledTimes(1);

      const newMoods = [...mockMoods, { id: '3', value: 5, date: '2024-01-16', timestamp: Date.now() }];
      rerender({ moods: newMoods });

      expect(mockGenerateInsights).toHaveBeenCalledTimes(2);
    });
  });
});
