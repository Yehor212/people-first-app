import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  shouldReminderShowOnDate,
  habitToScheduleEvents,
  generateHabitScheduleEvents,
  mergeScheduleEvents,
  filterEventsByDate,
} from '@/lib/habitScheduleSync';
import type { Habit, HabitReminder, ScheduleEvent } from '@/types';
import { makeTestHabit } from '@/test/habitFixtures';
import { parseLocalDate } from '@/lib/utils';

/**
 * Helper: create a minimal Habit object for testing.
 * Only the fields relevant to habitScheduleSync are set;
 * the rest are filled with safe defaults.
 */
function makeHabit(overrides: Partial<Habit> & { id: string; name: string }): Habit {
  return makeTestHabit(overrides);
}

/**
 * Helper: get the day-of-week that `shouldReminderShowOnDate` would compute
 * for a given date string. Uses parseLocalDate to match the source implementation
 * which parses "YYYY-MM-DD" as local midnight (not UTC midnight).
 */
function dayOfWeekForDateStr(dateStr: string): number {
  return parseLocalDate(dateStr).getDay();
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── shouldReminderShowOnDate ───────────────────────────────────

describe('shouldReminderShowOnDate', () => {
  it('returns false if reminder is disabled', () => {
    const reminder: HabitReminder = { enabled: false, time: '09:00', days: [1, 2, 3, 4, 5] };
    expect(shouldReminderShowOnDate(reminder, '2025-06-16')).toBe(false);
  });

  it('returns true if no days configured (every day)', () => {
    const reminder: HabitReminder = { enabled: true, time: '09:00', days: [] };
    expect(shouldReminderShowOnDate(reminder, '2025-06-16')).toBe(true);
  });

  it('returns true when days array is undefined (every day)', () => {
    const reminder = { enabled: true, time: '09:00' } as HabitReminder;
    expect(shouldReminderShowOnDate(reminder, '2025-06-16')).toBe(true);
  });

  it('returns true when the computed day-of-week matches a configured day', () => {
    const dateStr = '2025-06-16';
    const computedDay = dayOfWeekForDateStr(dateStr);
    const reminder: HabitReminder = { enabled: true, time: '09:00', days: [computedDay] };
    expect(shouldReminderShowOnDate(reminder, dateStr)).toBe(true);
  });

  it('returns false when the computed day-of-week does not match configured days', () => {
    const dateStr = '2025-06-16';
    const computedDay = dayOfWeekForDateStr(dateStr);
    // Exclude the computed day
    const otherDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== computedDay);
    const reminder: HabitReminder = { enabled: true, time: '09:00', days: [otherDays[0]] };
    expect(shouldReminderShowOnDate(reminder, dateStr)).toBe(false);
  });

  it('matches Sunday (day 0) for the correct date string', () => {
    // Find a date string whose computed getDay() is 0 (Sunday)
    // Try successive dates starting from 2025-06-15
    let sundayStr = '';
    for (let d = 15; d <= 22; d++) {
      const ds = `2025-06-${String(d).padStart(2, '0')}`;
      if (dayOfWeekForDateStr(ds) === 0) { sundayStr = ds; break; }
    }
    expect(sundayStr).not.toBe(''); // sanity check
    const reminder: HabitReminder = { enabled: true, time: '09:00', days: [0] };
    expect(shouldReminderShowOnDate(reminder, sundayStr)).toBe(true);
  });

  it('matches Saturday (day 6) for the correct date string', () => {
    let saturdayStr = '';
    for (let d = 14; d <= 22; d++) {
      const ds = `2025-06-${String(d).padStart(2, '0')}`;
      if (dayOfWeekForDateStr(ds) === 6) { saturdayStr = ds; break; }
    }
    expect(saturdayStr).not.toBe('');
    const reminder: HabitReminder = { enabled: true, time: '10:00', days: [6] };
    expect(shouldReminderShowOnDate(reminder, saturdayStr)).toBe(true);
  });

  it('returns false for an invalid date string', () => {
    const reminder: HabitReminder = { enabled: true, time: '09:00', days: [1] };
    expect(shouldReminderShowOnDate(reminder, 'not-a-date')).toBe(false);
  });
});

// ─── habitToScheduleEvents ──────────────────────────────────────

