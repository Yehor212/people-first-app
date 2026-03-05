import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MoodEntry, MoodType, Habit, FocusSession, GratitudeEntry } from '@/types';
import { makeTestHabit, datesToEntries } from '@/test/habitFixtures';

// ============================================
// MOCKS
// ============================================

vi.mock('@/lib/validation', () => ({
  safeAverage: vi.fn((values: number[]) => {
    if (!values || values.length === 0) return 0;
    return values.reduce((a: number, b: number) => a + b, 0) / values.length;
  }),
}));

import {
  generateWeeklyInsights,
  hasEnoughDataForWeeklyInsights,
} from '../weeklyInsights';

// ============================================
// HELPERS
// ============================================

const makeMood = (mood: MoodType, date: string): MoodEntry => ({
  id: `mood-${date}-${mood}`,
  mood,
  date,
  timestamp: new Date(`${date}T12:00:00`).getTime(),
});

const makeHabit = (
  id: string,
  name: string,
  completedDates: string[],
  icon: string = '🏃'
): Habit => makeTestHabit({
  id,
  name,
  icon,
  color: 8,
  entries: datesToEntries(completedDates),
  createdAt: new Date('2020-01-01').getTime(),
});

const makeFocusSession = (date: string, duration: number, status: 'completed' | 'aborted' = 'completed'): FocusSession => ({
  id: `focus-${date}-${duration}`,
  duration,
  date,
  completedAt: new Date(`${date}T12:00:00`).getTime(),
  status,
});

const makeGratitude = (date: string): GratitudeEntry => ({
  id: `gratitude-${date}`,
  text: 'Grateful for today',
  date,
  timestamp: new Date(`${date}T12:00:00`).getTime(),
});

/**
 * Return Mon-Sun dates for the week containing the faked "today".
 * Requires vi.useFakeTimers() to be active.
 */
