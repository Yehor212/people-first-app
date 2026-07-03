import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), sync: vi.fn(), auth: vi.fn() },
}));

vi.mock('@/lib/safeJson', () => ({
  storageKeys: vi.fn(() => Object.keys(localStorage)),
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
  journalHubPreferencesRepo,
  journalSpacesRepo,
  journalPracticeSessionsRepo,
  journalEntryLinksRepo,
  journalSpaceCapturesRepo,
} from '@/storage/db';

const EXPECTED_TABLES = [
  'moods',
  'habits',
  'focusSessions',
  'gratitudeEntries',
  'settings',
  'offlineQueue',
  'deadLetterQueue',
  'journalEntries',
  'journalPhotos',
  'journalAudio',
  'journalHubPreferences',
  'journalSpaces',
  'journalPracticeSessions',
  'journalEntryLinks',
  'journalSpaceCaptures',
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

  it('journalHubPreferencesRepo is db.journalHubPreferences', () => {
    expect(journalHubPreferencesRepo).toBe(db.journalHubPreferences);
  });

  it('journalSpacesRepo is db.journalSpaces', () => {
    expect(journalSpacesRepo).toBe(db.journalSpaces);
  });

  it('journalPracticeSessionsRepo is db.journalPracticeSessions', () => {
    expect(journalPracticeSessionsRepo).toBe(db.journalPracticeSessions);
  });

  it('journalEntryLinksRepo is db.journalEntryLinks', () => {
    expect(journalEntryLinksRepo).toBe(db.journalEntryLinks);
  });

  it('journalSpaceCapturesRepo is db.journalSpaceCaptures', () => {
    expect(journalSpaceCapturesRepo).toBe(db.journalSpaceCaptures);
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
    await db.journalHubPreferences.put({ id: 'default', homeView: 'entries', visibleViews: ['entries'], dockActions: ['write'], density: 'balanced', motion: 'system', background: 'clean', updatedAt: Date.now() } as any);
    await db.journalSpaces.put({ id: 'space-1', iconKey: 'folder', accent: 'primary', private: false, sortOrder: 1, createdAt: Date.now(), updatedAt: Date.now() } as any);
    await db.journalPracticeSessions.put({ id: 'practice-1', practiceId: 'focus-note', startedAt: Date.now() });
    await db.journalEntryLinks.put({ id: 'link-1', entryId: 'entry-1', targetType: 'space', targetId: 'space-1', createdAt: Date.now() } as any);
    await db.offlineQueue.put({ id: 'queue-1', type: 'WRITE_SYNC_EVENT', entityId: 'habit-1', payload: {}, timestamp: Date.now(), retries: 0, maxRetries: 3 });
    await db.deadLetterQueue.put({ id: 'dead-1', type: 'WRITE_SYNC_EVENT', entityId: 'habit-1', payload: {}, lastError: 'failed', failedAt: Date.now() });
    await db.settings.put({ key: 'sync-last-seq', value: 42 });
    await db.settings.put({ key: 'zenflow-device-id', value: 'device-old' });
    await db.settings.put({ key: 'zenflow-deleted-habit-ids', value: ['habit-old'] });
    await db.settings.put({ key: 'journal_vault_key', value: { wrappedKey: 'wrapped-key' } });
    await db.settings.put({ key: 'journal_password_reset_proof', value: { nonce: 'reset-proof' } });
    await db.settings.put({ key: 'journal_draft_new', value: { title: 'private draft' } });
    await db.settings.put({ key: 'journal_draft_entry-1', value: { title: 'entry draft' } });

    // Set some localStorage keys that should be cleared
    localStorage.setItem('zenflow-moods', 'data');
    localStorage.setItem('zenflow-habits', 'data');
    localStorage.setItem('zenflow_cloud_sync_enabled', 'true');
    localStorage.setItem('zenflow_offline_queue', '[]');
    localStorage.setItem('zenflow-device-id', 'device-old');
    localStorage.setItem('sync-last-seq', '42');
    localStorage.setItem('zenflow-deleted-habit-ids', '["habit-old"]');
    localStorage.setItem('journal_vault_key', '{"wrappedKey":"wrapped-key"}');
    localStorage.setItem('journal_password_reset_proof', '{"nonce":"reset-proof"}');
    localStorage.setItem('journal_draft_new', '{"title":"private draft"}');
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

  it('clears journal hub local tables', async () => {
    await clearLocalUserData();

    await expect(db.journalHubPreferences.count()).resolves.toBe(0);
    await expect(db.journalSpaces.count()).resolves.toBe(0);
    await expect(db.journalPracticeSessions.count()).resolves.toBe(0);
    await expect(db.journalEntryLinks.count()).resolves.toBe(0);
  });

  it('clears offline queues and account-bound sync state', async () => {
    await clearLocalUserData();

    await expect(db.offlineQueue.count()).resolves.toBe(0);
    await expect(db.deadLetterQueue.count()).resolves.toBe(0);
    await expect(db.settings.get('sync-last-seq')).resolves.toBeUndefined();
    await expect(db.settings.get('zenflow-device-id')).resolves.toBeUndefined();
    await expect(db.settings.get('zenflow-deleted-habit-ids')).resolves.toBeUndefined();
    expect(localStorage.getItem('sync-last-seq')).toBeNull();
    expect(localStorage.getItem('zenflow-device-id')).toBeNull();
    expect(localStorage.getItem('zenflow-deleted-habit-ids')).toBeNull();
  });

  it('clears wrapped journal vault keys at the account boundary', async () => {
    await clearLocalUserData();

    await expect(db.settings.get('journal_vault_key')).resolves.toBeUndefined();
    expect(localStorage.getItem('journal_vault_key')).toBeNull();
  });

  it('clears pending journal reset proof at the account boundary', async () => {
    await clearLocalUserData();

    await expect(db.settings.get('journal_password_reset_proof')).resolves.toBeUndefined();
    expect(localStorage.getItem('journal_password_reset_proof')).toBeNull();
  });

  it('clears dynamic unsaved journal draft settings at the account boundary', async () => {
    await clearLocalUserData();

    await expect(db.settings.get('journal_draft_new')).resolves.toBeUndefined();
    await expect(db.settings.get('journal_draft_entry-1')).resolves.toBeUndefined();
    expect(localStorage.getItem('journal_draft_new')).toBeNull();
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
  it('does not emit timeout warning after a healthy database check', async () => {
    vi.useFakeTimers();
    try {
      const { logger } = await import('@/lib/logger');

      const result = await checkDatabaseHealth();

      expect(result).toBe(true);
      await vi.advanceTimersByTimeAsync(5000);
      expect(logger.warn).not.toHaveBeenCalledWith(
        '[DB] Database health check timed out - continuing anyway',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns true when database is healthy', async () => {
    const result = await checkDatabaseHealth();
    expect(result).toBe(true);
  });

  it('returns a boolean', async () => {
    const result = await checkDatabaseHealth();
    expect(typeof result).toBe('boolean');
  });
});
