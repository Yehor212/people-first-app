import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (must be before imports) ────────────────────────────────────────

let mockIsNative = false;

vi.mock('@/lib/platform', () => ({
  get isNative() { return mockIsNative; },
}));

vi.mock('../logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/env', () => ({
  BASE_URL: '/',
  IS_DEV: false,
}));

// ─── Imports ───────────────────────────────────────────────────────────────

import {
  getAuthRedirectUrl,
  isNativePlatform,
  handleAuthCallback,
  AUTH_COMPLETE_EVENT,
  notifyAuthComplete,
  setPendingAuthUrl,
  getPendingAuthUrl,
  hasPendingAuthUrl,
} from '@/lib/authRedirect';

// ─── Helpers ───────────────────────────────────────────────────────────────

const createMockSupabase = (overrides?: any) => ({
  auth: {
    exchangeCodeForSession: vi.fn().mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    }),
    setSession: vi.fn().mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    }),
    ...overrides,
  },
}) as any;

// ─── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockIsNative = false;
  vi.clearAllMocks();
  // Clear any pending auth URL from previous tests
  getPendingAuthUrl();
});

// ─── getAuthRedirectUrl ────────────────────────────────────────────────────

describe('getAuthRedirectUrl', () => {
  it('returns native redirect URL when isNative is true', () => {
    mockIsNative = true;
    const url = getAuthRedirectUrl();
    expect(url).toBe('com.zenflow.app://login-callback');
  });

  it('returns web redirect URL when isNative is false', () => {
    mockIsNative = false;
    const url = getAuthRedirectUrl();
    expect(url).toBe(`${window.location.origin}/`);
  });

  it('web URL has no double slashes in path', () => {
    mockIsNative = false;
    const url = getAuthRedirectUrl();
    // After origin there should be exactly one slash, not two
    const afterOrigin = url.replace(window.location.origin, '');
    expect(afterOrigin).not.toContain('//');
  });

  it('web URL ends with trailing slash', () => {
    mockIsNative = false;
    const url = getAuthRedirectUrl();
    expect(url.endsWith('/')).toBe(true);
  });
});

// ─── isNativePlatform ──────────────────────────────────────────────────────

describe('isNativePlatform', () => {
  it('returns false when isNative is false', () => {
    mockIsNative = false;
    expect(isNativePlatform()).toBe(false);
  });

  it('returns true when isNative is true', () => {
    mockIsNative = true;
    expect(isNativePlatform()).toBe(true);
  });
});

// ─── handleAuthCallback ────────────────────────────────────────────────────

