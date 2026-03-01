/**
 * Shared test fixtures for Habit v2 (Loop-faithful) format.
 * Use makeTestHabit() instead of inline fixtures with old completedDates arrays.
 */

import { ENTRY } from '@/types';
import type { Habit, HabitEntry } from '@/types';

/**
 * Create a v2-format Habit for testing.
 * All fields have sensible defaults; override as needed.
 */
export function makeTestHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Test Habit',
    icon: '🧪',
    color: 8,  // Palette index (teal)
    position: 0,
    createdAt: Date.now() - 30 * 86400000, // 30 days ago
    habitType: 'boolean',
    frequency: { numerator: 1, denominator: 1 },
    question: '',
    description: '',
    isArchived: false,
    targetValue: 0,
    targetType: 'atLeast',
    unit: '',
    entries: {},
    reminders: [],
    ...overrides,
  };
}

/**
 * Convert a list of date strings to entries Record with YES_MANUAL.
 * Replaces old `completedDates: ['2024-01-15', '2024-01-16']` pattern.
 */
export function datesToEntries(dates: string[]): Record<string, HabitEntry> {
  const entries: Record<string, HabitEntry> = {};
  for (const d of dates) {
    entries[d] = { value: ENTRY.YES_MANUAL };
  }
  return entries;
}

/**
 * Create entries with skipped dates merged in.
 */
export function datesToEntriesWithSkips(
  completedDates: string[],
  skippedDates: string[],
): Record<string, HabitEntry> {
  const entries: Record<string, HabitEntry> = {};
  for (const d of completedDates) {
    entries[d] = { value: ENTRY.YES_MANUAL };
  }
  for (const d of skippedDates) {
    entries[d] = { value: ENTRY.SKIP };
  }
  return entries;
}

/**
 * Create numerical entries from a date→value map.
 * Values are stored as value×1000 per Loop convention.
 */
export function numericalEntries(data: Record<string, number>): Record<string, HabitEntry> {
  const entries: Record<string, HabitEntry> = {};
  for (const [date, val] of Object.entries(data)) {
    entries[date] = { value: val * 1000 };
  }
  return entries;
}
