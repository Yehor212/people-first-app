import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { rateLimiter, RateLimitError, createRateLimitedFetch } from '../rateLimiter';

describe('rateLimiter', () => {
  beforeEach(() => {
    rateLimiter.resetAll();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Default Configs ───────────────────────────────────────────

  describe('default configs', () => {
    it('has spotify config (allows requests)', () => {
      expect(rateLimiter.isAllowed('spotify')).toBe(true);
    });

    it('has googleCalendar config (allows requests)', () => {
      expect(rateLimiter.isAllowed('googleCalendar')).toBe(true);
    });

    it('has supabase config (allows requests)', () => {
      expect(rateLimiter.isAllowed('supabase')).toBe(true);
    });
  });

  // ─── configure ─────────────────────────────────────────────────
  // NOTE: Never reconfigure default services (spotify, supabase, googleCalendar)
  // in tests because resetAll() only clears state, not configs.

  describe('configure', () => {
    it('adds a new service configuration', () => {
      rateLimiter.configure('customSvc', { maxRequests: 5, windowMs: 10000 });
      expect(rateLimiter.getRemainingRequests('customSvc')).toBe(5);
      expect(rateLimiter.isAllowed('customSvc')).toBe(true);
    });

    it('updates an existing service configuration', () => {
      rateLimiter.configure('updateTest', { maxRequests: 10, windowMs: 30000 });
      expect(rateLimiter.getRemainingRequests('updateTest')).toBe(10);
      rateLimiter.configure('updateTest', { maxRequests: 50, windowMs: 30000 });
      expect(rateLimiter.getRemainingRequests('updateTest')).toBe(50);
    });

    it('preserves existing state when updating config', () => {
      rateLimiter.configure('preserveTest', { maxRequests: 10, windowMs: 60000 });
      rateLimiter.checkAndRecord('preserveTest');
      rateLimiter.checkAndRecord('preserveTest');

      // Update config with higher limit — state (2 recorded requests) is preserved
      rateLimiter.configure('preserveTest', { maxRequests: 50, windowMs: 60000 });
      // Should be 50 - 2 = 48 because the requests are still recorded
      expect(rateLimiter.getRemainingRequests('preserveTest')).toBe(48);
    });
  });

  // ─── checkAndRecord ────────────────────────────────────────────

  describe('checkAndRecord', () => {
    it('allows requests when under limit', () => {
      expect(rateLimiter.checkAndRecord('supabase')).toBe(true);
    });

    it('records the request (decreases remaining count)', () => {
      const before = rateLimiter.getRemainingRequests('supabase');
      rateLimiter.checkAndRecord('supabase');
      expect(rateLimiter.getRemainingRequests('supabase')).toBe(before - 1);
    });

    it('returns true for unknown service', () => {
      expect(rateLimiter.checkAndRecord('unknownService')).toBe(true);
    });

    it('returns false when limit is reached', () => {
      rateLimiter.configure('tiny', { maxRequests: 2, windowMs: 60000, blockDurationMs: 5000 });
      expect(rateLimiter.checkAndRecord('tiny')).toBe(true);
      expect(rateLimiter.checkAndRecord('tiny')).toBe(true);
      // Third request hits the limit
      expect(rateLimiter.checkAndRecord('tiny')).toBe(false);
    });

    it('blocks after hitting the limit', () => {
      rateLimiter.configure('tiny', { maxRequests: 1, windowMs: 60000, blockDurationMs: 5000 });
      rateLimiter.checkAndRecord('tiny'); // allowed
      rateLimiter.checkAndRecord('tiny'); // hits limit, now blocked
      // Subsequent requests are blocked
      expect(rateLimiter.checkAndRecord('tiny')).toBe(false);
      expect(rateLimiter.isAllowed('tiny')).toBe(false);
    });

    it('cleans expired requests when window passes', () => {
      rateLimiter.configure('tiny', { maxRequests: 2, windowMs: 10000, blockDurationMs: 5000 });
      rateLimiter.checkAndRecord('tiny');
      rateLimiter.checkAndRecord('tiny');
      // At limit now

      // Advance past block duration + window so old requests expire
      vi.advanceTimersByTime(15001);

      // Requests are cleaned, so we should be allowed again
      expect(rateLimiter.checkAndRecord('tiny')).toBe(true);
    });

    it('allows after block expires', () => {
      rateLimiter.configure('tiny', { maxRequests: 1, windowMs: 60000, blockDurationMs: 5000 });
      rateLimiter.checkAndRecord('tiny'); // first request
      rateLimiter.checkAndRecord('tiny'); // hits limit, blocked for 5s

      // Advance past block duration + window so everything expires
      vi.advanceTimersByTime(65001);

      expect(rateLimiter.checkAndRecord('tiny')).toBe(true);
    });

    it('uses windowMs as blockDuration when blockDurationMs is not set', () => {
      rateLimiter.configure('noBlock', { maxRequests: 1, windowMs: 10000 });
      rateLimiter.checkAndRecord('noBlock');
      rateLimiter.checkAndRecord('noBlock'); // hits limit, blocks for windowMs=10s

      // Still blocked at 9s
      vi.advanceTimersByTime(9000);
      expect(rateLimiter.checkAndRecord('noBlock')).toBe(false);

      // Unblocked after 10s + requests cleaned
      vi.advanceTimersByTime(2000);
      expect(rateLimiter.checkAndRecord('noBlock')).toBe(true);
    });
  });

  // ─── isAllowed ─────────────────────────────────────────────────

  describe('isAllowed', () => {
    it('returns true when under limit', () => {
      expect(rateLimiter.isAllowed('supabase')).toBe(true);
    });

    it('returns true for unknown service', () => {
      expect(rateLimiter.isAllowed('unknownService')).toBe(true);
    });

    it('returns false when blocked', () => {
      rateLimiter.configure('tiny', { maxRequests: 1, windowMs: 60000, blockDurationMs: 5000 });
      rateLimiter.checkAndRecord('tiny');
      rateLimiter.checkAndRecord('tiny'); // blocks
      expect(rateLimiter.isAllowed('tiny')).toBe(false);
    });

    it('does NOT record a request (remaining stays the same)', () => {
      const before = rateLimiter.getRemainingRequests('supabase');
      rateLimiter.isAllowed('supabase');
      rateLimiter.isAllowed('supabase');
      rateLimiter.isAllowed('supabase');
      expect(rateLimiter.getRemainingRequests('supabase')).toBe(before);
    });

    it('returns false when at capacity', () => {
      rateLimiter.configure('tiny', { maxRequests: 2, windowMs: 60000, blockDurationMs: 5000 });
      rateLimiter.checkAndRecord('tiny');
      rateLimiter.checkAndRecord('tiny');
      expect(rateLimiter.isAllowed('tiny')).toBe(false);
    });
  });

  // ─── getRemainingRequests ──────────────────────────────────────

  describe('getRemainingRequests', () => {
    it('returns Infinity for unknown service', () => {
      expect(rateLimiter.getRemainingRequests('unknownService')).toBe(Infinity);
    });

    it('returns maxRequests for fresh service', () => {
      // supabase has maxRequests: 100
      expect(rateLimiter.getRemainingRequests('supabase')).toBe(100);
    });

    it('decreases with each recorded request', () => {
      rateLimiter.checkAndRecord('googleCalendar');
      expect(rateLimiter.getRemainingRequests('googleCalendar')).toBe(99);
      rateLimiter.checkAndRecord('googleCalendar');
      expect(rateLimiter.getRemainingRequests('googleCalendar')).toBe(98);
    });

    it('returns 0 when blocked', () => {
      rateLimiter.configure('tiny', { maxRequests: 1, windowMs: 60000, blockDurationMs: 5000 });
      rateLimiter.checkAndRecord('tiny');
      rateLimiter.checkAndRecord('tiny'); // blocks
      expect(rateLimiter.getRemainingRequests('tiny')).toBe(0);
    });

    it('recovers after window passes', () => {
      rateLimiter.configure('tiny', { maxRequests: 2, windowMs: 10000 });
      rateLimiter.checkAndRecord('tiny');
      expect(rateLimiter.getRemainingRequests('tiny')).toBe(1);

      // Advance past window
      vi.advanceTimersByTime(11000);
      expect(rateLimiter.getRemainingRequests('tiny')).toBe(2);
    });
  });

  // ─── getTimeUntilReset ─────────────────────────────────────────

  describe('getTimeUntilReset', () => {
    it('returns 0 for unknown service', () => {
      expect(rateLimiter.getTimeUntilReset('unknownService')).toBe(0);
    });

    it('returns 0 when no requests have been made', () => {
      expect(rateLimiter.getTimeUntilReset('supabase')).toBe(0);
    });

    it('returns remaining block time when blocked', () => {
      rateLimiter.configure('tiny', { maxRequests: 1, windowMs: 60000, blockDurationMs: 10000 });
      rateLimiter.checkAndRecord('tiny');
      rateLimiter.checkAndRecord('tiny'); // blocks for 10s

      const timeUntilReset = rateLimiter.getTimeUntilReset('tiny');
      expect(timeUntilReset).toBe(10000);
    });

    it('returns time until oldest request expires when not blocked', () => {
      rateLimiter.configure('tiny', { maxRequests: 5, windowMs: 30000 });
      rateLimiter.checkAndRecord('tiny');

      vi.advanceTimersByTime(5000);
      const timeUntilReset = rateLimiter.getTimeUntilReset('tiny');
      // Oldest request was made 5s ago, window is 30s, so 25s remain
      expect(timeUntilReset).toBe(25000);
    });

    it('decreases as time advances while blocked', () => {
      rateLimiter.configure('tiny', { maxRequests: 1, windowMs: 60000, blockDurationMs: 10000 });
      rateLimiter.checkAndRecord('tiny');
      rateLimiter.checkAndRecord('tiny'); // blocks

      vi.advanceTimersByTime(3000);
      expect(rateLimiter.getTimeUntilReset('tiny')).toBe(7000);
    });
  });

  // ─── reset ─────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears requests for a specific service', () => {
      rateLimiter.configure('resetTest', { maxRequests: 10, windowMs: 60000 });
      rateLimiter.checkAndRecord('resetTest');
      rateLimiter.checkAndRecord('resetTest');
      expect(rateLimiter.getRemainingRequests('resetTest')).toBe(8);

      rateLimiter.reset('resetTest');
      expect(rateLimiter.getRemainingRequests('resetTest')).toBe(10);
    });

    it('clears block for a specific service', () => {
      rateLimiter.configure('tiny', { maxRequests: 1, windowMs: 60000, blockDurationMs: 5000 });
      rateLimiter.checkAndRecord('tiny');
      rateLimiter.checkAndRecord('tiny'); // blocked

      rateLimiter.reset('tiny');
      expect(rateLimiter.isAllowed('tiny')).toBe(true);
      expect(rateLimiter.checkAndRecord('tiny')).toBe(true);
    });

    it('does not affect other services', () => {
      rateLimiter.configure('svcA', { maxRequests: 10, windowMs: 60000 });
      rateLimiter.configure('svcB', { maxRequests: 10, windowMs: 60000 });
      rateLimiter.checkAndRecord('svcA');
      rateLimiter.checkAndRecord('svcB');

      rateLimiter.reset('svcA');
      expect(rateLimiter.getRemainingRequests('svcA')).toBe(10);
      expect(rateLimiter.getRemainingRequests('svcB')).toBe(9);
    });

    it('is a no-op for unknown service (does not throw)', () => {
      expect(() => rateLimiter.reset('nonExistent')).not.toThrow();
    });
  });

  // ─── resetAll ──────────────────────────────────────────────────

  describe('resetAll', () => {
    it('clears all services', () => {
      rateLimiter.checkAndRecord('supabase');
      rateLimiter.checkAndRecord('googleCalendar');

      rateLimiter.resetAll();

      expect(rateLimiter.getRemainingRequests('supabase')).toBe(100);
      expect(rateLimiter.getRemainingRequests('googleCalendar')).toBe(100);
    });

    it('clears blocks on all services', () => {
      rateLimiter.configure('tiny1', { maxRequests: 1, windowMs: 60000, blockDurationMs: 5000 });
      rateLimiter.configure('tiny2', { maxRequests: 1, windowMs: 60000, blockDurationMs: 5000 });
      rateLimiter.checkAndRecord('tiny1');
      rateLimiter.checkAndRecord('tiny1'); // blocked
      rateLimiter.checkAndRecord('tiny2');
      rateLimiter.checkAndRecord('tiny2'); // blocked

      rateLimiter.resetAll();

      expect(rateLimiter.isAllowed('tiny1')).toBe(true);
      expect(rateLimiter.isAllowed('tiny2')).toBe(true);
    });
  });
});

