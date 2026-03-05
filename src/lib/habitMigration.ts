/**
 * habitMigration.ts — v1 → v2 habit data migration.
 *
 * Converts old habit format (completedDates, skippedDates, etc.)
 * to Loop-faithful format (entries Record).
 *
 * Safe to run multiple times (idempotent).
 */

import type { Habit, HabitEntry, LoopHabitType, TargetType, HabitFrequencyRatio, HabitCategory } from '@/types';
import { ENTRY } from '@/types';
import { migrateColorToIndex } from './habitColorUtils';

// ─── v1 type definitions (what old habits look like) ─────────────────────────

interface HabitV1 {
  id: string;
  name: string;
  icon: string;
  color: string;           // hex string or Tailwind class
  createdAt: number;

  // Old type system
  type?: 'daily' | 'scheduled' | 'continuous' | 'multiple' | 'reduce';
  frequency?: 'daily' | 'weekly' | 'custom' | 'once';
  customDays?: number[];
  frequencyNumerator?: number;
  frequencyDenominator?: number;

  // Old data arrays
  completedDates?: string[];
  skippedDates?: string[];
  completionsByDate?: Record<string, number>;
  progressByDate?: Record<string, number>;
  notesByDate?: Record<string, string>;

  // Old fields
  questionPrompt?: string;
  dailyTarget?: number;
  targetCount?: number;
  startDate?: string;
  failedDates?: string[];
  isArchived?: boolean;

  // Preserved fields
  reminders?: Array<{ enabled: boolean; time: string; days: number[] }>;
  templateId?: string;
  category?: HabitCategory;
  identityCluster?: string;
  identityVerb?: string;
  identityIcon?: string;
  updatedAt?: string;

  // New fields (already migrated)
  habitType?: LoopHabitType;
  entries?: Record<string, HabitEntry>;
  position?: number;
  frequency_ratio?: HabitFrequencyRatio;
}

// ─── Detection ───────────────────────────────────────────────────────────────

/**
 * Check if a habit array needs v1→v2 migration.
 * Returns true if any habit has old-format fields.
 */
export function needsMigration(habits: unknown[]): boolean {
  if (!habits || habits.length === 0) return false;
  return habits.some((h: any) =>
    'completedDates' in h ||
    'skippedDates' in h ||
    'progressByDate' in h ||
    'completionsByDate' in h ||
    typeof h.color === 'string'
  );
}

// ─── Migration ───────────────────────────────────────────────────────────────

/**
 * Migrate a single v1 habit to v2 format.
 */
export function migrateHabitV1toV2(old: HabitV1, index: number): Habit {
  // If already migrated (has entries + numeric color), strip leftover v1 fields and return.
  // Without stripping, needsMigration() keeps detecting old fields → infinite hydration loop.
  if (old.entries && typeof old.color === 'number') {
    const { completedDates: _cd, skippedDates: _sd, progressByDate: _pbd, completionsByDate: _cbd, notesByDate: _nbd, type: _t, ...clean } = old as any;
    return clean as unknown as Habit;
  }

  const entries: Record<string, HabitEntry> = {};

  // 1. Convert completedDates → YES_MANUAL entries
  if (old.completedDates) {
    for (const date of old.completedDates) {
      entries[date] = { value: ENTRY.YES_MANUAL };
    }
  }

  // 2. Convert skippedDates → SKIP entries (overrides completedDates if conflict)
  if (old.skippedDates) {
    for (const date of old.skippedDates) {
      entries[date] = { ...entries[date], value: ENTRY.SKIP };
    }
  }

  // 3. Convert completionsByDate → numerical entries (value × 1000)
  if (old.type === 'multiple' && old.completionsByDate) {
    for (const [date, count] of Object.entries(old.completionsByDate)) {
      entries[date] = { value: count * 1000, notes: entries[date]?.notes };
    }
  }

  // 4. Convert progressByDate → numerical entries
  if (old.type === 'reduce' && old.progressByDate) {
    for (const [date, val] of Object.entries(old.progressByDate)) {
      entries[date] = { value: val * 1000, notes: entries[date]?.notes };
    }
  }

  // 5. Merge notesByDate into entries
  if (old.notesByDate) {
    for (const [date, note] of Object.entries(old.notesByDate)) {
      entries[date] = {
        ...(entries[date] ?? { value: ENTRY.UNKNOWN }),
        notes: note,
      };
    }
  }

  // 6. Map type
  const habitType: LoopHabitType =
    (old.type === 'multiple' || old.type === 'reduce') ? 'numerical' : 'boolean';

  // 7. Map frequency
  const frequency: HabitFrequencyRatio = mapFrequency(old);

  // 8. Map color string → palette index
  const colorIndex = typeof old.color === 'number'
    ? old.color
    : migrateColorToIndex(old.color);

  // 9. Map target type
  const targetType: TargetType = old.type === 'reduce' ? 'atMost' : 'atLeast';

  return {
    id: old.id,
    name: old.name,
    icon: old.icon,
    color: colorIndex,
    position: old.position ?? index,
    createdAt: old.createdAt,

    habitType,
    frequency,
    question: old.questionPrompt ?? '',
    description: '',
    isArchived: old.isArchived ?? false,

    targetValue: old.dailyTarget ?? old.targetCount ?? 0,
    targetType,
    unit: '',

    entries,
    reminders: old.reminders ?? [],

    templateId: old.templateId,
    category: old.category,
    identityCluster: old.identityCluster,
    identityVerb: old.identityVerb,
    identityIcon: old.identityIcon,
    updatedAt: old.updatedAt,
  };
}

/** Map old frequency fields to HabitFrequencyRatio */
function mapFrequency(old: HabitV1): HabitFrequencyRatio {
  // Explicit numerator/denominator takes priority
  if (old.frequencyNumerator != null && old.frequencyDenominator != null) {
    return {
      numerator: old.frequencyNumerator,
      denominator: old.frequencyDenominator,
    };
  }

  switch (old.frequency) {
    case 'daily':
      return { numerator: 1, denominator: 1 };
    case 'weekly':
      return { numerator: 1, denominator: 7 };
    case 'custom':
      if (old.customDays && old.customDays.length > 0) {
        return { numerator: old.customDays.length, denominator: 7 };
      }
      return { numerator: 1, denominator: 1 };
    case 'once':
      return { numerator: 1, denominator: 30 };
    default:
      return { numerator: 1, denominator: 1 };
  }
}

/**
 * Migrate an entire array of habits from v1 to v2.
 * Returns the migrated array (new objects — does not mutate originals).
 */
export function migrateAllHabits(habits: unknown[]): Habit[] {
  return (habits as HabitV1[]).map((h, i) => migrateHabitV1toV2(h, i));
}
