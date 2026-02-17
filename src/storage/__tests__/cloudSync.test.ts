import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks (must be hoisted before imports) ──────────────────────────────────

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

let mockSupabase: any = null;

vi.mock('@/lib/supabaseClient', () => ({
  get supabase() {
    return mockSupabase;
  },
}));

vi.mock('@/storage/backup', () => ({
  exportBackup: vi.fn(),
  importBackup: vi.fn(),
}));

vi.mock('@/hooks/useIndexedDB', () => ({
  triggerDataRefresh: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  default: { sync: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/syncOrchestrator', () => ({
  syncOrchestrator: {
    sync: vi.fn(),
  },
}));

vi.mock('@/lib/validation', () => ({
  generateSecureRandom: vi.fn(() => 'abc123'),
  isAbortError: vi.fn((err: unknown) => err instanceof DOMException && err.name === 'AbortError'),
}));

vi.mock('@/lib/sentry', () => ({
  addCategorizedBreadcrumb: vi.fn(),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import {
  syncWithCloud,
  silentSync,
  startAutoSync,
  stopAutoSync,
  triggerSync,
  flushSync,
  destroyCloudSync,
} from '@/storage/cloudSync';

import { exportBackup, importBackup } from '@/storage/backup';
import { triggerDataRefresh } from '@/hooks/useIndexedDB';
import { syncOrchestrator } from '@/lib/syncOrchestrator';
import { isAbortError } from '@/lib/validation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockExportBackup = vi.mocked(exportBackup);
const mockImportBackup = vi.mocked(importBackup);
const mockTriggerDataRefresh = vi.mocked(triggerDataRefresh);
const mockOrchestratorSync = vi.mocked(syncOrchestrator.sync);

function createMockSupabase() {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockUpsert.mockResolvedValue({ error: null });
  mockFrom.mockImplementation((_table: string) => ({
    select: mockSelect,
    upsert: mockUpsert,
  }));
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  return {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  };
}

const LOCAL_BACKUP = {
  schemaVersion: 1,
  exportedAt: '2024-01-01T00:00:00.000Z',
  data: {
    moods: [{ id: 'm1' }],
    habits: [],
    focusSessions: [],
    gratitudeEntries: [],
    journalEntries: [],
  },
};

const EMPTY_BACKUP = {
  schemaVersion: 1,
  exportedAt: '2024-01-01T00:00:00.000Z',
  data: {
    moods: [],
    habits: [],
    focusSessions: [],
    gratitudeEntries: [],
    journalEntries: [],
  },
};

const REMOTE_PAYLOAD = {
  schemaVersion: 1,
  exportedAt: '2024-01-01T00:00:00.000Z',
  data: {
    moods: [{ id: 'r1' }],
    habits: [{ id: 'r2' }],
    focusSessions: [],
    gratitudeEntries: [],
    journalEntries: [],
  },
};

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  // Reset module-level state via destroyCloudSync
  destroyCloudSync();
  // Clear all mock call history
  vi.clearAllMocks();
  // Restore isAbortError to its default factory behavior in case a test overrode it
  vi.mocked(isAbortError).mockImplementation(
    (err: unknown) => err instanceof DOMException && err.name === 'AbortError'
  );
  // Reset mockSupabase to null by default
  mockSupabase = null;
});

afterEach(() => {
  destroyCloudSync();
  vi.useRealTimers();
});

// ─── syncWithCloud ───────────────────────────────────────────────────────────

describe('syncWithCloud', () => {
  it('throws when supabase is null', async () => {
    mockSupabase = null;
    await expect(syncWithCloud()).rejects.toThrow('Supabase not configured.');
  });

  it('throws when user is not authenticated', async () => {
    mockSupabase = createMockSupabase();
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(syncWithCloud()).rejects.toThrow('Not authenticated.');
  });

  it('pushes local data when no remote data exists', async () => {
    mockSupabase = createMockSupabase();
    mockExportBackup.mockResolvedValue(LOCAL_BACKUP as any);
    // Remote returns null (no data)
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await syncWithCloud();

    expect(result).toEqual({ status: 'pushed' });
    expect(mockFrom).toHaveBeenCalledWith('user_backups');
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('merges remote data into local and returns merged status', async () => {
    mockSupabase = createMockSupabase();
    mockExportBackup.mockResolvedValue(LOCAL_BACKUP as any);
    mockMaybeSingle.mockResolvedValue({
      data: { payload: REMOTE_PAYLOAD, updated_at: '2024-01-01' },
      error: null,
    });

    const result = await syncWithCloud();

    expect(result).toEqual({ status: 'merged' });
    expect(mockImportBackup).toHaveBeenCalledWith(REMOTE_PAYLOAD, 'merge');
    expect(mockTriggerDataRefresh).toHaveBeenCalled();
  });

  it('returns pulled status when local is empty but remote has data', async () => {
    mockSupabase = createMockSupabase();
    mockExportBackup.mockResolvedValue(EMPTY_BACKUP as any);
    mockMaybeSingle.mockResolvedValue({
      data: { payload: REMOTE_PAYLOAD, updated_at: '2024-01-01' },
      error: null,
    });

    const result = await syncWithCloud();

    expect(result).toEqual({ status: 'pulled' });
    expect(mockImportBackup).toHaveBeenCalledWith(REMOTE_PAYLOAD, 'merge');
    expect(mockTriggerDataRefresh).toHaveBeenCalled();
  });

  it('throws when upsert returns an error', async () => {
    mockSupabase = createMockSupabase();
    mockExportBackup.mockResolvedValue(LOCAL_BACKUP as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ error: new Error('Upsert failed') });

    await expect(syncWithCloud()).rejects.toThrow('Upsert failed');
  });

  it('concurrent callers share the same promise (P1-11 lock)', async () => {
    mockSupabase = createMockSupabase();
    // Use a deferred pattern so we can control resolution timing
    let resolveExport!: (val: any) => void;
    const exportPromise = new Promise((resolve) => {
      resolveExport = resolve;
    });
    mockExportBackup.mockReturnValue(exportPromise as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Start two concurrent calls
    const promise1 = syncWithCloud();
    const promise2 = syncWithCloud();

    // Resolve the export
    resolveExport(LOCAL_BACKUP);

    const [result1, result2] = await Promise.all([promise1, promise2]);

    // Both should get the same result
    expect(result1).toEqual({ status: 'pushed' });
    expect(result2).toEqual({ status: 'pushed' });

    // exportBackup should only be called once (second caller waits for same promise)
    expect(mockExportBackup).toHaveBeenCalledTimes(1);
  });

  it('calls exportBackup and passes result to upsert', async () => {
    mockSupabase = createMockSupabase();
    mockExportBackup.mockResolvedValue(LOCAL_BACKUP as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await syncWithCloud();

    expect(mockExportBackup).toHaveBeenCalled();
    // The upsert call should contain the backup payload
    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg).toMatchObject({
      user_id: 'user-1',
      payload: LOCAL_BACKUP,
    });
    expect(upsertArg.updated_at).toBeDefined();
  });

  it('uses replace mode when specified', async () => {
    mockSupabase = createMockSupabase();
    mockExportBackup.mockResolvedValue(LOCAL_BACKUP as any);
    mockMaybeSingle.mockResolvedValue({
      data: { payload: REMOTE_PAYLOAD, updated_at: '2024-01-01' },
      error: null,
    });

    await syncWithCloud('replace');

    expect(mockImportBackup).toHaveBeenCalledWith(REMOTE_PAYLOAD, 'replace');
  });

  it('throws when fetch (select) returns an error', async () => {
    mockSupabase = createMockSupabase();
    mockExportBackup.mockResolvedValue(LOCAL_BACKUP as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('Fetch error') });

    await expect(syncWithCloud()).rejects.toThrow('Fetch error');
  });

  it('re-exports backup after merge before upserting', async () => {
    mockSupabase = createMockSupabase();
    // First call: local backup; second call: merged backup
    const mergedBackup = { ...LOCAL_BACKUP, data: { ...LOCAL_BACKUP.data, moods: [{ id: 'm1' }, { id: 'r1' }] } };
    mockExportBackup
      .mockResolvedValueOnce(LOCAL_BACKUP as any)
      .mockResolvedValueOnce(mergedBackup as any);
    mockMaybeSingle.mockResolvedValue({
      data: { payload: REMOTE_PAYLOAD, updated_at: '2024-01-01' },
      error: null,
    });

    await syncWithCloud();

    // exportBackup called twice: once for initial, once after merge
    expect(mockExportBackup).toHaveBeenCalledTimes(2);
    // Upsert should use the re-exported (merged) backup
    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.payload).toEqual(mergedBackup);
  });

  it('does not re-export backup when pushing only (no merge)', async () => {
    mockSupabase = createMockSupabase();
    mockExportBackup.mockResolvedValue(LOCAL_BACKUP as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await syncWithCloud();

    // Only one exportBackup call (the initial one)
    expect(mockExportBackup).toHaveBeenCalledTimes(1);
  });
});

// ─── silentSync ──────────────────────────────────────────────────────────────

describe('silentSync', () => {
  it('calls syncOrchestrator.sync with "backup" and priority 5', async () => {
    mockOrchestratorSync.mockResolvedValue(undefined);

    await silentSync();

    expect(mockOrchestratorSync).toHaveBeenCalledTimes(1);
    const [opType, , options] = mockOrchestratorSync.mock.calls[0];
    expect(opType).toBe('backup');
    expect(options).toMatchObject({ priority: 5, maxRetries: 3 });
  });

  it('callback calls syncWithCloud with merge mode', async () => {
    mockSupabase = createMockSupabase();
    mockExportBackup.mockResolvedValue(LOCAL_BACKUP as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Capture the callback and execute it
    mockOrchestratorSync.mockImplementation(async (_type, callback) => {
      await callback();
    });

    await silentSync();

    // syncWithCloud('merge') was invoked inside the callback
    expect(mockExportBackup).toHaveBeenCalled();
    expect(mockGetUser).toHaveBeenCalled();
  });

  it('callback re-throws non-abort errors for orchestrator retry', async () => {
    mockSupabase = createMockSupabase();
    const syncError = new Error('Network failure');
    mockExportBackup.mockRejectedValue(syncError);

    mockOrchestratorSync.mockImplementation(async (_type, callback) => {
      await callback();
    });

    await expect(silentSync()).rejects.toThrow('Network failure');
  });

  it('callback does not throw on abort errors', async () => {
    mockSupabase = createMockSupabase();
    const abortError = new DOMException('Aborted', 'AbortError');
    mockExportBackup.mockRejectedValue(abortError);

    // isAbortError mock returns true for AbortError
    const { isAbortError } = await import('@/lib/validation');
    vi.mocked(isAbortError).mockReturnValue(true);

    mockOrchestratorSync.mockImplementation(async (_type, callback) => {
      await callback();
    });

    // Should not throw
    await expect(silentSync()).resolves.toBeUndefined();
  });

  it('emits sync-failure event after consecutive failures', async () => {
    mockSupabase = createMockSupabase();

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    // Simulate failures by having the orchestrator callback reject
    // but catch the error ourselves so we can still track dispatch events
    let callCount = 0;
    mockOrchestratorSync.mockImplementation(async (_type: any, callback: any) => {
      callCount++;
      // Execute the real callback path by simulating what it does:
      // - incrementing consecutiveSyncFailures (module-level state)
      // - dispatching sync-failure event
      // We do this by calling the actual callback, which calls syncWithCloud internally
      try {
        await callback();
      } catch {
        // Expected: the callback re-throws for orchestrator retry
      }
    });

    // Make syncWithCloud fail inside the callback
    mockExportBackup.mockImplementation(() => Promise.reject(new Error('Sync fail')));

    // Call silentSync multiple times to accumulate failures
    // silentSync delegates to orchestrator, which catches the error internally
    await silentSync();
    await silentSync();
    await silentSync();

    // Should have dispatched sync-failure events
    const failureEvents = dispatchSpy.mock.calls.filter(
      (call) => (call[0] as CustomEvent).type === 'zenflow:sync-failure'
    );
    expect(failureEvents.length).toBe(3);

    // The third event should have shouldNotify: true
    const thirdEvent = failureEvents[2][0] as CustomEvent;
    expect(thirdEvent.detail.shouldNotify).toBe(true);
    expect(thirdEvent.detail.consecutiveFailures).toBe(3);

    dispatchSpy.mockRestore();
  });
});

// ─── startAutoSync / stopAutoSync ────────────────────────────────────────────

describe('startAutoSync', () => {
  it('does not set interval when supabase is null', () => {
    mockSupabase = null;
    const spy = vi.spyOn(globalThis, 'setInterval');

    startAutoSync();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('sets interval for periodic sync', () => {
    mockSupabase = createMockSupabase();
    const spy = vi.spyOn(globalThis, 'setInterval');

    startAutoSync();

    // Should set a 10-minute interval
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 10 * 60 * 1000);
    spy.mockRestore();
  });

  it('does not duplicate when called twice (autoSyncStarted guard)', () => {
    mockSupabase = createMockSupabase();
    const spy = vi.spyOn(globalThis, 'setInterval');

    startAutoSync();
    startAutoSync();

    // setInterval should only be called once
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('adds visibilitychange listener', () => {
    mockSupabase = createMockSupabase();
    const spy = vi.spyOn(document, 'addEventListener');

    startAutoSync();

    expect(spy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    spy.mockRestore();
  });

  it('adds beforeunload listener', () => {
    mockSupabase = createMockSupabase();
    const spy = vi.spyOn(window, 'addEventListener');

    startAutoSync();

    expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    spy.mockRestore();
  });
});

describe('stopAutoSync', () => {
  it('clears interval', () => {
    mockSupabase = createMockSupabase();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    startAutoSync();
    stopAutoSync();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('removes visibilitychange and beforeunload listeners', () => {
    mockSupabase = createMockSupabase();
    const docSpy = vi.spyOn(document, 'removeEventListener');
    const winSpy = vi.spyOn(window, 'removeEventListener');

    startAutoSync();
    stopAutoSync();

    expect(docSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(winSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    docSpy.mockRestore();
    winSpy.mockRestore();
  });

  it('resets autoSyncStarted flag so startAutoSync can be called again', () => {
    mockSupabase = createMockSupabase();
    const spy = vi.spyOn(globalThis, 'setInterval');

    startAutoSync();
    stopAutoSync();
    startAutoSync();

    // setInterval called twice (once per start)
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

// ─── triggerSync ─────────────────────────────────────────────────────────────

describe('triggerSync', () => {
  it('is a no-op when supabase is null', () => {
    mockSupabase = null;
    const spy = vi.spyOn(globalThis, 'setTimeout');

    triggerSync();

    // No timeout should be set for the debounce
    const syncTimeoutCalls = spy.mock.calls.filter(
      (call) => call[1] === 120_000
    );
    expect(syncTimeoutCalls).toHaveLength(0);
    spy.mockRestore();
  });

  it('sets a debounced timeout (120s)', () => {
    mockSupabase = createMockSupabase();
    const spy = vi.spyOn(globalThis, 'setTimeout');

    triggerSync();

    const syncTimeoutCalls = spy.mock.calls.filter(
      (call) => call[1] === 120_000
    );
    expect(syncTimeoutCalls).toHaveLength(1);
    spy.mockRestore();
  });

  it('clears previous timeout when called again', () => {
    mockSupabase = createMockSupabase();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

    triggerSync();
    triggerSync();

    // Second call should clear the first timeout
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

// ─── flushSync ───────────────────────────────────────────────────────────────

describe('flushSync', () => {
  it('is a no-op when supabase is null', () => {
    mockSupabase = null;
    const spy = vi.spyOn(globalThis, 'clearTimeout');

    flushSync();

    // Should not attempt to clear anything because it returns early
    // (clearTimeout is not called in the supabase=null path)
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('cancels pending debounced sync timeout', () => {
    mockSupabase = createMockSupabase();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

    triggerSync(); // Set a debounced timeout
    flushSync(); // Should clear it

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('triggers immediate silentSync', () => {
    mockSupabase = createMockSupabase();
    mockOrchestratorSync.mockResolvedValue(undefined);

    flushSync();

    // silentSync was called, which calls syncOrchestrator.sync
    expect(mockOrchestratorSync).toHaveBeenCalled();
  });
});

// ─── destroyCloudSync ────────────────────────────────────────────────────────

describe('destroyCloudSync', () => {
  it('calls stopAutoSync (clears interval and listeners)', () => {
    mockSupabase = createMockSupabase();
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    startAutoSync();
    destroyCloudSync();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('aborts in-progress sync operation', async () => {
    mockSupabase = createMockSupabase();
    // Create an in-progress sync by making exportBackup hang
    let resolveExport!: (val: any) => void;
    mockExportBackup.mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve;
      }) as any
    );

    // Start sync — it will block on exportBackup
    const syncPromise = syncWithCloud().catch(() => {
      // We expect this to fail — catch to prevent unhandled rejection
    });

    // Now destroy while sync is in progress — this aborts the controller
    destroyCloudSync();

    // Resolve the hanging export so the promise chain can settle
    resolveExport(LOCAL_BACKUP);

    // Wait for everything to settle
    await syncPromise;

    // After destroy, the abort controller should have been aborted
    // The sync should have been cleaned up (currentSyncPromise is null)
    // Verify we can start a fresh sync without issues
    mockSupabase = createMockSupabase();
    vi.mocked(exportBackup).mockResolvedValue(LOCAL_BACKUP as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await syncWithCloud();
    expect(result).toEqual({ status: 'pushed' });
  });

  it('resets all module state so a fresh start is possible', async () => {
    mockSupabase = createMockSupabase();
    mockExportBackup.mockResolvedValue(LOCAL_BACKUP as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Run a sync, then destroy, then start fresh
    await syncWithCloud();
    destroyCloudSync();

    // Should be able to start auto-sync again
    const spy = vi.spyOn(globalThis, 'setInterval');
    startAutoSync();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();

    // Should be able to sync again
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockExportBackup.mockResolvedValue(LOCAL_BACKUP as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await syncWithCloud();
    expect(result).toEqual({ status: 'pushed' });
  });
});
