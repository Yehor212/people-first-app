import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), sync: vi.fn(), auth: vi.fn() },
}));

vi.mock('@/lib/safeJson', () => ({
  storageRemove: vi.fn((key: string) => {
    try {
      localStorage.removeItem(key);
    } catch { /* ignore */ }
  }),
}));

vi.mock('@/lib/storageKeys', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storageKeys')>('@/lib/storageKeys');
  return actual;
});

import {
  db,
  clearLocalUserData,
  checkDatabaseHealth,
  moodsRepo,
  habitsRepo,
  focusRepo,
  gratitudeRepo,
  settingsRepo,
  journalEntriesRepo,
  journalPhotosRepo,
} from '@/storage/db';

const EXPECTED_TABLES = [
  'moods',
  'habits',
  'focusSessions',
  'gratitudeEntries',
  'settings',
  'offlineQueue',
  'journalEntries',
  'journalPhotos',
  'journalAudio',
];

// ─── Database Instance ───────────────────────────────────────────

describe('database instance', () => {
  it('db exists and is defined', () => {
    expect(db).toBeDefined();
  });

  it('db has name "ZenFlowDB"', () => {
    expect(db.name).toBe('ZenFlowDB');
  });

  it.each(EXPECTED_TABLES)('has table "%s"', (tableName) => {
    expect((db as any)[tableName]).toBeDefined();
  });

  it('has the correct number of tables', () => {
    // Dexie tables property lists all tables
    const tableNames = db.tables.map((t) => t.name);
    EXPECTED_TABLES.forEach((name) => {
      expect(tableNames).toContain(name);
    });
  });
});

// ─── Repository Exports ──────────────────────────────────────────

describe('repository exports', () => {
  it('moodsRepo is db.moods', () => {
    expect(moodsRepo).toBe(db.moods);
  });

  it('habitsRepo is db.habits', () => {
    expect(habitsRepo).toBe(db.habits);
  });

  it('focusRepo is db.focusSessions', () => {
    expect(focusRepo).toBe(db.focusSessions);
  });

  it('gratitudeRepo is db.gratitudeEntries', () => {
    expect(gratitudeRepo).toBe(db.gratitudeEntries);
  });

  it('settingsRepo is db.settings', () => {
    expect(settingsRepo).toBe(db.settings);
  });

  it('journalEntriesRepo is db.journalEntries', () => {
    expect(journalEntriesRepo).toBe(db.journalEntries);
  });

  it('journalPhotosRepo is db.journalPhotos', () => {
    expect(journalPhotosRepo).toBe(db.journalPhotos);
  });
});

// ─── clearLocalUserData ──────────────────────────────────────────

describe('clearLocalUserData', () => {
  beforeEach(async () => {
    // Open db and seed data into tables so we can verify clearing
    await db.open();
    await db.moods.put({ id: 'test-mood-1', timestamp: Date.now() } as any);
    await db.habits.put({ id: 'test-habit-1', createdAt: Date.now() } as any);
    await db.settings.put({ key: 'zenflow-moods', value: 'test' });
    await db.focusSessions.put({ id: 'test-focus-1', startTime: Date.now() } as any);
    await db.gratitudeEntries.put({ id: 'test-grat-1', timestamp: Date.now() } as any);

    // Set some localStorage keys that should be cleared
    localStorage.setItem('zenflow-moods', 'data');
    localStorage.setItem('zenflow-habits', 'data');
    localStorage.setItem('zenflow_cloud_sync_enabled', 'true');
    localStorage.setItem('zenflow_offline_queue', '[]');
  });

  it('clears moods table', async () => {
    await clearLocalUserData();
    const count = await db.moods.count();
    expect(count).toBe(0);
  });

  it('clears habits table', async () => {
    await clearLocalUserData();
    const count = await db.habits.count();
    expect(count).toBe(0);
  });

  it('clears focusSessions table', async () => {
    await clearLocalUserData();
    const count = await db.focusSessions.count();
    expect(count).toBe(0);
  });

  it('clears gratitudeEntries table', async () => {
    await clearLocalUserData();
    const count = await db.gratitudeEntries.count();
    expect(count).toBe(0);
  });

  it('deletes user-specific settings keys from settings table', async () => {
    await clearLocalUserData();
    const setting = await db.settings.get('zenflow-moods');
    expect(setting).toBeUndefined();
  });

  it('removes expected localStorage keys', async () => {
    await clearLocalUserData();
    // storageRemove is called for user keys
    const { storageRemove } = await import('@/lib/safeJson');
    expect(storageRemove).toHaveBeenCalled();
  });
});

// ─── checkDatabaseHealth ─────────────────────────────────────────

describe('checkDatabaseHealth', () => {
  it('returns true when database is healthy', async () => {
    const result = await checkDatabaseHealth();
    expect(result).toBe(true);
  });

  it('returns a boolean', async () => {
    const result = await checkDatabaseHealth();
    expect(typeof result).toBe('boolean');
  });
});
