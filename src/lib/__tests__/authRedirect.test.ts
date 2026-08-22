import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (must be before imports) ────────────────────────────────────────

let mockIsNative = false;
let mockBaseUrl = '/';
const authTransitionMocks = vi.hoisted(() => ({
  runWithPkceCallbackUrl: vi.fn(
    (_auth: unknown, _url: string, operation: () => Promise<unknown>) => operation(),
  ),
}));

vi.mock('@/lib/platform', () => ({
  get isNative() { return mockIsNative; },
}));

vi.mock('../logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/env', () => ({
  get BASE_URL() { return mockBaseUrl; },
  IS_DEV: false,
}));

vi.mock('@/lib/authTransitionCoordinator', () => ({
  runWithPkceCallbackUrl: authTransitionMocks.runWithPkceCallbackUrl,
}));

// ─── Imports ───────────────────────────────────────────────────────────────

import {
  getAuthRedirectUrl,
  getCleanAuthCallbackUrl,
  isAllowedLocalOAuthOrigin,
  isNativePlatform,
  handleAuthCallback,
  AUTH_COMPLETE_EVENT,
  notifyAuthComplete,
  setPendingAuthUrl,
  getPendingAuthUrl,
  hasPendingAuthUrl,
} from '@/lib/authRedirect';
import { SK } from '@/lib/storageKeys';
import {
  createPkceAttemptRedirectUrl,
  getPkceAttemptIdFromUrl,
  PKCE_ATTEMPT_PARAM,
} from '@/lib/pkceAttemptStorage';

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
  mockBaseUrl = '/';
  vi.clearAllMocks();
  authTransitionMocks.runWithPkceCallbackUrl.mockImplementation(
    (_auth: unknown, _url: string, operation: () => Promise<unknown>) => operation(),
  );
  window.history.pushState({}, '', '/');
  localStorage.removeItem(SK.JOURNAL_PASSWORD_RESET_PROOF);
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

  it('preserves V2 phone route for web OAuth redirect', () => {
    mockIsNative = false;
    window.history.pushState({}, '', '/orb?nav=v2&navLayout=phone');

    const url = getAuthRedirectUrl();

    expect(url).toBe(`${window.location.origin}/orb?nav=v2&navLayout=phone`);
  });

  it('preserves V2 route when GitHub Pages adds a trailing slash', () => {
    mockIsNative = false;
    mockBaseUrl = '/people-first-app/';
    window.history.pushState({}, '', '/people-first-app/habits/?nav=v2&navLayout=phone');

    const url = getAuthRedirectUrl();

    expect(url).toBe(`${window.location.origin}/people-first-app/habits?nav=v2&navLayout=phone`);
  });

  it('preserves Planning as a first-class V2 route for web OAuth redirect', () => {
    mockIsNative = false;
    mockBaseUrl = '/people-first-app/';
    window.history.pushState({}, '', '/people-first-app/planning/?nav=v2&navLayout=phone');

    const url = getAuthRedirectUrl();

    expect(url).toBe(`${window.location.origin}/people-first-app/planning?nav=v2&navLayout=phone`);
  });

  it('returns to V2 from a direct GitHub Pages route even without query params', () => {
    mockIsNative = false;
    mockBaseUrl = '/people-first-app/';
    window.history.pushState({}, '', '/people-first-app/orb/');

    const url = getAuthRedirectUrl();

    expect(url).toBe(`${window.location.origin}/people-first-app/orb?nav=v2`);
  });

  it('allows loopback preview origins without opening arbitrary redirects', () => {
    expect(isAllowedLocalOAuthOrigin('http://127.0.0.1:4175')).toBe(true);
    expect(isAllowedLocalOAuthOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedLocalOAuthOrigin('https://127.0.0.1:4175')).toBe(false);
    expect(isAllowedLocalOAuthOrigin('http://evil.localhost.example:4175')).toBe(false);
    expect(isAllowedLocalOAuthOrigin('http://127.0.0.1:9999')).toBe(false);
  });

  it('keeps V2 routing while adding one opaque bounded PKCE attempt owner', () => {
    window.history.pushState({}, '', '/settings?nav=v2&navLayout=phone');

    const owned = createPkceAttemptRedirectUrl(getAuthRedirectUrl(), 'oauth');
    const parsed = new URL(owned.redirectUrl);

    expect(parsed.pathname).toBe('/settings');
    expect(parsed.searchParams.get('nav')).toBe('v2');
    expect(parsed.searchParams.get('navLayout')).toBe('phone');
    expect(parsed.searchParams.get(PKCE_ATTEMPT_PARAM)).toBe(owned.attemptId);
    expect(getPkceAttemptIdFromUrl(owned.redirectUrl)).toBe(owned.attemptId);
    expect(owned.attemptId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('rejects malformed and overlong PKCE attempt selectors', () => {
    const attemptId = '11111111-1111-4111-8111-111111111111';
    expect(getPkceAttemptIdFromUrl('https://zenflow.app/?zenflowAuthAttempt=not-a-uuid')).toBeNull();
    expect(
      getPkceAttemptIdFromUrl(
        `https://zenflow.app/?zenflowAuthAttempt=${'a'.repeat(4_096)}`,
      ),
    ).toBeNull();
    expect(
      getPkceAttemptIdFromUrl(
        `https://zenflow.app/?zenflowAuthAttempt=${attemptId}&zenflowAuthAttempt=${attemptId}`,
      ),
    ).toBeNull();
    expect(
      getPkceAttemptIdFromUrl(
        `https://zenflow.app/?zenflowAuthAttempt=${attemptId}#zenflowAuthAttempt=${attemptId}`,
      ),
    ).toBeNull();
    expect(
      getPkceAttemptIdFromUrl(
        `https://zenflow.app/?padding=${'x'.repeat(9_000)}&zenflowAuthAttempt=${attemptId}`,
      ),
    ).toBeNull();
  });

  it('rejects credentialed, executable, and off-origin PKCE redirects', () => {
    expect(() =>
      createPkceAttemptRedirectUrl('https://user:password@zenflow.app/', 'oauth'),
    ).toThrow('not allowed');
    expect(() => createPkceAttemptRedirectUrl('javascript:alert(1)', 'oauth')).toThrow(
      'not allowed',
    );
    expect(() => createPkceAttemptRedirectUrl('https://evil.example/', 'oauth')).toThrow(
      'not allowed',
    );
    expect(() => createPkceAttemptRedirectUrl('http://localhost:9999/', 'oauth')).toThrow(
      'not allowed',
    );
    expect(() =>
      createPkceAttemptRedirectUrl(
        `https://zenflow.app/?padding=${'x'.repeat(9_000)}`,
        'oauth',
      ),
    ).toThrow('not allowed');
  });

  it('accepts only the configured hosted, loopback, Capacitor, and native redirect families', () => {
    expect(
      createPkceAttemptRedirectUrl('https://zenflow.app/settings?nav=v2', 'oauth').redirectUrl,
    ).toContain(PKCE_ATTEMPT_PARAM);
    expect(
      createPkceAttemptRedirectUrl('http://127.0.0.1:4175/settings', 'oauth').redirectUrl,
    ).toContain(PKCE_ATTEMPT_PARAM);
    expect(
      createPkceAttemptRedirectUrl('capacitor://localhost/settings', 'oauth').redirectUrl,
    ).toContain(PKCE_ATTEMPT_PARAM);
    expect(
      createPkceAttemptRedirectUrl('com.zenflow.app://login-callback', 'oauth').redirectUrl,
    ).toContain(PKCE_ATTEMPT_PARAM);
  });
});

describe('getCleanAuthCallbackUrl', () => {
  it('removes OAuth params while preserving V2 routing params', () => {
    const cleanUrl = getCleanAuthCallbackUrl(
      'https://example.com/people-first-app/orb?nav=v2&navLayout=phone&code=abc&state=xyz&journalReset=proof-1'
    );

    expect(cleanUrl).toBe('/people-first-app/orb?nav=v2&navLayout=phone');
  });

  it('removes OAuth tokens from the hash while preserving non-OAuth hash params', () => {
    const cleanUrl = getCleanAuthCallbackUrl(
      'https://example.com/people-first-app/orb?nav=v2#section=mood&access_token=abc&refresh_token=def&provider_token=ghi&state=xyz&journalReset=proof-2'
    );

    expect(cleanUrl).toBe('/people-first-app/orb?nav=v2#section=mood');
  });

  it('removes the attempt selector with callback credentials but preserves app routing', () => {
    const raw = `/settings?nav=v2&navLayout=phone&code=secret&${PKCE_ATTEMPT_PARAM}=123e4567-e89b-42d3-a456-426614174001`;

    expect(getCleanAuthCallbackUrl(`${window.location.origin}${raw}`)).toBe(
      '/settings?nav=v2&navLayout=phone',
    );
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

  it('calls exchangeCodeForSession with normalized code', async () => {
    const mockSupabase = createMockSupabase();
    await handleAuthCallback(mockSupabase, 'https://example.com?code=%20validCode123%20');
    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('validCode123');
  });

  it('stores journal reset proof after a successful PKCE journal callback', async () => {
    const mockSupabase = createMockSupabase();

    const exchangedSession = await handleAuthCallback(
      mockSupabase,
      'com.zenflow.app://login-callback?code=validCode&journalReset=native-proof-1',
    );

    expect(exchangedSession).toMatchObject({ user: { id: 'user-123' } });
    expect(JSON.parse(localStorage.getItem(SK.JOURNAL_PASSWORD_RESET_PROOF) || '{}')).toMatchObject({
      nonce: 'native-proof-1',
      userId: 'user-123',
    });
  });

  it('accepts code with special characters and forwards it', async () => {
    const mockSupabase = createMockSupabase();
    await handleAuthCallback(mockSupabase, 'https://example.com?code=invalid%3Ccode%3E');
    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('invalid<code>');
  });

  it('throws on code exceeding 2048 characters', async () => {
    const mockSupabase = createMockSupabase();
    const longCode = 'a'.repeat(2049);
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
    expect(localStorage.getItem(SK.JOURNAL_PASSWORD_RESET_PROOF)).toBeNull();
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

  it('does not accept implicit tokens as journal reset proof', async () => {
    const mockSupabase = createMockSupabase();

    await handleAuthCallback(
      mockSupabase,
      'https://example.com#access_token=abc123&refresh_token=def456&journalReset=hash-proof-1'
    );

    expect(localStorage.getItem(SK.JOURNAL_PASSWORD_RESET_PROOF)).toBeNull();
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
