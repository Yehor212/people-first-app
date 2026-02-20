import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────
vi.mock('@/lib/platform', () => ({ isNative: false }));
vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(),
    getLaunchUrl: vi.fn().mockResolvedValue(null),
  },
}));

import { parseDeepLink, subscribeToDeepLinks, DEEP_LINK_EVENT, DeepLinkData } from '@/lib/deepLinks';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── DEEP_LINK_EVENT constant ───────────────────────────────────

describe('DEEP_LINK_EVENT', () => {
  it('equals "zenflow-deep-link"', () => {
    expect(DEEP_LINK_EVENT).toBe('zenflow-deep-link');
  });
});

// ─── parseDeepLink ──────────────────────────────────────────────

describe('parseDeepLink', () => {
  it('parses zenflow://challenge/ABC123 as challenge', () => {
    const result = parseDeepLink('zenflow://challenge/ABC123');
    expect(result).toEqual({ type: 'challenge', id: 'ABC123' });
  });

  it('parses zenflow://challenge?id=TEST1234 as challenge', () => {
    const result = parseDeepLink('zenflow://challenge?id=TEST1234');
    expect(result).toEqual({ type: 'challenge', id: 'TEST1234' });
  });

  it('parses https://zenflow.app/challenge/ABC123 as challenge', () => {
    const result = parseDeepLink('https://zenflow.app/challenge/ABC123');
    expect(result).toEqual({ type: 'challenge', id: 'ABC123' });
  });

  it('parses https://www.zenflow.app/challenge/ABC123 as challenge', () => {
    const result = parseDeepLink('https://www.zenflow.app/challenge/ABC123');
    expect(result).toEqual({ type: 'challenge', id: 'ABC123' });
  });

  it('returns unknown for invalid id (too short)', () => {
    const result = parseDeepLink('zenflow://challenge/AB');
    expect(result).toEqual({ type: 'unknown', params: expect.any(Object) });
  });

  it('returns unknown for invalid id (too long — >12 chars)', () => {
    const result = parseDeepLink('zenflow://challenge/ABCDEFGHIJKLM');
    expect(result).toEqual({ type: 'unknown', params: expect.any(Object) });
  });

  it('returns unknown for completely unknown URL', () => {
    const result = parseDeepLink('https://example.com/something');
    expect(result).toEqual({ type: 'unknown', params: expect.any(Object) });
  });

  it('returns null for invalid URL', () => {
    const result = parseDeepLink('not a url at all');
    expect(result).toBeNull();
  });

  it('returns unknown for zenflow://other', () => {
    const result = parseDeepLink('zenflow://other');
    expect(result).toEqual({ type: 'unknown', params: expect.any(Object) });
  });

  it('does NOT parse OAuth callback (login-callback) — parseDeepLink does not filter it', () => {
    // parseDeepLink itself does not filter OAuth; handleDeepLink does that.
    // login-callback just becomes an unknown deep link
    const result = parseDeepLink('com.zenflow.app://login-callback');
    // URL constructor may or may not parse custom schemes —
    // the important point is it does NOT return type='challenge'
    expect(result?.type).not.toBe('challenge');
  });
});

// ─── subscribeToDeepLinks ───────────────────────────────────────

describe('subscribeToDeepLinks', () => {
  it('adds event listener for DEEP_LINK_EVENT', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const cb = vi.fn();
    subscribeToDeepLinks(cb);
    expect(addSpy).toHaveBeenCalledWith(DEEP_LINK_EVENT, expect.any(Function));
    addSpy.mockRestore();
  });

  it('cleanup function removes the listener', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const cb = vi.fn();
    const cleanup = subscribeToDeepLinks(cb);
    cleanup();
    expect(removeSpy).toHaveBeenCalledWith(DEEP_LINK_EVENT, expect.any(Function));
    removeSpy.mockRestore();
  });

  it('fires callback with data on custom event', () => {
    const cb = vi.fn();
    const cleanup = subscribeToDeepLinks(cb);

    const detail: DeepLinkData = { type: 'challenge', id: 'XYZ789' };
    window.dispatchEvent(new CustomEvent(DEEP_LINK_EVENT, { detail }));

    expect(cb).toHaveBeenCalledWith(detail);
    cleanup();
  });
});
