import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────

const {
  mockSettingsToArray,
  mockSettingsPut,
  mockSettingsCount,
  mockMoodsCount,
  mockHabitsCount,
  mockFocusSessionsCount,
  mockGratitudeEntriesCount,
} = vi.hoisted(() => ({
  mockSettingsToArray: vi.fn(() => Promise.resolve([] as any[])),
  mockSettingsPut: vi.fn(),
  mockSettingsCount: vi.fn(() => Promise.resolve(0)),
  mockMoodsCount: vi.fn(() => Promise.resolve(0)),
  mockHabitsCount: vi.fn(() => Promise.resolve(0)),
  mockFocusSessionsCount: vi.fn(() => Promise.resolve(0)),
  mockGratitudeEntriesCount: vi.fn(() => Promise.resolve(0)),
}));

vi.mock('@/storage/db', () => ({
  db: {
    settings: { toArray: mockSettingsToArray, put: mockSettingsPut, count: mockSettingsCount },
    moods: { count: mockMoodsCount },
    habits: { count: mockHabitsCount },
    focusSessions: { count: mockFocusSessionsCount },
    gratitudeEntries: { count: mockGratitudeEntriesCount },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { runMigrations, needsMigration, validateDataIntegrity } from '../migrations';

// ─── Setup ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── needsMigration ───────────────────────────────────────────

describe('needsMigration', () => {
  it('returns true when currentVersion < targetVersion and migration exists', () => {
    expect(needsMigration(0, 2)).toBe(true);
  });

  it('returns false when currentVersion equals targetVersion', () => {
    expect(needsMigration(2, 2)).toBe(false);
  });

  it('returns false when currentVersion is past targetVersion', () => {
    expect(needsMigration(3, 2)).toBe(false);
  });
});

// ─── runMigrations ────────────────────────────────────────────

describe('runMigrations', () => {
  it('runs migration_1_to_2 when migrating from version 0 to 2', async () => {
    mockSettingsToArray.mockResolvedValue([]);

    await runMigrations(0, 2);

    // Migration 1->2 calls settings.toArray()
    expect(mockSettingsToArray).toHaveBeenCalled();
  });

  it('does nothing when no migrations are pending', async () => {
    await runMigrations(2, 2);

    // settings.toArray should NOT be called since migration didn't run
    expect(mockSettingsToArray).not.toHaveBeenCalled();
  });

  it('re-saves settings with proper structure during migration 1->2', async () => {
    const mockSettings = [
      { key: 'theme', value: { mode: 'dark' } },
      { key: 'lang', value: { code: 'en' } },
    ];
    mockSettingsToArray.mockResolvedValue(mockSettings);

    await runMigrations(0, 2);

    expect(mockSettingsPut).toHaveBeenCalledTimes(2);
    expect(mockSettingsPut).toHaveBeenCalledWith(mockSettings[0]);
    expect(mockSettingsPut).toHaveBeenCalledWith(mockSettings[1]);
  });

  it('throws on migration failure', async () => {
    mockSettingsToArray.mockRejectedValue(new Error('DB read failed'));

    await expect(runMigrations(0, 2)).rejects.toThrow('Migration failed');
  });
});

// ─── validateDataIntegrity ────────────────────────────────────

describe('validateDataIntegrity', () => {
  it('returns true when all tables are accessible', async () => {
    const result = await validateDataIntegrity();

    expect(result).toBe(true);
    expect(mockMoodsCount).toHaveBeenCalled();
    expect(mockHabitsCount).toHaveBeenCalled();
    expect(mockFocusSessionsCount).toHaveBeenCalled();
    expect(mockGratitudeEntriesCount).toHaveBeenCalled();
    expect(mockSettingsCount).toHaveBeenCalled();
  });

  it('returns false when a table throws an error', async () => {
    mockHabitsCount.mockRejectedValue(new Error('Table corrupted'));

    const result = await validateDataIntegrity();

    expect(result).toBe(false);
  });
});
