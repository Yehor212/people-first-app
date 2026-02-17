import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  canStartAuthFlow,
  startAuthFlow,
  endAuthFlow,
  isAuthFlowInProgress,
  getRedirectCount,
  resetAuthGuard,
} from '@/lib/authGuard';

beforeEach(() => {
  vi.useFakeTimers();
  resetAuthGuard();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── canStartAuthFlow ───────────────────────────────────────────

describe('canStartAuthFlow', () => {
  it('returns true initially', () => {
    expect(canStartAuthFlow()).toBe(true);
  });

  it('returns false while auth flow is in progress', () => {
    startAuthFlow();
    expect(canStartAuthFlow()).toBe(false);
  });

  it('returns true after endAuthFlow is called', () => {
    startAuthFlow();
    endAuthFlow();
    expect(canStartAuthFlow()).toBe(true);
  });

  it('returns false after 3 redirects (redirect limit)', () => {
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();
    // 3 redirects used; next check should fail
    expect(canStartAuthFlow()).toBe(false);
  });

  it('returns true after redirect counter resets (61 seconds)', () => {
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();
    // At limit
    expect(canStartAuthFlow()).toBe(false);

    // Advance past the 60s reset interval
    vi.advanceTimersByTime(61000);
    expect(canStartAuthFlow()).toBe(true);
  });

  it('returns true when in-progress flow has timed out (escape hatch)', () => {
    startAuthFlow();
    // Flow is in progress but stuck
    expect(canStartAuthFlow()).toBe(false);

    // Advance past the 60s timeout
    vi.advanceTimersByTime(61000);
    expect(canStartAuthFlow()).toBe(true);
  });

  it('clears in-progress state when timeout escape hatch triggers', () => {
    startAuthFlow();
    vi.advanceTimersByTime(61000);
    // canStartAuthFlow should internally call endAuthFlow on timeout
    canStartAuthFlow();
    expect(isAuthFlowInProgress()).toBe(false);
  });

  it('returns false when in progress and NOT timed out', () => {
    startAuthFlow();
    vi.advanceTimersByTime(30000); // only 30s, timeout is 60s
    expect(canStartAuthFlow()).toBe(false);
  });
});

// ─── startAuthFlow ──────────────────────────────────────────────

describe('startAuthFlow', () => {
  it('sets isAuthFlowInProgress to true', () => {
    expect(isAuthFlowInProgress()).toBe(false);
    startAuthFlow();
    expect(isAuthFlowInProgress()).toBe(true);
  });

  it('increments redirect count', () => {
    expect(getRedirectCount()).toBe(0);
    startAuthFlow();
    expect(getRedirectCount()).toBe(1);
  });

  it('increments redirect count on each call', () => {
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    expect(getRedirectCount()).toBe(2);
  });
});

// ─── endAuthFlow ────────────────────────────────────────────────

describe('endAuthFlow', () => {
  it('clears in-progress state', () => {
    startAuthFlow();
    expect(isAuthFlowInProgress()).toBe(true);
    endAuthFlow();
    expect(isAuthFlowInProgress()).toBe(false);
  });

  it('does not throw when called without startAuthFlow', () => {
    expect(() => endAuthFlow()).not.toThrow();
  });

  it('does not reset redirect count', () => {
    startAuthFlow();
    endAuthFlow();
    expect(getRedirectCount()).toBe(1);
  });
});

// ─── isAuthFlowInProgress ───────────────────────────────────────

describe('isAuthFlowInProgress', () => {
  it('returns false initially', () => {
    expect(isAuthFlowInProgress()).toBe(false);
  });

  it('returns true after startAuthFlow', () => {
    startAuthFlow();
    expect(isAuthFlowInProgress()).toBe(true);
  });

  it('returns false after endAuthFlow', () => {
    startAuthFlow();
    endAuthFlow();
    expect(isAuthFlowInProgress()).toBe(false);
  });

  it('returns false after resetAuthGuard', () => {
    startAuthFlow();
    resetAuthGuard();
    expect(isAuthFlowInProgress()).toBe(false);
  });
});

// ─── getRedirectCount ───────────────────────────────────────────

describe('getRedirectCount', () => {
  it('returns 0 initially', () => {
    expect(getRedirectCount()).toBe(0);
  });

  it('reflects startAuthFlow calls', () => {
    startAuthFlow();
    expect(getRedirectCount()).toBe(1);
    endAuthFlow();
    startAuthFlow();
    expect(getRedirectCount()).toBe(2);
    endAuthFlow();
    startAuthFlow();
    expect(getRedirectCount()).toBe(3);
  });

  it('resets to 0 after resetAuthGuard', () => {
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();
    expect(getRedirectCount()).toBe(2);
    resetAuthGuard();
    expect(getRedirectCount()).toBe(0);
  });
});

// ─── resetAuthGuard ─────────────────────────────────────────────

describe('resetAuthGuard', () => {
  it('clears in-progress state', () => {
    startAuthFlow();
    resetAuthGuard();
    expect(isAuthFlowInProgress()).toBe(false);
  });

  it('clears redirect count', () => {
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();
    resetAuthGuard();
    expect(getRedirectCount()).toBe(0);
  });

  it('allows fresh start after reset', () => {
    // Max out redirects
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();
    expect(canStartAuthFlow()).toBe(false);

    resetAuthGuard();
    expect(canStartAuthFlow()).toBe(true);
  });

  it('allows 3 new redirects after reset', () => {
    // Max out redirects
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();

    resetAuthGuard();

    // Should allow 3 more
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();
    startAuthFlow();
    endAuthFlow();
    expect(getRedirectCount()).toBe(3);
    expect(canStartAuthFlow()).toBe(false);
  });
});
