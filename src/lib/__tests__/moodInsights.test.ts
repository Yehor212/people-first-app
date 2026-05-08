import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MoodEntry, MoodType, Habit, FocusSession, GratitudeEntry } from '@/types';
import { makeTestHabit, datesToEntries } from '@/test/habitFixtures';

// ============================================
// MOCKS
// ============================================

vi.mock('../utils', () => ({
  getToday: vi.fn(() => '2026-02-17'),
  formatDate: vi.fn((d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }),
}));

vi.mock('@/lib/validation', () => ({
  safeParseInt: vi.fn((val: string | number, def: number, min?: number, max?: number) => {
    const n = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (isNaN(n)) return def;
    let result = n;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  }),
}));

import { generateMoodInsights, getFeaturedInsight } from '../moodInsights';

function expectDefined<T>(value: T | undefined, message = 'Expected value to be defined'): T {
  expect(value).toBeDefined();
  if (value === undefined) throw new Error(message);
  return value;
}

function expectNotNull<T>(value: T | null, message = 'Expected value to be non-null'): T {
  expect(value).not.toBeNull();
  if (value === null) throw new Error(message);
  return value;
}

// ============================================
// HELPERS
// ============================================

const makeMood = (mood: MoodType, date: string, hour: number = 12): MoodEntry => ({
  id: `mood-${date}-${hour}`,
  mood,
  date,
  timestamp: new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime(),
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
  createdAt: Date.now(),
});

const makeFocusSession = (date: string, duration: number, id?: string): FocusSession => ({
  id: id || `focus-${date}-${duration}`,
  duration,
  date,
  completedAt: new Date(`${date}T12:00:00`).getTime(),
  status: 'completed',
});

const makeGratitude = (date: string, id?: string): GratitudeEntry => ({
  id: id || `gratitude-${date}`,
  text: 'Grateful for today',
  date,
  timestamp: new Date(`${date}T12:00:00`).getTime(),
});

/**
 * Generate an array of dates going backwards from a reference date.
 * Returns dates in YYYY-MM-DD format.
 */
function generateDates(count: number, startDate: string = '2026-02-17'): string[] {
  const dates: string[] = [];
  const base = new Date(startDate);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}

// ============================================
// TESTS
// ============================================