describe('handleAuthCallback', () => {
  it('returns undefined when supabaseClient is falsy', async () => {
    const result = await handleAuthCallback(null as any, 'https://example.com?code=abc');
    expect(result).toBeUndefined();
  });

  it('returns undefined when url is falsy', async () => {
    const mockSupabase = createMockSupabase();
    const result = await handleAuthCallback(mockSupabase, '');
    expect(result).toBeUndefined();
  });

  it('throws on invalid URL', async () => {
    const mockSupabase = createMockSupabase();
    await expect(handleAuthCallback(mockSupabase, 'not-a-url'))
      .rejects.toThrow('Invalid callback URL');
  });

  // ── Error description handling ──

  it('throws with known error code from error_description param', async () => {
    const mockSupabase = createMockSupabase();
    await expect(
      handleAuthCallback(mockSupabase, 'https://example.com?error_description=access_denied')
    ).rejects.toThrow('access_denied');
  });

  it('throws generic message for HTML in error_description (XSS protection)', async () => {
    const mockSupabase = createMockSupabase();
    await expect(
      handleAuthCallback(mockSupabase, 'https://example.com?error_description=<script>alert(1)</script>')
    ).rejects.toThrow('Authentication failed. Please try again.');
  });

  it('throws generic message for overly long error_description (>200 chars)', async () => {
    const mockSupabase = createMockSupabase();
    const longMessage = 'a'.repeat(300);
    await expect(
      handleAuthCallback(mockSupabase, `https://example.com?error_description=${longMessage}`)
    ).rejects.toThrow('Authentication error occurred');
  });

  // ── PKCE code exchange ──

  it('calls exchangeCodeForSession with valid code', async () => {
    const mockSupabase = createMockSupabase();
    await handleAuthCallback(mockSupabase, 'https://example.com?code=validCode123');
    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('validCode123');
  });

  it('throws on invalid code format (special characters)', async () => {
    const mockSupabase = createMockSupabase();
    await expect(
      handleAuthCallback(mockSupabase, 'https://example.com?code=invalid<code>')
    ).rejects.toThrow('Invalid authorization code');
  });

  it('throws on code exceeding 256 characters', async () => {
    const mockSupabase = createMockSupabase();
    const longCode = 'a'.repeat(257);
    await expect(
      handleAuthCallback(mockSupabase, `https://example.com?code=${longCode}`)
    ).rejects.toThrow('Invalid authorization code');
  });

  it('throws when exchangeCodeForSession returns an error', async () => {
    const mockSupabase = createMockSupabase({
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: { message: 'Code expired' },
      }),
    });
    await expect(
      handleAuthCallback(mockSupabase, 'https://example.com?code=validCode')
    ).rejects.toThrow('Session exchange failed: Code expired');
  });

  it('throws when exchangeCodeForSession returns no session', async () => {
    const mockSupabase = createMockSupabase({
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
    });
    await expect(
      handleAuthCallback(mockSupabase, 'https://example.com?code=validCode')
    ).rejects.toThrow('Session exchange succeeded but no session returned');
  });

  // ── Implicit flow (tokens in hash) ──

  it('calls setSession with access_token and refresh_token from hash', async () => {
    const mockSupabase = createMockSupabase();
    await handleAuthCallback(
      mockSupabase,
      'https://example.com#access_token=abc123&refresh_token=def456'
    );
    expect(mockSupabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'abc123',
      refresh_token: 'def456',
    });
  });

  it('throws when setSession returns an error', async () => {
    const mockSupabase = createMockSupabase({
      setSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid token' },
      }),
    });
    await expect(
      handleAuthCallback(
        mockSupabase,
        'https://example.com#access_token=abc&refresh_token=def'
      )
    ).rejects.toThrow('Session setup failed: Invalid token');
  });

  // ── No valid auth method ──

  it('throws when URL has no code or tokens', async () => {
    const mockSupabase = createMockSupabase();
    await expect(
      handleAuthCallback(mockSupabase, 'https://example.com?foo=bar')
    ).rejects.toThrow('No valid authentication code or tokens found');
  });
});

// ─── AUTH_COMPLETE_EVENT ───────────────────────────────────────────────────

describe('AUTH_COMPLETE_EVENT', () => {
  it('equals the expected event name', () => {
    expect(AUTH_COMPLETE_EVENT).toBe('zenflow-auth-complete');
  });
});

// ─── notifyAuthComplete ────────────────────────────────────────────────────

describe('notifyAuthComplete', () => {
  it('dispatches a CustomEvent on window', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    notifyAuthComplete();
    expect(spy).toHaveBeenCalledTimes(1);
    const event = spy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe(AUTH_COMPLETE_EVENT);
    spy.mockRestore();
  });
});

// ─── Pending Auth URL ──────────────────────────────────────────────────────

describe('setPendingAuthUrl / getPendingAuthUrl / hasPendingAuthUrl', () => {
  it('hasPendingAuthUrl returns false initially', () => {
    expect(hasPendingAuthUrl()).toBe(false);
  });

  it('setPendingAuthUrl + hasPendingAuthUrl returns true', () => {
    setPendingAuthUrl('https://example.com/callback');
    expect(hasPendingAuthUrl()).toBe(true);
  });

  it('getPendingAuthUrl returns the set URL', () => {
    setPendingAuthUrl('https://example.com/callback');
    expect(getPendingAuthUrl()).toBe('https://example.com/callback');
  });

  it('getPendingAuthUrl clears the value (one-shot read)', () => {
    setPendingAuthUrl('https://example.com/callback');
    getPendingAuthUrl(); // first read clears it
    expect(getPendingAuthUrl()).toBeNull();
  });

  it('hasPendingAuthUrl returns false after getPendingAuthUrl clears it', () => {
    setPendingAuthUrl('https://example.com/callback');
    getPendingAuthUrl(); // clears
    expect(hasPendingAuthUrl()).toBe(false);
  });

  it('setPendingAuthUrl with null clears pending URL', () => {
    setPendingAuthUrl('https://example.com/callback');
    setPendingAuthUrl(null);
    expect(hasPendingAuthUrl()).toBe(false);
    expect(getPendingAuthUrl()).toBeNull();
  });
});
