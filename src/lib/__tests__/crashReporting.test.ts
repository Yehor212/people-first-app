import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── In-memory localStorage mock ────────────────────────────────
let mockLocalStorage: Record<string, unknown> = {};

vi.mock('@/lib/platform', () => ({ isNative: false }));

vi.mock('../logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../safeJson', () => ({
  safeLocalStorageGet: vi.fn(<T>(key: string, defaultValue: T): T => {
    return key in mockLocalStorage ? (mockLocalStorage[key] as T) : defaultValue;
  }),
  safeLocalStorageSet: vi.fn((key: string, value: unknown): boolean => {
    mockLocalStorage[key] = value;
    return true;
  }),
}));

import { crashReporting, recordError, withCrashReporting } from '@/lib/crashReporting';
import { logger } from '../logger';
import { safeLocalStorageSet } from '../safeJson';
import { SK } from '@/lib/storageKeys';

beforeEach(() => {
  mockLocalStorage = {};
  vi.clearAllMocks();
});

// ─── crashReporting.log ─────────────────────────────────────────

describe('crashReporting.log', () => {
  it('calls logger.log with the message', () => {
    crashReporting.log('test message');
    expect(logger.log).toHaveBeenCalledWith('[Crash] Log:', 'test message');
  });
});

// ─── crashReporting.recordError ─────────────────────────────────

describe('crashReporting.recordError', () => {
  it('calls logger.error with the error message', () => {
    const error = new Error('something failed');
    crashReporting.recordError(error);
    expect(logger.error).toHaveBeenCalledWith('[Crash] Error recorded:', 'something failed');
  });

  it('logs context when provided', () => {
    const error = new Error('context error');
    const context = { component: 'SettingsPage' };
    crashReporting.recordError(error, context);
    expect(logger.error).toHaveBeenCalledWith('[Crash] Context:', context);
  });

  it('stores error entry in localStorage', () => {
    const error = new Error('stored error');
    crashReporting.recordError(error);
    expect(safeLocalStorageSet).toHaveBeenCalledWith(
      SK.CRASH_LOG,
      expect.arrayContaining([
        expect.objectContaining({ message: 'stored error' }),
      ]),
    );
  });

  it('appends to existing entries in localStorage', () => {
    mockLocalStorage[SK.CRASH_LOG] = [
      { message: 'old error', time: '2026-02-16T00:00:00.000Z' },
    ];
    crashReporting.recordError(new Error('new error'));

    const stored = mockLocalStorage[SK.CRASH_LOG] as Array<{ message: string }>;
    expect(stored).toHaveLength(2);
    expect(stored[0].message).toBe('old error');
    expect(stored[1].message).toBe('new error');
  });

  it('caps entries at 20 (keeps last 20)', () => {
    const existing = Array.from({ length: 20 }, (_, i) => ({
      message: `error-${i}`,
      time: '2026-02-16T00:00:00.000Z',
    }));
    mockLocalStorage[SK.CRASH_LOG] = existing;

    crashReporting.recordError(new Error('error-20'));

    const stored = mockLocalStorage[SK.CRASH_LOG] as Array<{ message: string }>;
    expect(stored).toHaveLength(20);
    // First entry should be error-1 (error-0 was dropped), last should be error-20
    expect(stored[0].message).toBe('error-1');
    expect(stored[19].message).toBe('error-20');
  });

  it('does not log context when not provided', () => {
    crashReporting.recordError(new Error('no context'));
    // logger.error should be called once (error message only), not with context
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('[Crash] Error recorded:', 'no context');
  });
});

// ─── crashReporting.setUserId ───────────────────────────────────

describe('crashReporting.setUserId', () => {
  it('logs the user ID', () => {
    crashReporting.setUserId('user-123');
    expect(logger.log).toHaveBeenCalledWith('[Crash] User ID set:', 'user-123');
  });

  it('logs null when user ID is null', () => {
    crashReporting.setUserId(null);
    expect(logger.log).toHaveBeenCalledWith('[Crash] User ID set:', 'null');
  });
});

// ─── crashReporting.setEnabled ──────────────────────────────────

describe('crashReporting.setEnabled', () => {
  it('logs the enabled state', () => {
    crashReporting.setEnabled(true);
    expect(logger.log).toHaveBeenCalledWith('[Crash] Reporting enabled:', true);
  });
});

// ─── crashReporting.setCustomKey ────────────────────────────────

describe('crashReporting.setCustomKey', () => {
  it('logs the custom key and value', () => {
    crashReporting.setCustomKey('app_version', '1.5.0');
    expect(logger.log).toHaveBeenCalledWith('[Crash] Custom key:', 'app_version', '=', '1.5.0');
  });
});

// ─── recordError (standalone helper) ────────────────────────────

describe('recordError (standalone helper)', () => {
  it('passes Error objects directly to crashReporting.recordError', () => {
    const error = new Error('direct error');
    recordError(error, { source: 'test' });
    expect(logger.error).toHaveBeenCalledWith('[Crash] Error recorded:', 'direct error');
  });

  it('wraps string errors in Error objects', () => {
    recordError('string failure');
    expect(logger.error).toHaveBeenCalledWith('[Crash] Error recorded:', 'string failure');
  });

  it('wraps non-string non-Error values via JSON.stringify', () => {
    recordError({ code: 404 });
    expect(logger.error).toHaveBeenCalledWith('[Crash] Error recorded:', '{"code":404}');
  });
});

// ─── withCrashReporting ─────────────────────────────────────────

describe('withCrashReporting', () => {
  it('passes through successful return value', async () => {
    const fn = async () => 42;
    const wrapped = withCrashReporting(fn);
    await expect(wrapped()).resolves.toBe(42);
  });

  it('records error and rethrows on failure', async () => {
    const fn = async () => {
      throw new Error('async boom');
    };
    const wrapped = withCrashReporting(fn, { action: 'test' });

    await expect(wrapped()).rejects.toThrow('async boom');
    expect(logger.error).toHaveBeenCalledWith('[Crash] Error recorded:', 'async boom');
  });

  it('passes arguments through to the wrapped function', async () => {
    const fn = async (a: unknown, b: unknown) => (a as string) + '-' + (b as string);
    const wrapped = withCrashReporting(fn);
    await expect(wrapped('x', 'y')).resolves.toBe('x-y');
  });
});
