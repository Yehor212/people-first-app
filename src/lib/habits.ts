/**
 * habits.ts — Habit utility functions for Loop-faithful data model.
 *
 * Works with the new entry-based Habit interface (entries Record).
 * Pure functions — no React dependencies.
 */

import { getLocale } from '@/lib/timeUtils';
import type { Language } from '@/i18n/translations';
import type { Habit, HabitEntry, EntryValue } from '@/types';
import { ENTRY } from '@/types';

// ─── Normalize / defaults ───────────────────────────────────────────────────

/** Ensure all required fields have safe defaults */
export function normalizeHabit(habit: Habit): Habit {
  return {
    ...habit,
    habitType: habit.habitType || 'boolean',
    frequency: habit.frequency || { numerator: 1, denominator: 1 },
    entries: habit.entries || {},
    reminders: habit.reminders || [],
    isArchived: habit.isArchived ?? false,
    question: habit.question ?? '',
    description: habit.description ?? '',
    targetValue: habit.targetValue ?? 0,
    targetType: habit.targetType ?? 'atLeast',
    unit: habit.unit ?? '',
    position: habit.position ?? 0,
    color: typeof habit.color === 'number' ? habit.color : 8,
    category: habit.category || 'health',
  };
}

// ─── Entry access ───────────────────────────────────────────────────────────

/** Get the entry value for a specific date, defaulting to UNKNOWN */
export function getEntryValue(habit: Habit, date: string): number {
  return habit.entries?.[date]?.value ?? ENTRY.UNKNOWN;
}

/** Get the full entry for a specific date */
export function getEntry(habit: Habit, date: string): HabitEntry | undefined {
  return habit.entries?.[date];
}

/** Set an entry value for a specific date (returns new entries object) */
export function setEntryValue(
  entries: Record<string, HabitEntry>,
  date: string,
  value: number,
  notes?: string,
): Record<string, HabitEntry> {
  const existing = entries[date];
  const newEntries = { ...entries };

  if (value === ENTRY.UNKNOWN && !notes) {
    // Remove entry entirely if resetting to UNKNOWN with no notes
    delete newEntries[date];
  } else {
    newEntries[date] = {
      value,
      ...(notes !== undefined ? { notes } : existing?.notes ? { notes: existing.notes } : {}),
    };
  }

  return newEntries;
}

// ─── Completion checks ──────────────────────────────────────────────────────

/** Check if a boolean habit is completed on a date (YES_MANUAL or YES_AUTO) */
export function isHabitCompletedOnDate(habit: Habit, date: string): boolean {
  const val = getEntryValue(habit, date);

  if (habit.habitType === 'boolean') {
    return val === ENTRY.YES_MANUAL || val === ENTRY.YES_AUTO;
  }

  // Numerical: completed if meets target
  if (val === ENTRY.UNKNOWN) return false;
  if (habit.targetType === 'atMost') {
    if (val <= 0) return false; // ENTRY.NO (0) and negatives = not completed
    if (val === ENTRY.SKIP) return false;
    return (val / 1000) <= habit.targetValue;
  }
  if (val <= 0) return false;
  return (val / 1000) >= habit.targetValue;
}

/** Get all dates where the habit was completed.
 *  Pass `overrideEntries` (from computeEntriesWithAuto) to include YES_AUTO fills. */
export function getHabitCompletedDates(
  habit: Habit,
  overrideEntries?: Record<string, HabitEntry>,
): string[] {
  const dates: string[] = [];
  for (const [date, entry] of Object.entries(overrideEntries || habit.entries || {})) {
    if (habit.habitType === 'boolean') {
      if (entry.value === ENTRY.YES_MANUAL || entry.value === ENTRY.YES_AUTO) {
        dates.push(date);
      }
    } else {
      // Numerical: completed if meets target
      const realValue = entry.value / 1000;
      if (habit.targetType === 'atMost') {
        if (entry.value !== ENTRY.UNKNOWN && entry.value !== ENTRY.SKIP && realValue <= habit.targetValue) {
          dates.push(date);
        }
      } else {
        if (realValue >= habit.targetValue) {
          dates.push(date);
        }
      }
    }
  }
  return dates;
}

/** Total number of completed days */
export function getHabitCompletionTotal(habit: Habit): number {
  return getHabitCompletedDates(habit).length;
}

// ─── Toggle cycle (Loop-exact) ──────────────────────────────────────────────

/**
 * Get the next entry value in the toggle cycle.
 * Binary toggle: UNKNOWN ↔ YES_MANUAL.
 * SKIP/NO states are only settable via HabitDetailSheet (not via tap cycle).
 * Tapping a SKIP or NO cell marks it as done (YES_MANUAL).
 */
export function getNextToggleValue(currentValue: number): EntryValue {
  switch (currentValue) {
    case ENTRY.UNKNOWN: return ENTRY.YES_MANUAL;
    case ENTRY.YES_MANUAL: return ENTRY.UNKNOWN;
    case ENTRY.SKIP: return ENTRY.YES_MANUAL;
    case ENTRY.NO: return ENTRY.YES_MANUAL;
    default: return ENTRY.YES_MANUAL;
  }
}

// ─── Numerical helpers ──────────────────────────────────────────────────────

/** Get the real numerical value for a date (entry.value / 1000) */
export function getNumericalValue(habit: Habit, date: string): number {
  const val = getEntryValue(habit, date);
  if (val <= 0) return 0;
  return val / 1000;
}

export function formatHabitValue(value: number, language: Language): string {
  const rounded = Math.round(value * 100) / 100;
  return new Intl.NumberFormat(getLocale(language), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/** Convert a real numerical value to the stored integer format (× 1000) */
export function toStoredValue(realValue: number): number {
  return Math.round(realValue * 1000);
}

// ─── Notes ──────────────────────────────────────────────────────────────────

/** Get the note for a specific date */
export function getEntryNote(habit: Habit, date: string): string | undefined {
  return habit.entries?.[date]?.notes;
}

/** Get all dates that have notes */
export function getDatesWithNotes(habit: Habit): Array<{ date: string; notes: string }> {
  const result: Array<{ date: string; notes: string }> = [];
  for (const [date, entry] of Object.entries(habit.entries || {})) {
    if (entry.notes) {
      result.push({ date, notes: entry.notes });
    }
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}