function getThisWeekDates(): string[] {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Return Mon-Sun dates for the previous week.
 */
function getPrevWeekDates(): string[] {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + diffToMonday);
  thisMonday.setHours(0, 0, 0, 0);

  const prevMonday = new Date(thisMonday);
  prevMonday.setDate(thisMonday.getDate() - 7);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(prevMonday);
    d.setDate(prevMonday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// ============================================
// TESTS
// ============================================

describe('weeklyInsights', () => {
  beforeEach(() => {
    // Wednesday, Feb 18, 2026 at noon
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // hasEnoughDataForWeeklyInsights
  // ============================================
  describe('hasEnoughDataForWeeklyInsights', () => {
    it('should return false with completely empty data', () => {
      const result = hasEnoughDataForWeeklyInsights([], [], []);
      expect(result).toBe(false);
    });

    it('should return true with 2+ moods in current week', () => {
      const weekDates = getThisWeekDates();
      const moods = [
        makeMood('good', weekDates[0]),
        makeMood('great', weekDates[1]),
      ];
      const result = hasEnoughDataForWeeklyInsights(moods, [], []);
      expect(result).toBe(true);
    });

    it('should return false with only 1 mood and no habits/focus', () => {
      const weekDates = getThisWeekDates();
      const moods = [makeMood('good', weekDates[0])];
      const result = hasEnoughDataForWeeklyInsights(moods, [], []);
      expect(result).toBe(false);
    });

    it('should return true when habit has completions this week', () => {
      const weekDates = getThisWeekDates();
      const habits = [makeHabit('h1', 'Exercise', [weekDates[0]])];
      const result = hasEnoughDataForWeeklyInsights([], habits, []);
      expect(result).toBe(true);
    });

    it('should return false when habit completions are outside current week', () => {
      const habits = [makeHabit('h1', 'Exercise', ['2025-01-01'])];
      const result = hasEnoughDataForWeeklyInsights([], habits, []);
      expect(result).toBe(false);
    });

    it('should return true with 1+ focus sessions this week', () => {
      const weekDates = getThisWeekDates();
      const focus = [makeFocusSession(weekDates[0], 25)];
      const result = hasEnoughDataForWeeklyInsights([], [], focus);
      expect(result).toBe(true);
    });
  });

  // ============================================
  // generateWeeklyInsights — structure
  // ============================================
  describe('generateWeeklyInsights — structure', () => {
    it('should return correct top-level structure', () => {
      const result = generateWeeklyInsights([], [], []);
      expect(result).toHaveProperty('currentWeek');
      expect(result).toHaveProperty('previousWeek');
      expect(result).toHaveProperty('comparison');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('highlights');
      expect(result).toHaveProperty('weekNumber');
    });

    it('should include weekNumber as a positive integer', () => {
      const result = generateWeeklyInsights([], [], []);
      expect(result.weekNumber).toBeGreaterThan(0);
      expect(Number.isInteger(result.weekNumber)).toBe(true);
    });

    it('should return null previousWeek when no previous week data', () => {
      const weekDates = getThisWeekDates();
      const moods = weekDates.map(d => makeMood('good', d));
      const result = generateWeeklyInsights(moods, [], []);
      expect(result.previousWeek).toBeNull();
    });

    it('should return null comparison when no previous week data', () => {
      const weekDates = getThisWeekDates();
      const moods = weekDates.map(d => makeMood('good', d));
      const result = generateWeeklyInsights(moods, [], []);
      expect(result.comparison).toBeNull();
    });
  });

  // ============================================
  // generateWeeklyInsights — stats calculation
  // ============================================
  describe('generateWeeklyInsights — stats', () => {
    it('should calculate correct moodAverage', () => {
      const weekDates = getThisWeekDates();
      // good=4, great=5 => average = 4.5
      const moods = [
        makeMood('good', weekDates[0]),
        makeMood('great', weekDates[1]),
      ];
      const result = generateWeeklyInsights(moods, [], []);
      expect(result.currentWeek.moodAverage).toBe(4.5);
      expect(result.currentWeek.moodCount).toBe(2);
    });

    it('should calculate correct habitCompletionRate', () => {
      const weekDates = getThisWeekDates();
      // 1 habit, 3 out of 7 days completed = 3/7 ~ 43%
      const habits = [makeHabit('h1', 'Exercise', weekDates.slice(0, 3))];
      const result = generateWeeklyInsights([], habits, []);
      expect(result.currentWeek.habitCompletionRate).toBe(43); // Math.round(3/7*100) = 43
      expect(result.currentWeek.habitsCompleted).toBe(3);
    });

    it('should calculate correct focusMinutes excluding aborted sessions', () => {
      const weekDates = getThisWeekDates();
      const focus = [
        makeFocusSession(weekDates[0], 25, 'completed'),
        makeFocusSession(weekDates[1], 30, 'completed'),
        makeFocusSession(weekDates[2], 15, 'aborted'),
      ];
      const result = generateWeeklyInsights([], [], focus);
      expect(result.currentWeek.focusMinutes).toBe(55); // 25 + 30
      expect(result.currentWeek.focusSessions).toBe(2);
    });

    it('should count gratitude entries for current week', () => {
      const weekDates = getThisWeekDates();
      const gratitude = weekDates.slice(0, 4).map(d => makeGratitude(d));
      const result = generateWeeklyInsights([], [], [], gratitude);
      expect(result.currentWeek.gratitudeCount).toBe(4);
    });

    it('should detect best and worst day', () => {
      const weekDates = getThisWeekDates();
      const moods = [
        makeMood('great', weekDates[0]),
        makeMood('terrible', weekDates[1]),
        makeMood('good', weekDates[2]),
      ];
      const result = generateWeeklyInsights(moods, [], []);
      expect(result.currentWeek.bestDay).toBe(weekDates[0]);
      expect(result.currentWeek.worstDay).toBe(weekDates[1]);
    });

    it('should return zero stats for empty data', () => {
      const result = generateWeeklyInsights([], [], []);
      expect(result.currentWeek.moodAverage).toBe(0);
      expect(result.currentWeek.moodCount).toBe(0);
      expect(result.currentWeek.habitsCompleted).toBe(0);
      expect(result.currentWeek.focusMinutes).toBe(0);
      expect(result.currentWeek.gratitudeCount).toBe(0);
    });
  });

  // ============================================
  // generateWeeklyInsights — week comparison
  // ============================================
  describe('generateWeeklyInsights — comparison', () => {
    it('should detect improving trend when current week is better', () => {
      const thisWeek = getThisWeekDates();
      const prevWeek = getPrevWeekDates();

      const moods = [
        // Current week: great moods
        ...thisWeek.map(d => makeMood('great', d)),
        // Previous week: bad moods
        ...prevWeek.map(d => makeMood('bad', d)),
      ];

      const habits = [makeHabit('h1', 'Exercise', [...thisWeek, ...prevWeek.slice(0, 1)])];
      const focus = [
        ...thisWeek.map(d => makeFocusSession(d, 30)),
        ...prevWeek.slice(0, 1).map(d => makeFocusSession(d, 5)),
      ];

      const result = generateWeeklyInsights(moods, habits, focus);
      expect(result.comparison).not.toBeNull();
      expect(result.comparison.trend).toBe('improving');
    });

    it('should detect declining trend when current week is worse', () => {
      const thisWeek = getThisWeekDates();
      const prevWeek = getPrevWeekDates();

      const moods = [
        // Current week: bad moods
        ...thisWeek.map(d => makeMood('bad', d)),
        // Previous week: great moods
        ...prevWeek.map(d => makeMood('great', d)),
      ];

      const habits = [makeHabit('h1', 'Exercise', [...prevWeek, ...thisWeek.slice(0, 1)])];
      const focus = [
        ...prevWeek.map(d => makeFocusSession(d, 60)),
        ...thisWeek.slice(0, 1).map(d => makeFocusSession(d, 5)),
      ];

      const result = generateWeeklyInsights(moods, habits, focus);
      expect(result.comparison).not.toBeNull();
      expect(result.comparison.trend).toBe('declining');
    });

    it('should detect stable trend when weeks are similar', () => {
      const thisWeek = getThisWeekDates();
      const prevWeek = getPrevWeekDates();

      const moods = [
        ...thisWeek.map(d => makeMood('good', d)),
        ...prevWeek.map(d => makeMood('good', d)),
      ];

      const result = generateWeeklyInsights(moods, [], []);
      expect(result.comparison).not.toBeNull();
      expect(result.comparison.trend).toBe('stable');
    });

    it('should have previousWeek populated when previous week has data', () => {
      const thisWeek = getThisWeekDates();
      const prevWeek = getPrevWeekDates();
      const moods = [
        ...thisWeek.map(d => makeMood('good', d)),
        ...prevWeek.map(d => makeMood('okay', d)),
      ];

      const result = generateWeeklyInsights(moods, [], []);
      expect(result.previousWeek).not.toBeNull();
      expect(result.previousWeek.moodCount).toBe(7);
    });
  });

  // ============================================
  // generateWeeklyInsights — recommendations
  // ============================================
  describe('generateWeeklyInsights — recommendations', () => {
    it('should recommend mood attention when mood is low', () => {
      const weekDates = getThisWeekDates();
      const moods = [
        makeMood('terrible', weekDates[0]),
        makeMood('bad', weekDates[1]),
        makeMood('bad', weekDates[2]),
      ];

      const result = generateWeeklyInsights(moods, [], []);
      const moodRec = result.recommendations.find(r => r.id === 'low-mood-week');
      expect(moodRec).toBeDefined();
      expect(moodRec.type).toBe('mood');
      expect(moodRec.priority).toBe('high');
    });

    it('should recommend focus boost when focus time is low', () => {
      const weekDates = getThisWeekDates();
      // Less than 60 minutes and fewer than 3 sessions
      const focus = [makeFocusSession(weekDates[0], 20)];

      const result = generateWeeklyInsights([], [], focus);
      const focusRec = result.recommendations.find(r => r.id === 'low-focus');
      expect(focusRec).toBeDefined();
      expect(focusRec.type).toBe('focus');
    });

    it('should recommend gratitude when count is low', () => {
      const result = generateWeeklyInsights([], [], [], []);
      const gratitudeRec = result.recommendations.find(r => r.id === 'more-gratitude');
      expect(gratitudeRec).toBeDefined();
      expect(gratitudeRec.type).toBe('general');
    });

    it('should celebrate perfect week when habit rate >= 90%', () => {
      const weekDates = getThisWeekDates();
      // 1 habit completed all 7 days = 100%
      const habits = [makeHabit('h1', 'Exercise', weekDates)];

      const result = generateWeeklyInsights([], habits, []);
      const perfectRec = result.recommendations.find(r => r.id === 'perfect-week');
      expect(perfectRec).toBeDefined();
      expect(perfectRec.type).toBe('habit');
    });

    it('should sort recommendations by priority (high first)', () => {
      const weekDates = getThisWeekDates();
      const moods = [
        makeMood('terrible', weekDates[0]),
        makeMood('bad', weekDates[1]),
        makeMood('bad', weekDates[2]),
      ];
      const focus = [makeFocusSession(weekDates[0], 10)];

      const result = generateWeeklyInsights(moods, [], focus);
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      for (let i = 1; i < result.recommendations.length; i++) {
        const prev = priorityOrder[result.recommendations[i - 1].priority];
        const curr = priorityOrder[result.recommendations[i].priority];
        expect(prev).toBeLessThanOrEqual(curr);
      }
    });

    it('should return at most 5 recommendations', () => {
      const weekDates = getThisWeekDates();
      const prevWeek = getPrevWeekDates();
      // Create data that triggers many recommendations
      const moods = [
        ...weekDates.map(d => makeMood('terrible', d)),
        ...prevWeek.map(d => makeMood('great', d)),
      ];
      const habits = [
        makeHabit('h1', 'Exercise', [...prevWeek], '💪'),
      ];

      const result = generateWeeklyInsights(moods, habits, []);
      expect(result.recommendations.length).toBeLessThanOrEqual(5);
    });
  });

  // ============================================
  // generateWeeklyInsights — highlights
  // ============================================
  describe('generateWeeklyInsights — highlights', () => {
    it('should return highlights array', () => {
      const result = generateWeeklyInsights([], [], []);
      expect(Array.isArray(result.highlights)).toBe(true);
    });

    it('should return at most 4 highlights', () => {
      const weekDates = getThisWeekDates();
      const prevWeek = getPrevWeekDates();
      const moods = [
        ...weekDates.map(d => makeMood('great', d)),
        ...prevWeek.map(d => makeMood('bad', d)),
      ];
      const habits = [makeHabit('h1', 'Exercise', weekDates)];
      const focus = weekDates.map(d => makeFocusSession(d, 30));

      const result = generateWeeklyInsights(moods, habits, focus);
      expect(result.highlights.length).toBeLessThanOrEqual(4);
    });

    it('should include mood highlight when mood average >= 4', () => {
      const weekDates = getThisWeekDates();
      const moods = weekDates.map(d => makeMood('great', d));

      const result = generateWeeklyInsights(moods, [], []);
      const moodHighlight = result.highlights.find(h => h.includes('mood'));
      expect(moodHighlight).toBeDefined();
    });

    it('should include habit highlight when completion rate >= 80%', () => {
      const weekDates = getThisWeekDates();
      // 6/7 = 85.7% completion
      const habits = [makeHabit('h1', 'Exercise', weekDates.slice(0, 6))];

      const result = generateWeeklyInsights([], habits, []);
      const habitHighlight = result.highlights.find(h => h.includes('habit'));
      expect(habitHighlight).toBeDefined();
    });
  });
});
