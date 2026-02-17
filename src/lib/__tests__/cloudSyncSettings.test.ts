import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/safeJson', () => ({
  storageGetRaw: vi.fn(),
  storageSetRaw: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  isCloudSyncEnabled,
  setCloudSyncEnabled,
  migrateExistingUser,
  getCloudSyncKey,
} from '@/lib/cloudSyncSettings';
import { storageGetRaw, storageSetRaw } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';

const mockedGetRaw = vi.mocked(storageGetRaw);
const mockedSetRaw = vi.mocked(storageSetRaw);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── isCloudSyncEnabled ─────────────────────────────────────────

describe('isCloudSyncEnabled', () => {
  it('returns false when no value is stored (empty string)', () => {
    mockedGetRaw.mockReturnValue('');
    expect(isCloudSyncEnabled()).toBe(false);
  });

  it('returns true when stored value is "true"', () => {
    mockedGetRaw.mockReturnValue('true');
    expect(isCloudSyncEnabled()).toBe(true);
  });

  it('returns false when stored value is "false"', () => {
    mockedGetRaw.mockReturnValue('false');
    expect(isCloudSyncEnabled()).toBe(false);
  });

  it('returns false for any unexpected value', () => {
    mockedGetRaw.mockReturnValue('yes');
    expect(isCloudSyncEnabled()).toBe(false);
  });
});

// ─── setCloudSyncEnabled ────────────────────────────────────────

describe('setCloudSyncEnabled', () => {
  it('stores "true" when enabled is true', () => {
    setCloudSyncEnabled(true);
    expect(mockedSetRaw).toHaveBeenCalledWith(SK.CLOUD_SYNC_ENABLED, 'true');
  });

  it('stores "false" when enabled is false', () => {
    setCloudSyncEnabled(false);
    expect(mockedSetRaw).toHaveBeenCalledWith(SK.CLOUD_SYNC_ENABLED, 'false');
  });
});

// ─── migrateExistingUser ────────────────────────────────────────

describe('migrateExistingUser', () => {
  it('sets cloud sync to true when no existing setting (empty string → null via ||)', () => {
    mockedGetRaw.mockReturnValue('');
    migrateExistingUser();
    expect(mockedSetRaw).toHaveBeenCalledWith(SK.CLOUD_SYNC_ENABLED, 'true');
  });

  it('does not change when existing value is "true"', () => {
    mockedGetRaw.mockReturnValue('true');
    migrateExistingUser();
    expect(mockedSetRaw).not.toHaveBeenCalled();
  });

  it('does not change when existing value is "false"', () => {
    mockedGetRaw.mockReturnValue('false');
    migrateExistingUser();
    expect(mockedSetRaw).not.toHaveBeenCalled();
  });
});

// ─── getCloudSyncKey ────────────────────────────────────────────

describe('getCloudSyncKey', () => {
  it('returns the correct storage key from SK', () => {
    expect(getCloudSyncKey()).toBe(SK.CLOUD_SYNC_ENABLED);
  });

  it('returns "zenflow_cloud_sync_enabled"', () => {
    expect(getCloudSyncKey()).toBe('zenflow_cloud_sync_enabled');
  });
});