// ─── RateLimitError ──────────────────────────────────────────────

describe('RateLimitError', () => {
  it('has name "RateLimitError"', () => {
    const err = new RateLimitError('spotify', 5000);
    expect(err.name).toBe('RateLimitError');
  });

  it('is an instance of Error', () => {
    const err = new RateLimitError('spotify', 5000);
    expect(err).toBeInstanceOf(Error);
  });

  it('has service field', () => {
    const err = new RateLimitError('spotify', 5000);
    expect(err.service).toBe('spotify');
  });

  it('has retryAfterMs field', () => {
    const err = new RateLimitError('spotify', 5000);
    expect(err.retryAfterMs).toBe(5000);
  });

  it('message includes the service name', () => {
    const err = new RateLimitError('googleCalendar', 10000);
    expect(err.message).toContain('googleCalendar');
  });

  it('message includes retry time in seconds', () => {
    const err = new RateLimitError('spotify', 5000);
    expect(err.message).toContain('5');
  });
});

// ─── createRateLimitedFetch ──────────────────────────────────────

describe('createRateLimitedFetch', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rateLimiter.resetAll();
    mockFetch = vi.fn(() => Promise.resolve(new Response('ok')));
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls underlying fetch when allowed', async () => {
    const limitedFetch = createRateLimitedFetch('supabase');
    await limitedFetch('https://example.supabase.co/rest/v1/test');
    expect(mockFetch).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/test', undefined);
  });

  it('passes init options to fetch', async () => {
    const limitedFetch = createRateLimitedFetch('supabase');
    const init = { method: 'POST', body: '{}' };
    await limitedFetch('https://example.supabase.co/rest/v1/test', init);
    expect(mockFetch).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/test', init);
  });

  it('returns the Response from fetch', async () => {
    const limitedFetch = createRateLimitedFetch('supabase');
    const res = await limitedFetch('https://example.supabase.co/rest/v1/test');
    expect(res).toBeInstanceOf(Response);
    expect(await res.text()).toBe('ok');
  });

  it('throws RateLimitError when rate limited', async () => {
    rateLimiter.configure('fetchTiny', { maxRequests: 1, windowMs: 60000, blockDurationMs: 5000 });
    const limitedFetch = createRateLimitedFetch('fetchTiny');

    await limitedFetch('https://example.com'); // allowed
    await expect(limitedFetch('https://example.com')).rejects.toThrow(RateLimitError);
  });

  it('does not call underlying fetch when rate limited', async () => {
    rateLimiter.configure('fetchTiny', { maxRequests: 1, windowMs: 60000, blockDurationMs: 5000 });
    const limitedFetch = createRateLimitedFetch('fetchTiny');

    await limitedFetch('https://example.com'); // allowed
    mockFetch.mockClear();

    try {
      await limitedFetch('https://example.com');
    } catch {
      // expected
    }

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('thrown RateLimitError has correct service', async () => {
    rateLimiter.configure('fetchTiny', { maxRequests: 1, windowMs: 60000, blockDurationMs: 5000 });
    const limitedFetch = createRateLimitedFetch('fetchTiny');

    await limitedFetch('https://example.com');

    try {
      await limitedFetch('https://example.com');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect((e as RateLimitError).service).toBe('fetchTiny');
    }
  });
});
