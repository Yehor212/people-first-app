import { describe, it, expect } from 'vitest';
import { needsMigration, migrateHabitV1toV2, migrateAllHabits } from '@/lib/habitMigration';
import { ENTRY } from '@/types';

// ─── Helper: minimal v1 habit ────────────────────────────────────

function makeV1Habit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'h1',
    name: 'Drink Water',
    icon: '💧',
    color: '#D32F2F',
    createdAt: 1700000000000,
    ...overrides,
  };
}

// ─── needsMigration ──────────────────────────────────────────────

describe('needsMigration', () => {
  it('returns false for empty array', () => {
    expect(needsMigration([])).toBe(false);
  });

  it('returns false for null/undefined input', () => {
    expect(needsMigration(null as unknown as unknown[])).toBe(false);
    expect(needsMigration(undefined as unknown as unknown[])).toBe(false);
  });

  it('returns true when habit has completedDates', () => {
    expect(needsMigration([{ completedDates: ['2024-01-01'] }])).toBe(true);
  });

  it('returns true when habit has skippedDates', () => {
    expect(needsMigration([{ skippedDates: ['2024-01-01'] }])).toBe(true);
  });

  it('returns true when habit has progressByDate', () => {
    expect(needsMigration([{ progressByDate: { '2024-01-01': 5 } }])).toBe(true);
  });

  it('returns true when habit has completionsByDate', () => {
    expect(needsMigration([{ completionsByDate: { '2024-01-01': 3 } }])).toBe(true);
  });

  it('returns true when color is a string (legacy format)', () => {
    expect(needsMigration([{ color: '#FF0000' }])).toBe(true);
  });

  it('returns false when all habits are v2 format', () => {
    const v2Habit = {
      color: 5,
      entries: { '2024-01-01': { value: 2 } },
    };
    expect(needsMigration([v2Habit])).toBe(false);
  });

  it('returns true if ANY habit in array needs migration', () => {
    const v2 = { color: 5, entries: {} };
    const v1 = { completedDates: ['2024-01-01'] };
    expect(needsMigration([v2, v1])).toBe(true);
  });
});

// ─── migrateHabitV1toV2 ──────────────────────────────────────────

