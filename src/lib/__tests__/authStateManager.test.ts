import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { authStateManager } from '../authStateManager';

beforeEach(() => {
  vi.useFakeTimers();
  authStateManager.reset();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── tryComplete ───────────────────────────────────────────────

describe('tryComplete', () => {
  it('first call succeeds and returns true', async () => {
    const callback = vi.fn();
    const result = await authStateManager.tryComplete(callback, 'test-source');

    expect(result).toBe(true);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('executes the provided callback', async () => {
    let executed = false;
    await authStateManager.tryComplete(() => {
      executed = true;
    }, 'callback-test');

    expect(executed).toBe(true);
  });

  it('second call after completion returns false and does not run callback', async () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    await authStateManager.tryComplete(firstCallback, 'first');
    const secondResult = await authStateManager.tryComplete(secondCallback, 'second');

    expect(secondResult).toBe(false);
    expect(firstCallback).toHaveBeenCalledOnce();
    expect(secondCallback).not.toHaveBeenCalled();
  });

  it('concurrent calls: second caller waits for first, then returns false', async () => {
    let resolveCallback!: () => void;
    const deferredCallback = new Promise<void>((resolve) => {
      resolveCallback = resolve;
    });

    const firstResult = authStateManager.tryComplete(async () => {
      await deferredCallback;
    }, 'source1');

    const secondCallback = vi.fn();
    const secondResult = authStateManager.tryComplete(secondCallback, 'source2');

    // Resolve the first callback
    resolveCallback();

    expect(await firstResult).toBe(true);
    expect(await secondResult).toBe(false);
    expect(secondCallback).not.toHaveBeenCalled();
  });

  it('callback error resets state and allows retry', async () => {
    const error = new Error('callback failed');
    const failingCallback = vi.fn().mockRejectedValue(error);

    await expect(
      authStateManager.tryComplete(failingCallback, 'failing-source')
    ).rejects.toThrow('callback failed');

    // State should be reset, allowing a retry
    expect(authStateManager.isAuthCompleted()).toBe(false);

    const retryCallback = vi.fn();
    const retryResult = await authStateManager.tryComplete(retryCallback, 'retry-source');

    expect(retryResult).toBe(true);
    expect(retryCallback).toHaveBeenCalledOnce();
  });

  it('handles async callback correctly', async () => {
    let callbackCompleted = false;
    const asyncCallback = async () => {
      await new Promise<void>((r) => setTimeout(r, 100));
      callbackCompleted = true;
    };

    const resultPromise = authStateManager.tryComplete(asyncCallback, 'async-source');
    expect(callbackCompleted).toBe(false);

    vi.advanceTimersByTime(100);
    const result = await resultPromise;

    expect(result).toBe(true);
    expect(callbackCompleted).toBe(true);
  });
});

// ─── isAuthCompleted ───────────────────────────────────────────

describe('isAuthCompleted', () => {
  it('returns false initially', () => {
    expect(authStateManager.isAuthCompleted()).toBe(false);
  });

  it('returns true after successful tryComplete', async () => {
    await authStateManager.tryComplete(() => {}, 'source');
    expect(authStateManager.isAuthCompleted()).toBe(true);
  });

  it('returns true after markCompleted', () => {
    authStateManager.markCompleted('mark-source');
    expect(authStateManager.isAuthCompleted()).toBe(true);
  });
});

// ─── getCompletionInfo ─────────────────────────────────────────

describe('getCompletionInfo', () => {
  it('returns nulls initially', () => {
    const info = authStateManager.getCompletionInfo();
    expect(info.source).toBeNull();
    expect(info.timestamp).toBeNull();
  });

  it('returns source and timestamp after tryComplete', async () => {
    vi.setSystemTime(new Date('2026-02-17T12:00:00Z'));
    await authStateManager.tryComplete(() => {}, 'my-source');

    const info = authStateManager.getCompletionInfo();
    expect(info.source).toBe('my-source');
    expect(info.timestamp).toBe(Date.now());
  });

  it('returns source and timestamp after markCompleted', () => {
    vi.setSystemTime(new Date('2026-02-17T15:30:00Z'));
    authStateManager.markCompleted('marked-source');

    const info = authStateManager.getCompletionInfo();
    expect(info.source).toBe('marked-source');
    expect(info.timestamp).toBe(Date.now());
  });
});

// ─── reset ─────────────────────────────────────────────────────

describe('reset', () => {
  it('clears completion state', async () => {
    await authStateManager.tryComplete(() => {}, 'source');
    expect(authStateManager.isAuthCompleted()).toBe(true);

    authStateManager.reset();

    expect(authStateManager.isAuthCompleted()).toBe(false);
    expect(authStateManager.getCompletionInfo().source).toBeNull();
    expect(authStateManager.getCompletionInfo().timestamp).toBeNull();
  });

  it('allows new tryComplete after reset', async () => {
    await authStateManager.tryComplete(() => {}, 'first');
    authStateManager.reset();

    const callback = vi.fn();
    const result = await authStateManager.tryComplete(callback, 'second');

    expect(result).toBe(true);
    expect(callback).toHaveBeenCalledOnce();
  });
});

// ─── markCompleted ─────────────────────────────────────────────

describe('markCompleted', () => {
  it('marks auth as completed without a callback', () => {
    authStateManager.markCompleted('external-source');

    expect(authStateManager.isAuthCompleted()).toBe(true);
    expect(authStateManager.getCompletionInfo().source).toBe('external-source');
  });

  it('is ignored if auth is already completed', async () => {
    await authStateManager.tryComplete(() => {}, 'first-source');
    authStateManager.markCompleted('second-source');

    // Source should still be from the first completion
    expect(authStateManager.getCompletionInfo().source).toBe('first-source');
  });

  it('prevents subsequent tryComplete from succeeding', async () => {
    authStateManager.markCompleted('mark-source');

    const callback = vi.fn();
    const result = await authStateManager.tryComplete(callback, 'late-source');

    expect(result).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });
});