describe('habitToScheduleEvents', () => {
  it('returns empty array for habit with no reminders', () => {
    const habit = makeHabit({ id: 'h1', name: 'Run', reminders: [] });
    expect(habitToScheduleEvents(habit, ['2025-06-16'])).toEqual([]);
  });

  it('creates one event per date per matching reminder (no day filter)', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Meditate',
      reminders: [{ enabled: true, time: '08:30', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16', '2025-06-17']);
    expect(events).toHaveLength(2);
    expect(events[0].date).toBe('2025-06-16');
    expect(events[1].date).toBe('2025-06-17');
  });

  it('parses time correctly from "HH:MM" format', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Read',
      reminders: [{ enabled: true, time: '14:45', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events[0].startHour).toBe(14);
    expect(events[0].startMinute).toBe(45);
  });

  it('sets 30-minute duration', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Yoga',
      reminders: [{ enabled: true, time: '10:00', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events[0].endHour).toBe(10);
    expect(events[0].endMinute).toBe(30);
  });

  it('handles minute overflow (e.g., 10:45 -> 11:15)', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Walk',
      reminders: [{ enabled: true, time: '10:45', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events[0].endHour).toBe(11);
    expect(events[0].endMinute).toBe(15);
  });

  it('clamps end time to 23:59 when exceeding midnight', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Night',
      reminders: [{ enabled: true, time: '23:45', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events[0].endHour).toBe(23);
    expect(events[0].endMinute).toBe(59);
  });

  it('sets source to "habit" and isEditable to false', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Code',
      reminders: [{ enabled: true, time: '09:00', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events[0].source).toBe('habit');
    expect(events[0].isEditable).toBe(false);
  });

  it('includes habitId on generated events', () => {
    const habit = makeHabit({
      id: 'h42',
      name: 'Study',
      reminders: [{ enabled: true, time: '09:00', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events[0].habitId).toBe('h42');
  });

  it('uses habit name as event title', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Stretch',
      reminders: [{ enabled: true, time: '09:00', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events[0].title).toBe('Stretch');
  });

  it('does not create schedule events on non-due days for selected weekly habits', () => {
    const habit = makeHabit({
      id: 'h-specific',
      name: 'Strength',
      frequency: { numerator: 2, denominator: 7 },
      schedule: {
        mode: 'specificDays',
        period: 'week',
        targetCount: 2,
        dueDays: [1, 4],
      },
      reminders: [{ enabled: true, time: '09:00', days: [0, 1, 2, 3, 4, 5, 6] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16', '2025-06-17', '2025-06-19']);

    expect(events.map((event) => event.date)).toEqual(['2025-06-16', '2025-06-19']);
  });

  it('uses habit icon as event emoji', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Run',
      icon: '🏃',
      reminders: [{ enabled: true, time: '07:00', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events[0].emoji).toBe('🏃');
  });

  it('skips disabled reminders', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Piano',
      reminders: [
        { enabled: false, time: '08:00', days: [] },
        { enabled: true, time: '19:00', days: [] },
      ],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events).toHaveLength(1);
    expect(events[0].startHour).toBe(19);
  });

  it('skips reminders that do not match the date day-of-week', () => {
    const dateA = '2025-06-16';
    const dateB = '2025-06-17';
    const dayA = dayOfWeekForDateStr(dateA);
    // Reminder matches only dateA's computed day-of-week
    const habit = makeHabit({
      id: 'h1',
      name: 'Gym',
      reminders: [{ enabled: true, time: '18:00', days: [dayA] }],
    });
    const events = habitToScheduleEvents(habit, [dateA, dateB]);
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe(dateA);
  });

  it('uses default hour 9 for invalid hour value', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Test',
      reminders: [{ enabled: true, time: 'abc:00', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events[0].startHour).toBe(9);
  });

  it('uses default minute 0 for invalid minute value', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Test',
      reminders: [{ enabled: true, time: '10:xyz', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events[0].startMinute).toBe(0);
  });

  it('skips reminders with null/undefined time', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Test',
      reminders: [{ enabled: true, time: null as unknown as string, days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events).toHaveLength(0);
  });

  it('generates correct id format: habit-{id}-{date}-{reminderIndex}', () => {
    const habit = makeHabit({
      id: 'h7',
      name: 'Test',
      reminders: [{ enabled: true, time: '12:00', days: [] }],
    });
    const events = habitToScheduleEvents(habit, ['2025-06-16']);
    expect(events[0].id).toBe('habit-h7-2025-06-16-0');
  });
});

// ─── generateHabitScheduleEvents ────────────────────────────────

describe('generateHabitScheduleEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-16T12:00:00Z'));
  });

  it('generates events for today + daysAhead (default 7 = 8 dates)', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Daily',
      reminders: [{ enabled: true, time: '09:00', days: [] }],
    });
    const events = generateHabitScheduleEvents([habit]);
    // Default daysAhead=7 means today + 7 days = 8 dates, all match (no day filter)
    expect(events).toHaveLength(8);
  });

  it('generates 0 events for habit with no reminders', () => {
    const habit = makeHabit({ id: 'h1', name: 'Empty', reminders: [] });
    const events = generateHabitScheduleEvents([habit]);
    expect(events).toHaveLength(0);
  });

  it('respects daysAhead parameter', () => {
    const habit = makeHabit({
      id: 'h1',
      name: 'Short',
      reminders: [{ enabled: true, time: '09:00', days: [] }],
    });
    const events = generateHabitScheduleEvents([habit], 2);
    // today + 2 = 3 dates
    expect(events).toHaveLength(3);
  });

  it('handles multiple habits', () => {
    const habit1 = makeHabit({
      id: 'h1',
      name: 'Habit A',
      reminders: [{ enabled: true, time: '08:00', days: [] }],
    });
    const habit2 = makeHabit({
      id: 'h2',
      name: 'Habit B',
      reminders: [{ enabled: true, time: '10:00', days: [] }],
    });
    const events = generateHabitScheduleEvents([habit1, habit2], 0);
    // 1 date (today), 2 habits = 2 events
    expect(events).toHaveLength(2);
  });

  it('filters by day-of-week across generated dates', () => {
    // The code generates YYYY-MM-DD strings via formatDate (local time),
    // then shouldReminderShowOnDate parses them back and calls getDay().
    // We ask for a day that we know the first generated date will match.
    const today = new Date('2025-06-16T12:00:00Z');
    // formatDate produces the local date string
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayComputedDay = dayOfWeekForDateStr(todayStr);

    const habit = makeHabit({
      id: 'h1',
      name: 'Specific day',
      reminders: [{ enabled: true, time: '09:00', days: [todayComputedDay] }],
    });
    const events = generateHabitScheduleEvents([habit], 6);
    // Only 1 of 7 dates should match (the same day-of-week occurs once in a 7-day span)
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe(todayStr);
  });

  it('returns empty array for empty habits array', () => {
    const events = generateHabitScheduleEvents([]);
    expect(events).toHaveLength(0);
  });
});