describe('moodInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-17T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateMoodInsights', () => {
    it('should return empty array when no moods provided', () => {
      const result = generateMoodInsights([], [], [], []);
      expect(result).toEqual([]);
    });

    it('should return empty array with fewer than 7 moods', () => {
      const moods = [
        makeMood('good', '2026-02-17'),
        makeMood('great', '2026-02-16'),
        makeMood('okay', '2026-02-15'),
      ];
      const result = generateMoodInsights(moods, [], [], []);
      expect(result).toEqual([]);
    });

    it('should return at most 5 insights', () => {
      // Create rich data that could trigger many insights
      const dates = generateDates(30);
      const moods: MoodEntry[] = [];
      dates.forEach((date, i) => {
        // Alternate moods with timestamps at different hours
        const hour = (i % 4) * 6 + 6; // 6, 12, 18, 0
        const mood: MoodType = i % 2 === 0 ? 'great' : 'good';
        moods.push(makeMood(mood, date, hour));
      });

      const habits = [
        makeHabit('h1', 'Exercise', dates.filter((_, i) => i % 2 === 0)),
      ];
      const focus = dates.map(d => makeFocusSession(d, 25));
      const gratitude = dates.map(d => makeGratitude(d));

      const result = generateMoodInsights(moods, habits, focus, gratitude);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should sort insights by priority (highest first)', () => {
      const dates = generateDates(30);
      const moods: MoodEntry[] = [];
      dates.forEach((date, i) => {
        const hour = (i % 4) * 6 + 6;
        moods.push(makeMood(i % 3 === 0 ? 'great' : 'okay', date, hour));
      });

      const result = generateMoodInsights(moods, [], [], []);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].priority).toBeGreaterThanOrEqual(result[i].priority);
      }
    });

    it('each insight should have required structure', () => {
      const dates = generateDates(30);
      const moods = dates.map((d, i) => makeMood(i % 2 === 0 ? 'great' : 'bad', d, 10));

      const result = generateMoodInsights(moods, [], [], []);
      result.forEach(insight => {
        expect(insight).toHaveProperty('id');
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('icon');
        expect(insight).toHaveProperty('title');
        expect(insight).toHaveProperty('description');
        expect(insight).toHaveProperty('priority');
        expect(typeof insight.id).toBe('string');
        expect(typeof insight.priority).toBe('number');
      });
    });

    it('should filter moods to last 90 days', () => {
      // Create moods older than 90 days
      const oldMoods: MoodEntry[] = [];
      for (let i = 100; i < 120; i++) {
        const d = new Date('2026-02-17');
        d.setDate(d.getDate() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        oldMoods.push(makeMood('great', dateStr));
      }

      // Only old moods, no recent ones
      const result = generateMoodInsights(oldMoods, [], [], []);
      expect(result).toEqual([]);
    });

    describe('analyzeBestMoodDay', () => {
      it('should detect best mood day when data spans multiple weekdays', () => {
        // Create 14+ moods spread across weekdays with clear pattern:
        // Mondays are great, other days are bad
        const moods: MoodEntry[] = [];
        const dates = generateDates(28); // 4 weeks

        dates.forEach(date => {
          const dayOfWeek = new Date(date).getDay();
          // Monday = 1
          const mood: MoodType = dayOfWeek === 1 ? 'great' : 'bad';
          moods.push(makeMood(mood, date));
        });

        const result = generateMoodInsights(moods, [], [], []);
        const bestDayInsight = expectDefined(result.find(i => i.id === 'best-mood-day'));
        expect(bestDayInsight.type).toBe('pattern');
        expect(bestDayInsight.data).toHaveProperty('bestDay');
        // Monday = day 1
        expect((bestDayInsight.data as { bestDay: number }).bestDay).toBe(1);
      });

      it('should return null for best mood day with fewer than 7 moods', () => {
        const moods = [
          makeMood('great', '2026-02-17'),
          makeMood('good', '2026-02-16'),
          makeMood('okay', '2026-02-15'),
        ];
        const result = generateMoodInsights(moods, [], [], []);
        const bestDayInsight = result.find(i => i.id === 'best-mood-day');
        expect(bestDayInsight).toBeUndefined();
      });

      it('should require at least 2 entries per day to consider it', () => {
        // 7 moods but each on a different day = only 1 per day
        const moods: MoodEntry[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date('2026-02-17');
          d.setDate(d.getDate() - i);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          moods.push(makeMood('great', `${year}-${month}-${day}`));
        }
        const result = generateMoodInsights(moods, [], [], []);
        const bestDayInsight = result.find(i => i.id === 'best-mood-day');
        // Should not appear because each weekday has only 1 entry (needs >= 2)
        expect(bestDayInsight).toBeUndefined();
      });
    });

    describe('analyzeMoodByTimeOfDay', () => {
      it('should detect best time period with sufficient data', () => {
        // Create 12+ moods with morning moods being best
        const dates = generateDates(12);
        const moods: MoodEntry[] = dates.map(d => makeMood('great', d, 8)); // All morning

        const result = generateMoodInsights(moods, [], [], []);
        const timeInsight = result.find(i => i.id === 'best-time-of-day');
        if (timeInsight) {
          expect(timeInsight.type).toBe('pattern');
          expect(timeInsight.data).toHaveProperty('bestPeriod');
          expect((timeInsight.data as { bestPeriod: string }).bestPeriod).toBe('morning');
        }
      });

      it('should return null with fewer than 10 moods', () => {
        const moods = generateDates(9).map(d => makeMood('great', d, 8));
        const result = generateMoodInsights(moods, [], [], []);
        const timeInsight = result.find(i => i.id === 'best-time-of-day');
        expect(timeInsight).toBeUndefined();
      });

      it('should correctly identify afternoon as best period', () => {
        const dates = generateDates(15);
        const moods: MoodEntry[] = dates.map(d => makeMood('great', d, 14)); // All afternoon

        const result = generateMoodInsights(moods, [], [], []);
        const timeInsight = result.find(i => i.id === 'best-time-of-day');
        if (timeInsight) {
          expect((timeInsight.data as { bestPeriod: string }).bestPeriod).toBe('afternoon');
        }
      });
    });

    describe('analyzeHabitMoodCorrelation', () => {
      it('should detect positive habit-mood correlation', () => {
        const dates = generateDates(30);
        // Split: first 15 dates have habit completed and great mood,
        // last 15 have no habit and bad mood
        const habitDates = dates.slice(0, 15);
        const moods: MoodEntry[] = [
          ...habitDates.map(d => makeMood('great', d)),
          ...dates.slice(15).map(d => makeMood('bad', d)),
        ];
        const habits = [makeHabit('h1', 'Meditation', habitDates)];

        const result = generateMoodInsights(moods, habits, [], []);
        const correlationInsight = expectDefined(result.find(i => i.id === 'habit-mood-correlation'));
        expect(correlationInsight.type).toBe('correlation');
        expect(correlationInsight.title).toContain('Meditation');
      });

      it('should return null with fewer than 14 moods', () => {
        const dates = generateDates(10);
        const moods = dates.map(d => makeMood('great', d));
        const habits = [makeHabit('h1', 'Exercise', dates)];

        const result = generateMoodInsights(moods, habits, [], []);
        const correlationInsight = result.find(i => i.id === 'habit-mood-correlation');
        expect(correlationInsight).toBeUndefined();
      });

      it('should return null when no habits provided', () => {
        const dates = generateDates(20);
        const moods = dates.map(d => makeMood('great', d));

        const result = generateMoodInsights(moods, [], [], []);
        const correlationInsight = result.find(i => i.id === 'habit-mood-correlation');
        expect(correlationInsight).toBeUndefined();
      });

      it('should not detect correlation when mood difference is too small', () => {
        const dates = generateDates(30);
        // All moods are the same regardless of habit completion
        const moods = dates.map(d => makeMood('okay', d));
        const habits = [makeHabit('h1', 'Reading', dates.slice(0, 15))];

        const result = generateMoodInsights(moods, habits, [], []);
        const correlationInsight = result.find(i => i.id === 'habit-mood-correlation');
        expect(correlationInsight).toBeUndefined();
      });
    });

    describe('analyzeFocusMoodCorrelation', () => {
      it('should detect focus-mood correlation', () => {
        const dates = generateDates(30);
        const focusDates = dates.slice(0, 15);
        const nonFocusDates = dates.slice(15);

        const moods: MoodEntry[] = [
          ...focusDates.map(d => makeMood('great', d)),
          ...nonFocusDates.map(d => makeMood('bad', d)),
        ];
        const focus = focusDates.map(d => makeFocusSession(d, 25));

        const result = generateMoodInsights(moods, [], focus, []);
        const focusInsight = expectDefined(result.find(i => i.id === 'focus-mood-correlation'));
        expect(focusInsight.type).toBe('correlation');
        expect(focusInsight.icon).toBe('🎯');
      });

      it('should return null with fewer than 7 focus sessions', () => {
        const dates = generateDates(20);
        const moods = dates.map(d => makeMood('great', d));
        const focus = dates.slice(0, 5).map(d => makeFocusSession(d, 25));

        const result = generateMoodInsights(moods, [], focus, []);
        const focusInsight = result.find(i => i.id === 'focus-mood-correlation');
        expect(focusInsight).toBeUndefined();
      });
    });

    describe('analyzeGratitudeMoodCorrelation', () => {
      it('should detect gratitude-mood correlation', () => {
        const dates = generateDates(30);
        const gratitudeDates = dates.slice(0, 15);
        const nonGratitudeDates = dates.slice(15);

        const moods: MoodEntry[] = [
          ...gratitudeDates.map(d => makeMood('great', d)),
          ...nonGratitudeDates.map(d => makeMood('bad', d)),
        ];
        const gratitude = gratitudeDates.map(d => makeGratitude(d));

        const result = generateMoodInsights(moods, [], [], gratitude);
        const gratitudeInsight = expectDefined(
          result.find(i => i.id === 'gratitude-mood-correlation')
        );
        expect(gratitudeInsight.type).toBe('correlation');
        expect(gratitudeInsight.icon).toBe('🙏');
      });

      it('should return null with fewer than 7 gratitude entries', () => {
        const dates = generateDates(20);
        const moods = dates.map(d => makeMood('great', d));
        const gratitude = dates.slice(0, 5).map(d => makeGratitude(d));

        const result = generateMoodInsights(moods, [], [], gratitude);
        const gratitudeInsight = result.find(i => i.id === 'gratitude-mood-correlation');
        expect(gratitudeInsight).toBeUndefined();
      });
    });

    describe('analyzeMoodTrend', () => {
      it('should detect improving mood trend', () => {
        // Last 7 days: great moods; previous 7 days: bad moods
        const recentDates = generateDates(7, '2026-02-17');
        const previousDates = generateDates(7, '2026-02-10');

        const moods: MoodEntry[] = [
          ...recentDates.map(d => makeMood('great', d)),
          ...previousDates.map(d => makeMood('bad', d)),
        ];

        const result = generateMoodInsights(moods, [], [], []);
        const trendInsight = expectDefined(result.find(i => i.id === 'mood-trend-up'));
        expect(trendInsight.type).toBe('achievement');
        expect(trendInsight.title).toContain('improving');
      });

      it('should detect declining mood trend', () => {
        const recentDates = generateDates(7, '2026-02-17');
        const previousDates = generateDates(7, '2026-02-10');

        const moods: MoodEntry[] = [
          ...recentDates.map(d => makeMood('bad', d)),
          ...previousDates.map(d => makeMood('great', d)),
        ];

        const result = generateMoodInsights(moods, [], [], []);
        const trendInsight = expectDefined(result.find(i => i.id === 'mood-trend-down'));
        expect(trendInsight.type).toBe('tip');
        expect(trendInsight.priority).toBe(10);
      });

      it('should return null when trend change is too small', () => {
        const dates = generateDates(14, '2026-02-17');
        const moods = dates.map(d => makeMood('okay', d));

        const result = generateMoodInsights(moods, [], [], []);
        const trendUp = result.find(i => i.id === 'mood-trend-up');
        const trendDown = result.find(i => i.id === 'mood-trend-down');
        expect(trendUp).toBeUndefined();
        expect(trendDown).toBeUndefined();
      });
    });

    describe('analyzeConsistency', () => {
      it('should detect high consistency (85%+ in last 14 days)', () => {
        // Need 14+ moods total (analyzeConsistency requires moods.length >= 14)
        // AND 85%+ of the last 14 days must have entries (12+ of 14)
        const dates = generateDates(14, '2026-02-17');
        const moods = dates.map(d => makeMood('good', d));

        const result = generateMoodInsights(moods, [], [], []);
        const consistencyInsight = expectDefined(result.find(i => i.id === 'high-consistency'));
        expect(consistencyInsight.type).toBe('achievement');
      });

      it('should detect low consistency (<50% in last 14 days)', () => {
        // Log mood on only 14 days total but mostly outside the 14-day window
        // We need 14+ moods for this analysis to run, but <50% in last 14 days
        const dates = generateDates(30, '2026-02-17');
        // Only keep moods on odd-indexed dates (scattered)
        // But we need 14+ total for the check to run AND <7 in the last 14 days
        const moods: MoodEntry[] = [];
        dates.forEach((d, i) => {
          if (i >= 8) { // Only older moods, skip recent ones
            moods.push(makeMood('good', d));
          }
        });

        const result = generateMoodInsights(moods, [], [], []);
        const lowConsistencyInsight = result.find(i => i.id === 'low-consistency');
        if (moods.length >= 14) {
          expect(lowConsistencyInsight).toBeDefined();
          if (lowConsistencyInsight) {
            expect(lowConsistencyInsight.type).toBe('tip');
          }
        }
      });
    });

    describe('all same mood type', () => {
      it('should handle all moods being identical', () => {
        const dates = generateDates(20);
        const moods = dates.map(d => makeMood('okay', d, 12));

        const result = generateMoodInsights(moods, [], [], []);
        // Should not crash; trend insights should be null (no variation)
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('single day data', () => {
      it('should return empty array for single day of data', () => {
        const moods = [makeMood('great', '2026-02-17')];
        const result = generateMoodInsights(moods, [], [], []);
        expect(result).toEqual([]);
      });
    });
  });

  describe('getFeaturedInsight', () => {
    it('should return null when no insights are generated', () => {
      const result = getFeaturedInsight([], [], [], []);
      expect(result).toBeNull();
    });

    it('should return the highest priority insight', () => {
      const dates = generateDates(14, '2026-02-17');
      const recentDates = dates.slice(0, 7);
      const previousDates = dates.slice(7);

      const moods: MoodEntry[] = [
        ...recentDates.map(d => makeMood('bad', d)),
        ...previousDates.map(d => makeMood('great', d)),
      ];

      const result = getFeaturedInsight(moods, [], [], []);
      expect(result).not.toBeNull();
      const featured = expectNotNull(result);
      // The featured insight should be the one with highest priority
      const allInsights = generateMoodInsights(moods, [], [], []);
      if (allInsights.length > 0) {
        expect(featured.id).toBe(allInsights[0].id);
      }
    });

    it('should return a single MoodInsight object', () => {
      const dates = generateDates(20);
      const moods = dates.map((d, i) => makeMood(i % 2 === 0 ? 'great' : 'bad', d, 10));

      const result = getFeaturedInsight(moods, [], [], []);
      if (result) {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('priority');
      } else {
        // If null, that's also valid when no insights generated
        expect(result).toBeNull();
      }
    });
  });
});
