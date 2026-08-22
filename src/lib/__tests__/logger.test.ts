import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock IS_DEV=true BEFORE the logger module loads
vi.mock('@/lib/env', () => ({ IS_DEV: true }));

import { logger } from '@/lib/logger';

// ─── Console spies ──────────────────────────────────────────────
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // Spies stay active for all tests; just clear call history
});

// ─── logger.log ─────────────────────────────────────────────────

describe('logger.log', () => {
  it('calls console.log with the provided message', () => {
    logger.log('hello');
    expect(consoleSpy.log).toHaveBeenCalledWith('[Log]', '[REDACTED]');
  });

  it('passes multiple arguments through', () => {
    logger.log('count:', 42, true);
    expect(consoleSpy.log).toHaveBeenCalledWith('[Log]', '[REDACTED]', 42, true);
  });

  it('exposes logger.info as an alias of logger.log for production-safe call sites', () => {
    const info = (logger as { info?: (...args: unknown[]) => void }).info;

    expect(info).toBeTypeOf('function');
    info?.('migration complete', 2);

    expect(consoleSpy.log).toHaveBeenCalledWith('[Info]', '[REDACTED]', 2);
  });
});

// ─── logger.warn ────────────────────────────────────────────────

describe('logger.warn', () => {
  it('calls console.warn in dev mode', () => {
    logger.warn('watch out');
    expect(consoleSpy.warn).toHaveBeenCalledWith('[Warn]', '[REDACTED]');
  });
});

// ─── logger.error ───────────────────────────────────────────────

describe('logger.error', () => {
  it('calls console.error with the provided message', () => {
    logger.error('something broke');
    expect(consoleSpy.error).toHaveBeenCalledWith('[Error]', '[REDACTED]');
  });

  it('drops free-form Error messages that can contain private content', () => {
    const err = new Error('PRIVATE_JOURNAL_CANARY');
    logger.error(err);
    expect(JSON.stringify(consoleSpy.error.mock.calls)).not.toContain('PRIVATE_JOURNAL_CANARY');
    expect(consoleSpy.error).toHaveBeenCalledWith('[Error]', { name: 'Error' });
  });
});

// ─── logger.sync ────────────────────────────────────────────────

describe('logger.sync', () => {
  it('logs with [Sync] prefix', () => {
    logger.sync('pull complete');
    expect(consoleSpy.log).toHaveBeenCalledWith('[Sync]', undefined);
  });

  it('passes sanitized data as second argument', () => {
    logger.sync('status', { count: 5 });
    expect(consoleSpy.log).toHaveBeenCalledWith('[Sync]', { count: 5 });
  });
});

// ─── logger.auth ────────────────────────────────────────────────

describe('logger.auth', () => {
  it('logs with [Auth] prefix', () => {
    logger.auth('login success');
    expect(consoleSpy.log).toHaveBeenCalledWith('[Auth]');
  });
});

// ─── sanitizeLogData (tested indirectly via logger.sync) ────────

describe('sanitizeLogData (via logger.sync)', () => {
  it('redacts user_id field', () => {
    logger.sync('test', { user_id: 'abc-123' });
    expect(consoleSpy.log).toHaveBeenCalledWith('[Sync]', { user_id: '[REDACTED]' });
  });

  it('redacts token field', () => {
    logger.sync('test', { token: 'secret-token-value' });
    expect(consoleSpy.log).toHaveBeenCalledWith('[Sync]', { token: '[REDACTED]' });
  });

  it('redacts email field', () => {
    logger.sync('test', { email: 'user@example.com' });
    expect(consoleSpy.log).toHaveBeenCalledWith('[Sync]', { email: '[REDACTED]' });
  });

  it('redacts access_token and refresh_token', () => {
    logger.sync('test', { access_token: 'at-123', refresh_token: 'rt-456' });
    expect(consoleSpy.log).toHaveBeenCalledWith('[Sync]', {
      access_token: '[REDACTED]',
      refresh_token: '[REDACTED]',
    });
  });

  it('redacts account-deletion recovery secrets', () => {
    logger.sync('test', {
      recoverySecret: 'A'.repeat(43),
    });
    expect(consoleSpy.log).toHaveBeenCalledWith('[Sync]', {
      recoverySecret: '[REDACTED]',
    });
  });

  it('redacts nested objects containing sensitive keys', () => {
    logger.sync('test', {
      user: { userId: 'u-1', name: 'Alice' },
    });
    expect(consoleSpy.log).toHaveBeenCalledWith('[Sync]', {
      user: { userId: '[REDACTED]', name: '[REDACTED]' },
    });
  });

  it('redacts private writing and wellbeing fields in ordinary logger calls', () => {
    logger.warn('failed', {
      journalEntry: 'PRIVATE_JOURNAL_CANARY',
      mood_note: 'PRIVATE_MOOD_NOTE_CANARY',
      habitName: 'PRIVATE_HABIT_CANARY',
      nested: { reflection_text: 'PRIVATE_REFLECTION_CANARY' },
      count: 2,
    });

    const serialized = JSON.stringify(consoleSpy.warn.mock.calls);
    expect(serialized).not.toContain('PRIVATE_JOURNAL_CANARY');
    expect(serialized).not.toContain('PRIVATE_MOOD_NOTE_CANARY');
    expect(serialized).not.toContain('PRIVATE_HABIT_CANARY');
    expect(serialized).not.toContain('PRIVATE_REFLECTION_CANARY');
    expect(serialized).toContain('[REDACTED]');
  });

  it('passes through non-sensitive keys unchanged', () => {
    logger.sync('test', { count: 10, status: 'ok', items: 3 });
    expect(consoleSpy.log).toHaveBeenCalledWith('[Sync]', {
      count: 10,
      status: '[REDACTED]',
      items: 3,
    });
  });
});