describe('migrateHabitV1toV2', () => {
  it('converts completedDates to YES_MANUAL entries', () => {
    const v1 = makeV1Habit({ completedDates: ['2024-01-01', '2024-01-02'] });
    const result = migrateHabitV1toV2(v1, 0);

    expect(result.entries['2024-01-01'].value).toBe(ENTRY.YES_MANUAL);
    expect(result.entries['2024-01-02'].value).toBe(ENTRY.YES_MANUAL);
  });

  it('converts skippedDates to SKIP entries', () => {
    const v1 = makeV1Habit({ skippedDates: ['2024-01-03'] });
    const result = migrateHabitV1toV2(v1, 0);

    expect(result.entries['2024-01-03'].value).toBe(ENTRY.SKIP);
  });

  it('skip overrides completed for same date', () => {
    const v1 = makeV1Habit({
      completedDates: ['2024-01-01'],
      skippedDates: ['2024-01-01'],
    });
    const result = migrateHabitV1toV2(v1, 0);

    expect(result.entries['2024-01-01'].value).toBe(ENTRY.SKIP);
  });

  it('converts completionsByDate for multiple type (value * 1000)', () => {
    const v1 = makeV1Habit({
      type: 'multiple',
      completionsByDate: { '2024-01-01': 3, '2024-01-02': 5 },
    });
    const result = migrateHabitV1toV2(v1, 0);

    expect(result.entries['2024-01-01'].value).toBe(3000);
    expect(result.entries['2024-01-02'].value).toBe(5000);
  });

  it('converts progressByDate for reduce type (value * 1000)', () => {
    const v1 = makeV1Habit({
      type: 'reduce',
      progressByDate: { '2024-01-01': 2 },
    });
    const result = migrateHabitV1toV2(v1, 0);

    expect(result.entries['2024-01-01'].value).toBe(2000);
  });

  it('merges notesByDate into entries', () => {
    const v1 = makeV1Habit({
      completedDates: ['2024-01-01'],
      notesByDate: { '2024-01-01': 'Felt great', '2024-01-02': 'Note without entry' },
    });
    const result = migrateHabitV1toV2(v1, 0);

    expect(result.entries['2024-01-01'].notes).toBe('Felt great');
    // Date with note only gets UNKNOWN value
    expect(result.entries['2024-01-02'].value).toBe(ENTRY.UNKNOWN);
    expect(result.entries['2024-01-02'].notes).toBe('Note without entry');
  });

  it('maps type "multiple" to habitType "numerical"', () => {
    const v1 = makeV1Habit({ type: 'multiple' });
    const result = migrateHabitV1toV2(v1, 0);
    expect(result.habitType).toBe('numerical');
  });

  it('maps type "reduce" to habitType "numerical" and targetType "atMost"', () => {
    const v1 = makeV1Habit({ type: 'reduce' });
    const result = migrateHabitV1toV2(v1, 0);
    expect(result.habitType).toBe('numerical');
    expect(result.targetType).toBe('atMost');
  });

  it('maps type "daily" to habitType "boolean" and targetType "atLeast"', () => {
    const v1 = makeV1Habit({ type: 'daily' });
    const result = migrateHabitV1toV2(v1, 0);
    expect(result.habitType).toBe('boolean');
    expect(result.targetType).toBe('atLeast');
  });

  it('maps frequency "weekly" to ratio 1/7', () => {
    const v1 = makeV1Habit({ frequency: 'weekly' });
    const result = migrateHabitV1toV2(v1, 0);
    expect(result.frequency).toEqual({ numerator: 1, denominator: 7 });
  });

  it('maps frequency "once" to ratio 1/30', () => {
    const v1 = makeV1Habit({ frequency: 'once' });
    const result = migrateHabitV1toV2(v1, 0);
    expect(result.frequency).toEqual({ numerator: 1, denominator: 30 });
  });

  it('uses explicit numerator/denominator over frequency string', () => {
    const v1 = makeV1Habit({
      frequency: 'daily',
      frequencyNumerator: 3,
      frequencyDenominator: 7,
    });
    const result = migrateHabitV1toV2(v1, 0);
    expect(result.frequency).toEqual({ numerator: 3, denominator: 7 });
  });

  it('maps custom frequency using customDays length', () => {
    const v1 = makeV1Habit({
      frequency: 'custom',
      customDays: [1, 3, 5],
    });
    const result = migrateHabitV1toV2(v1, 0);
    expect(result.frequency).toEqual({ numerator: 3, denominator: 7 });
  });

  it('defaults frequency to 1/1 for unknown frequency', () => {
    const v1 = makeV1Habit({});
    const result = migrateHabitV1toV2(v1, 0);
    expect(result.frequency).toEqual({ numerator: 1, denominator: 1 });
  });

  it('converts color string to palette index', () => {
    const v1 = makeV1Habit({ color: '#D32F2F' }); // index 0 exact
    const result = migrateHabitV1toV2(v1, 0);
    expect(result.color).toBe(0);
  });

  it('preserves numeric color if already migrated', () => {
    const v1 = makeV1Habit({ color: 5 });
    const result = migrateHabitV1toV2(v1, 0);
    expect(result.color).toBe(5);
  });

  it('uses index parameter as position fallback', () => {
    const v1 = makeV1Habit({});
    const result = migrateHabitV1toV2(v1, 7);
    expect(result.position).toBe(7);
  });

  it('preserves existing position over index', () => {
    const v1 = makeV1Habit({ position: 3 });
    const result = migrateHabitV1toV2(v1, 7);
    expect(result.position).toBe(3);
  });

  it('is idempotent — already-migrated habit passes through cleanly', () => {
    const v1 = makeV1Habit({
      color: 5,
      entries: { '2024-01-01': { value: 2 } },
      completedDates: ['2024-01-01'], // leftover v1 field
    });
    const result = migrateHabitV1toV2(v1, 0);
    // Should strip completedDates and return clean
    expect(result.entries).toEqual({ '2024-01-01': { value: 2 } });
    expect((result as any).completedDates).toBeUndefined();
  });

  it('preserves optional fields (reminders, templateId, category)', () => {
    const v1 = makeV1Habit({
      reminders: [{ enabled: true, time: '09:00', days: [1, 2, 3] }],
      templateId: 'tmpl-1',
      category: 'health',
      identityCluster: 'fitness',
    });
    const result = migrateHabitV1toV2(v1, 0);
    expect(result.reminders).toHaveLength(1);
    expect(result.templateId).toBe('tmpl-1');
    expect(result.category).toBe('health');
    expect(result.identityCluster).toBe('fitness');
  });
});

// ─── migrateAllHabits ────────────────────────────────────────────

describe('migrateAllHabits', () => {
  it('migrates array of v1 habits', () => {
    const habits = [
      makeV1Habit({ id: 'a', completedDates: ['2024-01-01'] }),
      makeV1Habit({ id: 'b', completedDates: ['2024-01-02'] }),
    ];
    const result = migrateAllHabits(habits);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
  });

  it('assigns position from array index', () => {
    const habits = [
      makeV1Habit({ id: 'a' }),
      makeV1Habit({ id: 'b' }),
    ];
    const result = migrateAllHabits(habits);
    expect(result[0].position).toBe(0);
    expect(result[1].position).toBe(1);
  });

  it('does not mutate original array', () => {
    const original = makeV1Habit({ completedDates: ['2024-01-01'] });
    const arr = [original];
    migrateAllHabits(arr);
    // Original should still have completedDates
    expect((original as any).completedDates).toEqual(['2024-01-01']);
  });
});
