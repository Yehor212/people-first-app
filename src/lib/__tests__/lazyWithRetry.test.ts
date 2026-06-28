import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────
const mockForceHardReload = vi.fn().mockResolvedValue(undefined);
const mockMarkForVersionCheck = vi.fn();

vi.mock('@/lib/versionCheck', () => ({
  forceHardReload: (...args: unknown[]) => mockForceHardReload(...args),
  markForVersionCheck: (...args: unknown[]) => mockMarkForVersionCheck(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/storageKeys', () => ({
  SSK: {
    chunkReload: (name: string) => `chunk_reload_${name}`,
  },
}));

// ─── sessionStorage mock ────────────────────────────────────────
const sessionMap: Record<string, string | null> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => sessionMap[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    sessionMap[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete sessionMap[key];
  }),
};
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true });

// ─── caches mock ────────────────────────────────────────────────
const mockCachesDelete = vi.fn().mockResolvedValue(true);
const mockCachesKeys = vi.fn().mockResolvedValue(['cache-v1']);
Object.defineProperty(globalThis, 'caches', {
  value: {
    keys: mockCachesKeys,
    delete: mockCachesDelete,
  },
  writable: true,
  configurable: true,
});

import { lazyWithRetry } from '@/lib/lazyWithRetry';

// ─── Helpers ────────────────────────────────────────────────────

const DummyComponent = () => null;

/**
 * Extract and invoke the lazy factory function from a React.lazy component.
 */
function invokeLazyFactory(lazyComp: ReturnType<typeof lazyWithRetry>): Promise<{ default: unknown }> {
  const payload = (lazyComp as any)._payload;
  const factory = payload._result || payload[1];
  return factory();
}

/** Flush all pending microtasks */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => resolve());
}

// Capture and suppress unhandled rejections originating from the retry mechanism.
// React.lazy + fake timers can cause rejection events to surface AFTER the
// test's `await expect(...).rejects` has already handled the error.
const _origListeners: ((e: PromiseRejectionEvent) => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  Object.keys(sessionMap).forEach((k) => delete sessionMap[k]);
});

afterEach(async () => {
  // Drain any queued microtasks/timers to avoid leaking rejections to next test
  await vi.advanceTimersByTimeAsync(0);
  await flushMicrotasks();
  vi.useRealTimers();
});

// ─── Tests ──────────────────────────────────────────────────────

describe('lazyWithRetry', () => {
  it('returns a React.lazy component on success', () => {
    const importFn = vi.fn().mockResolvedValue({ default: DummyComponent });
    const LazyComp = lazyWithRetry(importFn, 'TestModule');
    expect(LazyComp).toBeDefined();
    expect(LazyComp.$$typeof).toBeDefined();
  });

  it('retries on ChunkLoadError and succeeds on third attempt', async () => {
    let callCount = 0;
    const importFn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        throw new TypeError('Failed to fetch dynamically imported module /chunk-abc.js');
      }
      return { default: DummyComponent };
    });

    const LazyComp = lazyWithRetry(importFn, 'RetryModule');

    const resultPromise = invokeLazyFactory(LazyComp);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;
    expect(result).toEqual({ default: DummyComponent });
    expect(importFn).toHaveBeenCalledTimes(3);
  });

  it('throws non-chunk errors immediately without retry', async () => {
    const importFn = vi.fn().mockImplementation(async () => {
      throw new Error('Some other error');
    });

    const LazyComp = lazyWithRetry(importFn, 'NonChunkModule');

    await expect(invokeLazyFactory(LazyComp)).rejects.toThrow('Some other error');
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('calls markForVersionCheck and forceHardReload after MAX_RETRIES exhausted', async () => {
    const importFn = vi.fn().mockImplementation(async () => {
      throw new TypeError('Loading chunk xyz failed');
    });

    const LazyComp = lazyWithRetry(importFn, 'ExhaustedModule');

    const promise = invokeLazyFactory(LazyComp).catch(() => {/* expected */});
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(importFn).toHaveBeenCalledTimes(3);
    expect(mockMarkForVersionCheck).toHaveBeenCalled();
    expect(mockForceHardReload).toHaveBeenCalled();
  });

  it('hard-reloads for browser chunk-load messages even when the rejection is not a TypeError', async () => {
    const importFn = vi.fn().mockImplementation(async () => {
      throw new Error(
        'Failed to fetch dynamically imported module: https://app.example/assets/TabContent-old.js',
      );
    });

    const LazyComp = lazyWithRetry(importFn, 'BrowserErrorModule');

    const promise = invokeLazyFactory(LazyComp).catch(() => {/* expected */});
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(importFn).toHaveBeenCalledTimes(3);
    expect(mockMarkForVersionCheck).toHaveBeenCalled();
    expect(mockForceHardReload).toHaveBeenCalled();
  });

  it('prevents infinite reload loop when recent reload detected', async () => {
    sessionMap['chunk_reload_LoopModule'] = Date.now().toString();

    const importFn = vi.fn().mockImplementation(async () => {
      throw new TypeError('Loading chunk xyz failed');
    });

    const LazyComp = lazyWithRetry(importFn, 'LoopModule');

    const promise = invokeLazyFactory(LazyComp).catch(() => {/* expected */});
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(mockForceHardReload).not.toHaveBeenCalled();
  });

  it('clears caches before reload', async () => {
    const importFn = vi.fn().mockImplementation(async () => {
      throw new TypeError('Loading CSS chunk xyz failed');
    });

    const LazyComp = lazyWithRetry(importFn, 'CacheModule');

    const promise = invokeLazyFactory(LazyComp).catch(() => {/* expected */});
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(mockCachesKeys).toHaveBeenCalled();
    expect(mockCachesDelete).toHaveBeenCalledWith('cache-v1');
  });

  it('throws error with original message if recent reload was detected', async () => {
    sessionMap['chunk_reload_ThrowModule'] = Date.now().toString();

    const importFn = vi.fn().mockImplementation(async () => {
      throw new TypeError('Loading chunk xyz failed');
    });

    const LazyComp = lazyWithRetry(importFn, 'ThrowModule');

    let caughtError: Error | null = null;
    const promise = invokeLazyFactory(LazyComp).catch((e) => { caughtError = e; });
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(caughtError).toBeInstanceOf(TypeError);
    expect((caughtError as unknown as Error).message).toContain('Loading chunk');
  });

  it('sets session key with timestamp before reloading', async () => {
    const importFn = vi.fn().mockImplementation(async () => {
      throw new TypeError('Loading chunk xyz failed');
    });

    const LazyComp = lazyWithRetry(importFn, 'TimestampModule');

    const promise = invokeLazyFactory(LazyComp).catch(() => {/* expected */});
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      'chunk_reload_TimestampModule',
      expect.any(String)
    );
  });
});
