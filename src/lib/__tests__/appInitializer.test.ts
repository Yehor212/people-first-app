import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────
const mockCheckDatabaseHealth = vi.fn();
const mockGetAppMetadata = vi.fn();
const mockInitializeAppMetadata = vi.fn();
const mockWasAppUpdated = vi.fn();
const mockRunMigrations = vi.fn();
const mockValidateDataIntegrity = vi.fn();

vi.mock('@/lib/appVersion', () => ({
  get DATA_SCHEMA_VERSION() {
    return 2;
  },
  initializeAppMetadata: (...args: unknown[]) => mockInitializeAppMetadata(...args),
  getAppMetadata: (...args: unknown[]) => mockGetAppMetadata(...args),
  wasAppUpdated: (...args: unknown[]) => mockWasAppUpdated(...args),
}));

vi.mock('@/storage/migrations', () => ({
  runMigrations: (...args: unknown[]) => mockRunMigrations(...args),
  validateDataIntegrity: (...args: unknown[]) => mockValidateDataIntegrity(...args),
}));

vi.mock('@/storage/db', () => ({
  checkDatabaseHealth: (...args: unknown[]) => mockCheckDatabaseHealth(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { initializeApp } from '@/lib/appInitializer';

// ─── Default metadata fixtures ──────────────────────────────────
const oldMetadata = {
  appVersion: '1.7.0',
  dataSchemaVersion: 1,
  lastUpdateDate: '2025-01-01',
  installDate: '2024-06-01',
  updateCount: 3,
};

const newMetadata = {
  appVersion: '1.7.2',
  dataSchemaVersion: 2,
  lastUpdateDate: '2025-06-01',
  installDate: '2024-06-01',
  updateCount: 4,
};

// ─── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockCheckDatabaseHealth.mockResolvedValue(true);
  mockGetAppMetadata.mockReturnValue(null);
  mockInitializeAppMetadata.mockReturnValue(newMetadata);
  mockWasAppUpdated.mockReturnValue(false);
  mockRunMigrations.mockResolvedValue(undefined);
  mockValidateDataIntegrity.mockResolvedValue(true);
});

// ─── Tests ──────────────────────────────────────────────────────

describe('initializeApp', () => {
  it('returns success when db healthy and no update', async () => {
    const result = await initializeApp();
    expect(result.success).toBe(true);
    expect(result.wasUpdated).toBe(false);
  });

  it('returns success when updated but no migration needed (same data schema)', async () => {
    mockWasAppUpdated.mockReturnValue(true);
    mockGetAppMetadata.mockReturnValue({ ...oldMetadata, dataSchemaVersion: 2 });

    const result = await initializeApp();
    expect(result.success).toBe(true);
    expect(result.wasUpdated).toBe(true);
  });

  it('runs migrations when data schema version increased', async () => {
    mockWasAppUpdated.mockReturnValue(true);
    mockGetAppMetadata.mockReturnValue(oldMetadata); // dataSchemaVersion: 1

    const result = await initializeApp();
    expect(mockRunMigrations).toHaveBeenCalledWith(1, 2);
    expect(mockValidateDataIntegrity).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('returns error when db is not healthy', async () => {
    mockCheckDatabaseHealth.mockResolvedValue(false);

    const result = await initializeApp();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Database');
  });

  it('returns error when migration fails', async () => {
    mockWasAppUpdated.mockReturnValue(true);
    mockGetAppMetadata.mockReturnValue(oldMetadata);
    mockRunMigrations.mockRejectedValue(new Error('Migration failed'));

    const result = await initializeApp();
    expect(result.success).toBe(false);
    expect(result.error).toContain('migration');
  });

  it('returns error when data integrity fails after migration', async () => {
    mockWasAppUpdated.mockReturnValue(true);
    mockGetAppMetadata.mockReturnValue(oldMetadata);
    mockValidateDataIntegrity.mockResolvedValue(false);

    const result = await initializeApp();
    expect(result.success).toBe(false);
    expect(result.error).toContain('validation');
  });

  it('returns success after successful migration + validation', async () => {
    mockWasAppUpdated.mockReturnValue(true);
    mockGetAppMetadata.mockReturnValue(oldMetadata);
    mockRunMigrations.mockResolvedValue(undefined);
    mockValidateDataIntegrity.mockResolvedValue(true);

    const result = await initializeApp();
    expect(result.success).toBe(true);
    expect(result.wasUpdated).toBe(true);
  });

  it('handles unexpected errors', async () => {
    mockCheckDatabaseHealth.mockRejectedValue(new Error('unexpected'));

    const result = await initializeApp();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unexpected');
  });
});
