/**
 * useStatsCalculations Hook Tests
 * Tests stats calculation logic extracted from StatsPage
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStatsCalculations } from '../useStatsCalculations';

// Mock dependencies
vi.mock('@/lib/utils', () => ({
  calculateStreak: vi.fn((dates: string[]) => {
    if (dates.length === 0) return 0;
    // Simple mock: return count of consecutive days ending today
    const today = new Date().toISOString().split('T')[0];
    if (!dates.includes(today)) return 0;
    return Math.min(dates.length, 7);
  }),
  getToday: vi.fn(() => '2026-02-03'),
  parseLocalDate: vi.fn((dateStr: string) => new Date(dateStr)),
}));

vi.mock('@/lib/habits', () => ({
  getHabitCompletedDates: vi.fn((habit: any) => habit.completedDates || []),
}));

vi.mock('@/lib/emotionConstants', () => ({
  getEmotionScore: vi.fn((emotion: string, _intensity?: number) => {
    const scores: Record<string, number> = {
      joy: 5,
      peace: 4,
      power: 4,
      surprise: 3,
      sadness: 2,
      fear: 2,
      anger: 2,
      disgust: 1,
    };
    return scores[emotion] || 3;
  }),
  MOOD_TO_EMOTION_MAP: {
    great: 'joy',
    good: 'peace',
    okay: 'surprise',
    bad: 'sadness',
    terrible: 'disgust',
  },
}));

describe('useStatsCalculations', () => {
  const defaultProps = {
    moods: [],
    habits: [],
    focusSessions: [],
    gratitudeEntries: [],
    restDays: [],
    currentFocusMinutes: 0,
    range: 'month' as const,
    selectedTag: 'all',
    monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  };

  describe('stats calculation', () => {
    it('returns zero stats for empty data', () => {
      const { result } = renderHook(() => useStatsCalculations(defaultProps));

      expect(result.current.stats.totalFocusMinutes).toBe(0);
      expect(result.current.stats.totalHabitCompletions).toBe(0);
      expect(result.current.stats.thisMonthMoods).toBe(0);
    });

    it('calculates focus minutes correctly', () => {
      const props = {
        ...defaultProps,
        focusSessions: [
          { id: '1', date: '2026-02-03', duration: 25, status: 'completed' },
          { id: '2', date: '2026-02-03', duration: 30, status: 'completed' },
          { id: '3', date: '2026-02-02', duration: 15, status: 'aborted' }, // Should be excluded
        ],
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.completedFocusSessions).toHaveLength(2);
      expect(result.current.stats.allTimeFocusMinutes).toBe(55); // 25 + 30
    });

    it('includes current focus minutes', () => {
      const props = {
        ...defaultProps,
        focusSessions: [
          { id: '1', date: '2026-02-03', duration: 25, status: 'completed' },
        ],
        currentFocusMinutes: 10,
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.stats.allTimeFocusMinutes).toBe(35); // 25 + 10
    });

    it('counts habit completions', () => {
      const props = {
        ...defaultProps,
        habits: [
          { id: '1', name: 'Exercise', completedDates: ['2026-02-01', '2026-02-02', '2026-02-03'] },
          { id: '2', name: 'Read', completedDates: ['2026-02-03'] },
        ],
        range: 'all' as const,
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.stats.totalHabitCompletions).toBe(4);
    });

    it('counts mood entries', () => {
      const props = {
        ...defaultProps,
        moods: [
          { id: '1', date: '2026-02-03', mood: 'great', tags: [] },
          { id: '2', date: '2026-02-02', mood: 'good', tags: [] },
          { id: '3', date: '2026-02-01', mood: 'okay', tags: [] },
        ],
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.stats.moodCounts.great).toBe(1);
      expect(result.current.stats.moodCounts.good).toBe(1);
      expect(result.current.stats.moodCounts.okay).toBe(1);
    });

    it('maps legacy moods to emotions', () => {
      const props = {
        ...defaultProps,
        moods: [
          { id: '1', date: '2026-02-03', mood: 'great', tags: [] },
          { id: '2', date: '2026-02-02', mood: 'terrible', tags: [] },
        ],
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.stats.emotionCounts.joy).toBe(1);
      expect(result.current.stats.emotionCounts.disgust).toBe(1);
    });
  });

  describe('filtered moods', () => {
    it('filters by tag', () => {
      const props = {
        ...defaultProps,
        moods: [
          { id: '1', date: '2026-02-03', mood: 'great', tags: ['work'] },
          { id: '2', date: '2026-02-02', mood: 'good', tags: ['home'] },
        ],
        selectedTag: 'work',
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.filteredMoods).toHaveLength(1);
      expect(result.current.filteredMoods[0].tags).toContain('work');
    });

    it('returns all moods when tag is "all"', () => {
      const props = {
        ...defaultProps,
        moods: [
          { id: '1', date: '2026-02-03', mood: 'great', tags: ['work'] },
          { id: '2', date: '2026-02-02', mood: 'good', tags: ['home'] },
        ],
        selectedTag: 'all',
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.filteredMoods).toHaveLength(2);
    });
  });

  describe('premium stats', () => {
    it('calculates mood score average', () => {
      const props = {
        ...defaultProps,
        moods: [
          { id: '1', date: '2026-02-03', mood: 'great', tags: [] }, // 5
          { id: '2', date: '2026-02-02', mood: 'good', tags: [] },  // 4
          { id: '3', date: '2026-02-01', mood: 'okay', tags: [] },  // 3
        ],
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.premiumStats.moodScore).toBe(4); // (5+4+3)/3
    });

    it('returns default mood score for empty data', () => {
      const { result } = renderHook(() => useStatsCalculations(defaultProps));

      expect(result.current.premiumStats.moodScore).toBe(3);
    });

    it('calculates week score', () => {
      const props = {
        ...defaultProps,
        moods: [
          { id: '1', date: '2026-02-03', mood: 'great', tags: [] },
        ],
        habits: [
          { id: '1', name: 'Exercise', completedDates: ['2026-02-03'] },
        ],
        focusSessions: [
          { id: '1', date: '2026-02-03', duration: 60, status: 'completed' },
        ],
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.premiumStats.weekScore).toBeGreaterThan(0);
    });

    it('returns current mood', () => {
      const props = {
        ...defaultProps,
        moods: [
          { id: '1', date: '2026-02-01', mood: 'bad', tags: [] },
          { id: '2', date: '2026-02-03', mood: 'great', tags: [] }, // Latest
        ],
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.premiumStats.currentMood).toBe('great');
    });
  });

  describe('mood insights', () => {
    it('returns null insights for empty data', () => {
      const { result } = renderHook(() => useStatsCalculations(defaultProps));

      expect(result.current.moodInsights.bestDay).toBeNull();
      expect(result.current.moodInsights.focusAvg).toBeNull();
      expect(result.current.moodInsights.habitDiffs).toHaveLength(0);
    });

    it('calculates best day', () => {
      const props = {
        ...defaultProps,
        moods: [
          { id: '1', date: '2026-02-03', mood: 'great', tags: [] }, // Monday
          { id: '2', date: '2026-02-03', mood: 'great', tags: [] }, // Monday
          { id: '3', date: '2026-02-02', mood: 'okay', tags: [] },  // Sunday
        ],
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.moodInsights.bestDay).not.toBeNull();
      expect(result.current.moodInsights.bestDay?.avg).toBeGreaterThan(0);
    });
  });

  describe('date mappings', () => {
    it('creates moodsByDate map', () => {
      const props = {
        ...defaultProps,
        moods: [
          { id: '1', date: '2026-02-03', mood: 'great', tags: [] },
          { id: '2', date: '2026-02-03', mood: 'good', tags: [] },
          { id: '3', date: '2026-02-02', mood: 'okay', tags: [] },
        ],
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.moodsByDate['2026-02-03']).toHaveLength(2);
      expect(result.current.moodsByDate['2026-02-02']).toHaveLength(1);
    });

    it('creates focusMinutesByDate map', () => {
      const props = {
        ...defaultProps,
        focusSessions: [
          { id: '1', date: '2026-02-03', duration: 25, status: 'completed' },
          { id: '2', date: '2026-02-03', duration: 30, status: 'completed' },
        ],
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.focusMinutesByDate['2026-02-03']).toBe(55);
    });

    it('creates gratitudeByDate map', () => {
      const props = {
        ...defaultProps,
        gratitudeEntries: [
          { id: '1', date: '2026-02-03', text: 'Grateful 1' },
          { id: '2', date: '2026-02-03', text: 'Grateful 2' },
        ],
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.gratitudeByDate['2026-02-03']).toHaveLength(2);
    });

    it('creates habitCompletionMap', () => {
      const props = {
        ...defaultProps,
        habits: [
          { id: '1', name: 'Exercise', completedDates: ['2026-02-03'] },
          { id: '2', name: 'Read', completedDates: ['2026-02-03', '2026-02-02'] },
        ],
      };

      const { result } = renderHook(() => useStatsCalculations(props));

      expect(result.current.habitCompletionMap['2026-02-03']).toContain('Exercise');
      expect(result.current.habitCompletionMap['2026-02-03']).toContain('Read');
      expect(result.current.habitCompletionMap['2026-02-02']).toContain('Read');
    });
  });
});
