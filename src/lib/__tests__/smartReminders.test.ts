import { describe, it, expect, vi } from 'vitest';
import {
  analyzeMoodPatterns,
  analyzeFocusPatterns,
  analyzeHabitPatterns,
  generateSmartSuggestions,
  generateHabitReminderSuggestions,
  getOptimalQuietHours,
  hasEnoughDataForSmartReminders,
  getBestReminderDays,
} from '../smartReminders';
import type { MoodEntry, Habit, FocusSession, ReminderSettings } from '@/types';

// Mock dependencies that smartReminders imports
vi.mock('@/lib/habits', () => ({
  getHabitCompletedDates: (habit: Habit) => habit.completedDates || [],
}));

vi.mock('@/lib/validation', () => ({
  safeParseInt: (val: string, fallback: number, min: number, max: number) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  },
}));

vi.mock('@/lib/utils', () => ({
  parseLocalDate: (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  },
}));

// ============================================
// Helpers
// ============================================

function makeMoodEntry(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: 'mood-1',
    mood: 'good',
    date: '2026-01-15',
    timestamp: new Date('2026-01-15T10:00:00').getTime(),
    ...overrides,
  };
}

function makeFocusSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: 'focus-1',
    duration: 25,
    completedAt: new Date('2026-01-15T14:00:00').getTime(),
    date: '2026-01-15',
    status: 'completed',
    ...overrides,
  };
}

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Test Habit',
    icon: '🧪',
    color: '#FF0000',
    completedDates: [],
    createdAt: Date.now(),
    type: 'daily',
    frequency: 'daily',
    reminders: [],
    ...overrides,
  };
}

function makeReminderSettings(overrides: Partial<ReminderSettings> = {}): ReminderSettings {
  return {
    enabled: true,
    moodTimeMorning: '08:00',
    moodTimeAfternoon: '14:00',
    moodTimeEvening: '20:00',
    habitTime: '09:00',
    focusTime: '10:00',
    days: [1, 2, 3, 4, 5],
    quietHours: { start: '22:00', end: '08:00' },
    habitIds: [],
    ...overrides,
  };
}

// ============================================
// analyzeMoodPatterns
// ============================================

