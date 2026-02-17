import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/safeJson', () => ({
  safeLocalStorageGet: vi.fn(),
  safeLocalStorageSet: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  APP_VERSION,
  DATA_SCHEMA_VERSION,
  MIN_SUPPORTED_VERSION,
  getAppMetadata,
  saveAppMetadata,
  wasAppUpdated,
  initializeAppMetadata,
} from '@/lib/appVersion';
import type { AppMetadata } from '@/lib/appVersion';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeJson';
import { logger } from '@/lib/logger';
import { SK } from '@/lib/storageKeys';

const mockedGet = vi.mocked(safeLocalStorageGet);
const mockedSet = vi.mocked(safeLocalStorageSet);
const mockedLogger = vi.mocked(logger);

beforeEach(() => {
  vi.clearAllMocks();
  mockedSet.mockReturnValue(true);
});

// ─── Constants ──────────────────────────────────────────────────

describe('constants', () => {
  it('APP_VERSION is a string', () => {
    expect(typeof APP_VERSION).toBe('string');
  });

  it('APP_VERSION matches semver format', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('DATA_SCHEMA_VERSION is a number', () => {
    expect(typeof DATA_SCHEMA_VERSION).toBe('number');
  });

  it('DATA_SCHEMA_VERSION is a positive integer', () => {
    expect(DATA_SCHEMA_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(DATA_SCHEMA_VERSION)).toBe(true);
  });

  it('MIN_SUPPORTED_VERSION is a string matching semver', () => {
    expect(MIN_SUPPORTED_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ─── getAppMetadata ─────────────────────────────────────────────

describe('getAppMetadata', () => {
  it('returns null when nothing is stored', () => {
    mockedGet.mockReturnValue(null);
    expect(getAppMetadata()).toBeNull();
  });

  it('returns stored metadata', () => {
    const metadata: AppMetadata = {
      appVersion: '1.7.0',
      dataSchemaVersion: 2,
      lastUpdateDate: '2026-01-01T00:00:00.000Z',
      installDate: '2025-06-01T00:00:00.000Z',
      updateCount: 3,
    };
    mockedGet.mockReturnValue(metadata);
    expect(getAppMetadata()).toEqual(metadata);
  });

  it('calls safeLocalStorageGet with correct key', () => {
    mockedGet.mockReturnValue(null);
    getAppMetadata();
    expect(mockedGet).toHaveBeenCalledWith(SK.APP_METADATA, null);
  });
});

// ─── saveAppMetadata ────────────────────────────────────────────

describe('saveAppMetadata', () => {
  it('calls safeLocalStorageSet with correct key and data', () => {
    const metadata: AppMetadata = {
      appVersion: '1.7.2',
      dataSchemaVersion: 2,
      lastUpdateDate: '2026-02-17T00:00:00.000Z',
      installDate: '2025-06-01T00:00:00.000Z',
      updateCount: 1,
    };
    saveAppMetadata(metadata);
    expect(mockedSet).toHaveBeenCalledWith(SK.APP_METADATA, metadata);
  });

  it('logs error when save fails', () => {
    mockedSet.mockReturnValue(false);
    const metadata: AppMetadata = {
      appVersion: '1.7.2',
      dataSchemaVersion: 2,
      lastUpdateDate: '2026-02-17T00:00:00.000Z',
      installDate: '2025-06-01T00:00:00.000Z',
      updateCount: 0,
    };
    saveAppMetadata(metadata);
    expect(mockedLogger.error).toHaveBeenCalled();
  });

  it('does not log error when save succeeds', () => {
    mockedSet.mockReturnValue(true);
    const metadata: AppMetadata = {
      appVersion: '1.7.2',
      dataSchemaVersion: 2,
      lastUpdateDate: '2026-02-17T00:00:00.000Z',
      installDate: '2025-06-01T00:00:00.000Z',
      updateCount: 0,
    };
    saveAppMetadata(metadata);
    expect(mockedLogger.error).not.toHaveBeenCalled();
  });
});

// ─── wasAppUpdated ──────────────────────────────────────────────

describe('wasAppUpdated', () => {
  it('returns false when no metadata exists', () => {
    mockedGet.mockReturnValue(null);
    expect(wasAppUpdated()).toBe(false);
  });

  it('returns false when version matches APP_VERSION', () => {
    mockedGet.mockReturnValue({
      appVersion: APP_VERSION,
      dataSchemaVersion: 2,
      lastUpdateDate: '2026-01-01T00:00:00.000Z',
      installDate: '2025-06-01T00:00:00.000Z',
      updateCount: 0,
    });
    expect(wasAppUpdated()).toBe(false);
  });

  it('returns true when stored version differs from APP_VERSION', () => {
    mockedGet.mockReturnValue({
      appVersion: '1.0.0',
      dataSchemaVersion: 1,
      lastUpdateDate: '2025-01-01T00:00:00.000Z',
      installDate: '2025-01-01T00:00:00.000Z',
      updateCount: 0,
    });
    expect(wasAppUpdated()).toBe(true);
  });
});

// ─── initializeAppMetadata ──────────────────────────────────────

describe('initializeAppMetadata', () => {
  it('creates new metadata on first install', () => {
    mockedGet.mockReturnValue(null);
    const result = initializeAppMetadata();

    expect(result.appVersion).toBe(APP_VERSION);
    expect(result.dataSchemaVersion).toBe(DATA_SCHEMA_VERSION);
    expect(result.updateCount).toBe(0);
    expect(result.installDate).toBeTruthy();
    expect(result.lastUpdateDate).toBeTruthy();
  });

  it('saves new metadata on first install', () => {
    mockedGet.mockReturnValue(null);
    initializeAppMetadata();
    expect(mockedSet).toHaveBeenCalledWith(SK.APP_METADATA, expect.objectContaining({
      appVersion: APP_VERSION,
      updateCount: 0,
    }));
  });

  it('increments updateCount on version change', () => {
    mockedGet.mockReturnValue({
      appVersion: '1.6.0',
      dataSchemaVersion: 1,
      lastUpdateDate: '2025-12-01T00:00:00.000Z',
      installDate: '2025-06-01T00:00:00.000Z',
      updateCount: 2,
    });
    const result = initializeAppMetadata();

    expect(result.updateCount).toBe(3);
    expect(result.appVersion).toBe(APP_VERSION);
    expect(result.dataSchemaVersion).toBe(DATA_SCHEMA_VERSION);
  });

  it('preserves installDate on version change', () => {
    const originalInstallDate = '2025-06-01T00:00:00.000Z';
    mockedGet.mockReturnValue({
      appVersion: '1.5.0',
      dataSchemaVersion: 1,
      lastUpdateDate: '2025-12-01T00:00:00.000Z',
      installDate: originalInstallDate,
      updateCount: 1,
    });
    const result = initializeAppMetadata();

    expect(result.installDate).toBe(originalInstallDate);
  });

  it('updates lastUpdateDate on version change', () => {
    const oldDate = '2025-12-01T00:00:00.000Z';
    mockedGet.mockReturnValue({
      appVersion: '1.5.0',
      dataSchemaVersion: 1,
      lastUpdateDate: oldDate,
      installDate: '2025-06-01T00:00:00.000Z',
      updateCount: 1,
    });
    const result = initializeAppMetadata();

    expect(result.lastUpdateDate).not.toBe(oldDate);
  });

  it('returns existing metadata unchanged when version matches', () => {
    const existing: AppMetadata = {
      appVersion: APP_VERSION,
      dataSchemaVersion: DATA_SCHEMA_VERSION,
      lastUpdateDate: '2026-02-01T00:00:00.000Z',
      installDate: '2025-06-01T00:00:00.000Z',
      updateCount: 5,
    };
    mockedGet.mockReturnValue(existing);
    const result = initializeAppMetadata();

    expect(result).toEqual(existing);
  });

  it('does not call saveAppMetadata when version matches', () => {
    mockedGet.mockReturnValue({
      appVersion: APP_VERSION,
      dataSchemaVersion: DATA_SCHEMA_VERSION,
      lastUpdateDate: '2026-02-01T00:00:00.000Z',
      installDate: '2025-06-01T00:00:00.000Z',
      updateCount: 5,
    });
    initializeAppMetadata();

    // saveAppMetadata should NOT be called since version matches
    expect(mockedSet).not.toHaveBeenCalled();
  });
});