// ─── mergeScheduleEvents ────────────────────────────────────────

describe('mergeScheduleEvents', () => {
  const baseEvent: ScheduleEvent = {
    id: 'e1',
    title: 'Meeting',
    startHour: 10,
    startMinute: 0,
    endHour: 11,
    endMinute: 0,
    color: '#3b82f6',
    date: '2025-06-16',
  };

  it('adds source="manual" to events missing it', () => {
    const merged = mergeScheduleEvents([baseEvent], []);
    expect(merged[0].source).toBe('manual');
  });

  it('adds isEditable=true to events missing it', () => {
    const merged = mergeScheduleEvents([baseEvent], []);
    expect(merged[0].isEditable).toBe(true);
  });

  it('preserves existing source on manual events', () => {
    const event = { ...baseEvent, source: 'task' as const };
    const merged = mergeScheduleEvents([event], []);
    expect(merged[0].source).toBe('task');
  });

  it('preserves isEditable=false when explicitly set', () => {
    const event = { ...baseEvent, isEditable: false };
    const merged = mergeScheduleEvents([event], []);
    expect(merged[0].isEditable).toBe(false);
  });

  it('concatenates manual and habit events', () => {
    const habitEvent: ScheduleEvent = {
      id: 'habit-1',
      title: 'Yoga',
      startHour: 7,
      startMinute: 0,
      endHour: 7,
      endMinute: 30,
      color: '#8b5cf6',
      date: '2025-06-16',
      source: 'habit',
      isEditable: false,
    };
    const merged = mergeScheduleEvents([baseEvent], [habitEvent]);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('e1');
    expect(merged[1].id).toBe('habit-1');
  });

  it('returns only habit events when manual is empty', () => {
    const habitEvent: ScheduleEvent = {
      id: 'habit-1',
      title: 'Run',
      startHour: 6,
      startMinute: 0,
      endHour: 6,
      endMinute: 30,
      color: '#22c55e',
      date: '2025-06-16',
      source: 'habit',
      isEditable: false,
    };
    const merged = mergeScheduleEvents([], [habitEvent]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('habit');
  });

  it('returns empty array when both inputs are empty', () => {
    const merged = mergeScheduleEvents([], []);
    expect(merged).toHaveLength(0);
  });
});

// ─── filterEventsByDate ─────────────────────────────────────────

describe('filterEventsByDate', () => {
  const events: ScheduleEvent[] = [
    {
      id: 'e1', title: 'A', startHour: 9, startMinute: 0,
      endHour: 10, endMinute: 0, color: '#000', date: '2025-06-16',
    },
    {
      id: 'e2', title: 'B', startHour: 11, startMinute: 0,
      endHour: 12, endMinute: 0, color: '#000', date: '2025-06-17',
    },
    {
      id: 'e3', title: 'C', startHour: 14, startMinute: 0,
      endHour: 15, endMinute: 0, color: '#000', date: '2025-06-16',
    },
  ];

  it('returns only events matching the given date', () => {
    const filtered = filterEventsByDate(events, '2025-06-16');
    expect(filtered).toHaveLength(2);
    expect(filtered.map((e) => e.id)).toEqual(['e1', 'e3']);
  });

  it('returns empty array when no events match', () => {
    const filtered = filterEventsByDate(events, '2025-06-20');
    expect(filtered).toHaveLength(0);
  });

  it('returns empty array for empty events list', () => {
    const filtered = filterEventsByDate([], '2025-06-16');
    expect(filtered).toHaveLength(0);
  });
});