describe('analyzeMoodPatterns', () => {
  it('returns empty/minimal patterns for fewer than 7 entries', () => {
    const moods = Array.from({ length: 3 }, (_, i) =>
      makeMoodEntry({
        id: `mood-${i}`,
        date: `2026-01-${String(10 + i).padStart(2, '0')}`,
        timestamp: new Date(`2026-01-${String(10 + i).padStart(2, '0')}T10:00:00`).getTime(),
      })
    );
    const result = analyzeMoodPatterns(moods);
    expect(result.peakHours.length).toBeLessThanOrEqual(3);
    expect(result.bestDays.length).toBeGreaterThanOrEqual(0);
    expect(result.consistency).toBeGreaterThanOrEqual(0);
  });

  it('returns time and day patterns for 14+ entries', () => {
    const moods: MoodEntry[] = [];
    for (let i = 0; i < 14; i++) {
      const day = (i % 28) + 1;
      const hour = i % 2 === 0 ? 9 : 10;
      moods.push(
        makeMoodEntry({
          id: `mood-${i}`,
          date: `2026-01-${String(day).padStart(2, '0')}`,
          timestamp: new Date(`2026-01-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`).getTime(),
        })
      );
    }
    const result = analyzeMoodPatterns(moods);
    expect(result.peakHours.length).toBeGreaterThan(0);
    expect(result.bestDays.length).toBeGreaterThan(0);
    expect(result.averageCompletionTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it('returns consistency between 0 and 100', () => {
    const moods = Array.from({ length: 10 }, (_, i) =>
      makeMoodEntry({
        id: `mood-${i}`,
        date: `2026-01-${String(10 + i).padStart(2, '0')}`,
        timestamp: new Date(`2026-01-${String(10 + i).padStart(2, '0')}T09:00:00`).getTime(),
      })
    );
    const result = analyzeMoodPatterns(moods);
    expect(result.consistency).toBeGreaterThanOrEqual(0);
    expect(result.consistency).toBeLessThanOrEqual(100);
  });

  it('handles empty moods array gracefully', () => {
    const result = analyzeMoodPatterns([]);
    expect(result.peakHours).toEqual([]);
    expect(result.bestDays).toEqual([]);
    expect(result.averageCompletionTime).toBe('12:00');
  });
});

// ============================================
// analyzeFocusPatterns
// ============================================

describe('analyzeFocusPatterns', () => {
  it('returns time patterns from sessions at different times', () => {
    const sessions: FocusSession[] = [
      makeFocusSession({ id: 'f1', completedAt: new Date('2026-01-10T09:00:00').getTime(), date: '2026-01-10' }),
      makeFocusSession({ id: 'f2', completedAt: new Date('2026-01-11T09:30:00').getTime(), date: '2026-01-11' }),
      makeFocusSession({ id: 'f3', completedAt: new Date('2026-01-12T15:00:00').getTime(), date: '2026-01-12' }),
      makeFocusSession({ id: 'f4', completedAt: new Date('2026-01-13T15:00:00').getTime(), date: '2026-01-13' }),
      makeFocusSession({ id: 'f5', completedAt: new Date('2026-01-14T09:00:00').getTime(), date: '2026-01-14' }),
    ];
    const result = analyzeFocusPatterns(sessions);
    expect(result.peakHours.length).toBeGreaterThan(0);
    expect(result.peakHours[0].hour).toBe(9);
  });

  it('filters out aborted sessions', () => {
    const sessions: FocusSession[] = [
      makeFocusSession({ id: 'f1', status: 'aborted', date: '2026-01-10' }),
      makeFocusSession({ id: 'f2', status: 'completed', completedAt: new Date('2026-01-11T14:00:00').getTime(), date: '2026-01-11' }),
    ];
    const result = analyzeFocusPatterns(sessions);
    // Only 1 non-aborted session
    expect(result.peakHours.length).toBe(1);
    expect(result.peakHours[0].count).toBe(1);
  });

  it('returns averageCompletionTime with default 10 for empty sessions', () => {
    const result = analyzeFocusPatterns([]);
    expect(result.averageCompletionTime).toBe('10:00');
  });
});

// ============================================
// analyzeHabitPatterns
// ============================================

describe('analyzeHabitPatterns', () => {
  it('returns day patterns from habit completedDates', () => {
    // Create a habit completed on specific weekdays
    const habit = makeHabit({
      completedDates: [
        '2026-01-12', // Monday
        '2026-01-13', // Tuesday
        '2026-01-14', // Wednesday
        '2026-01-19', // Monday
        '2026-01-20', // Tuesday
      ],
    });
    const result = analyzeHabitPatterns(habit);
    expect(result.bestDays.length).toBeGreaterThan(0);
    expect(result.peakHours.length).toBe(1);
    // Default hour for non-morning/evening category is 14
    expect(result.peakHours[0].hour).toBe(14);
  });

  it('returns consistency based on completion rate', () => {
    const habit = makeHabit({
      completedDates: Array.from({ length: 15 }, (_, i) =>
        `2026-01-${String(i + 1).padStart(2, '0')}`
      ),
    });
    const result = analyzeHabitPatterns(habit);
    // 15/30 = 50%
    expect(result.consistency).toBe(50);
  });
});

// ============================================
// generateSmartSuggestions
// ============================================

describe('generateSmartSuggestions', () => {
  it('returns empty array when data is insufficient', () => {
    const settings = makeReminderSettings();
    const result = generateSmartSuggestions(settings, [], [], []);
    expect(result).toEqual([]);
  });

  it('returns mood suggestion when 7+ consistent mood entries exist', () => {
    const settings = makeReminderSettings({ moodTimeMorning: '06:00' });
    // Create 10 moods all logged around 9 AM
    const moods = Array.from({ length: 10 }, (_, i) =>
      makeMoodEntry({
        id: `mood-${i}`,
        date: `2026-01-${String(10 + i).padStart(2, '0')}`,
        timestamp: new Date(`2026-01-${String(10 + i).padStart(2, '0')}T09:00:00`).getTime(),
      })
    );
    const result = generateSmartSuggestions(settings, moods, [], []);
    // Should suggest a mood reminder since user logs at 9 but current is 6
    const moodSuggestion = result.find(s => s.type === 'mood');
    expect(moodSuggestion).toBeDefined();
    expect(moodSuggestion?.suggestedTime).toBe('09:00');
  });

  it('returns suggestions array type', () => {
    const settings = makeReminderSettings();
    const result = generateSmartSuggestions(settings, [], [], []);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ============================================
// generateHabitReminderSuggestions
// ============================================

describe('generateHabitReminderSuggestions', () => {
  it('returns suggestions for each habit', () => {
    const habits = [
      makeHabit({ id: 'h1', name: 'Morning Run', icon: '🏃' }),
      makeHabit({ id: 'h2', name: 'Read a book', icon: '📖' }),
    ];
    const result = generateHabitReminderSuggestions(habits, []);
    expect(result.length).toBe(2);
    expect(result[0].habitId).toBe('h1');
    expect(result[1].habitId).toBe('h2');
  });

  it('suggests morning time for habit with "morning" in name', () => {
    // "morning" keyword is checked before "workout" in the source
    const habits = [makeHabit({ name: 'Morning routine', icon: '🌅' })];
    const result = generateHabitReminderSuggestions(habits, []);
    expect(result[0].suggestedTime).toBe('07:30');
    expect(result[0].reason).toBe('Best completed in the morning');
  });

  it('suggests evening time for habit with "bed" in name', () => {
    // "bed" matches the evening check which runs before the "read" check
    const habits = [makeHabit({ name: 'Read before bed', icon: '📖' })];
    const result = generateHabitReminderSuggestions(habits, []);
    expect(result[0].suggestedTime).toBe('21:00');
    expect(result[0].reason).toBe('Best completed in the evening');
  });
});

// ============================================
// getOptimalQuietHours
// ============================================

describe('getOptimalQuietHours', () => {
  it('returns default quiet hours when not enough data', () => {
    const result = getOptimalQuietHours([], []);
    expect(result).toEqual({ start: '22:00', end: '08:00' });
  });

  it('returns quiet hours object with start and end strings', () => {
    const moods = Array.from({ length: 12 }, (_, i) =>
      makeMoodEntry({
        id: `m-${i}`,
        timestamp: new Date(`2026-01-${String(10 + i).padStart(2, '0')}T14:00:00`).getTime(),
        date: `2026-01-${String(10 + i).padStart(2, '0')}`,
      })
    );
    const result = getOptimalQuietHours(moods, []);
    expect(result.start).toMatch(/^\d{2}:\d{2}$/);
    expect(result.end).toMatch(/^\d{2}:\d{2}$/);
  });
});

// ============================================
// hasEnoughDataForSmartReminders
// ============================================

describe('hasEnoughDataForSmartReminders', () => {
  it('returns false when all data is below threshold', () => {
    const moods = Array.from({ length: 3 }, (_, i) =>
      makeMoodEntry({ id: `m-${i}` })
    );
    const habits = [makeHabit({ completedDates: ['2026-01-01', '2026-01-02'] })];
    const sessions = [makeFocusSession()];
    expect(hasEnoughDataForSmartReminders(moods, habits, sessions)).toBe(false);
  });

  it('returns true when moods >= 7', () => {
    const moods = Array.from({ length: 7 }, (_, i) =>
      makeMoodEntry({ id: `m-${i}` })
    );
    expect(hasEnoughDataForSmartReminders(moods, [], [])).toBe(true);
  });

  it('returns true when focusSessions >= 5', () => {
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeFocusSession({ id: `f-${i}` })
    );
    expect(hasEnoughDataForSmartReminders([], [], sessions)).toBe(true);
  });

  it('returns true when a habit has >= 7 completed dates', () => {
    const habit = makeHabit({
      completedDates: Array.from({ length: 7 }, (_, i) =>
        `2026-01-${String(i + 1).padStart(2, '0')}`
      ),
    });
    expect(hasEnoughDataForSmartReminders([], [habit], [])).toBe(true);
  });
});

// ============================================
// getBestReminderDays
// ============================================

describe('getBestReminderDays', () => {
  it('returns Mon-Fri when not enough data', () => {
    const result = getBestReminderDays([], []);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns day numbers (0-6) based on activity', () => {
    // Create moods on various dates to ensure enough day diversity
    const moods: MoodEntry[] = [
      makeMoodEntry({ id: 'm1', date: '2026-01-12' }),
      makeMoodEntry({ id: 'm2', date: '2026-01-13' }),
      makeMoodEntry({ id: 'm3', date: '2026-01-14' }),
      makeMoodEntry({ id: 'm4', date: '2026-01-15' }),
      makeMoodEntry({ id: 'm5', date: '2026-01-16' }),
      makeMoodEntry({ id: 'm6', date: '2026-01-19' }),
      makeMoodEntry({ id: 'm7', date: '2026-01-20' }),
    ];
    const result = getBestReminderDays(moods, []);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.length).toBeGreaterThanOrEqual(3);
    // All values must be valid day numbers 0-6
    result.forEach(day => {
      expect(day).toBeGreaterThanOrEqual(0);
      expect(day).toBeLessThanOrEqual(6);
    });
  });
});
