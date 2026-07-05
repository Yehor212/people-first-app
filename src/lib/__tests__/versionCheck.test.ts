import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── In-memory storage mocks ────────────────────────────────────
let localMap: Record<string, string> = {};

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/safeJson', () => ({
  storageGetRaw: vi.fn((key: string, fallback = '') => localMap[key] ?? fallback),
  storageSetRaw: vi.fn((key: string, value: string) => {
    localMap[key] = value;
  }),
}));

vi.mock('@/lib/storageKeys', () => ({
  SK: { LAST_VERSION_CHECK: 'zenflow_last_version_check' },
  SSK: {
    HARD_RELOAD_TS: 'zenflow_hard_reload_ts',
    VERSION_CHECK_FLAG: 'zenflow_check_version',
  },
}));

vi.mock('@/lib/env', () => ({ BASE_URL: '/' }));

// Mock sessionStorage
const mockSessionStorage: Record<string, string | null> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockSessionStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockSessionStorage[key];
  }),
};
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true });

// Stub build constants
vi.stubGlobal('__APP_VERSION__', '1.0.0');
vi.stubGlobal('__APP_BUILD_TIME__', 1000);

import { logger } from '@/lib/logger';

import {
  buildSafeHardReloadUrl,
  reloadAppForUpdate,
  checkAppVersionStatus,
  checkAppVersion,
  shouldCheckVersion,
  markForVersionCheck,
  isOAuthReturn,
  shouldAutoCheckVersion,
  markVersionChecked,
} from '@/lib/versionCheck';

// ─── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  localMap = {};
  Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
});

// ─── shouldCheckVersion ─────────────────────────────────────────

describe('shouldCheckVersion', () => {
  it('returns true after flag is set, then clears the flag', () => {
    mockSessionStorage['zenflow_check_version'] = 'true';
    const result = shouldCheckVersion();
    expect(result).toBe(true);
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('zenflow_check_version');
  });

  it('returns false by default', () => {
    const result = shouldCheckVersion();
    expect(result).toBe(false);
  });
});

// ─── markForVersionCheck ────────────────────────────────────────

describe('markForVersionCheck', () => {
  it('sets VERSION_CHECK_FLAG in sessionStorage', () => {
    markForVersionCheck();
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('zenflow_check_version', 'true');
  });
});

// ─── isOAuthReturn ──────────────────────────────────────────────

describe('isOAuthReturn', () => {
  afterEach(() => {
    // Restore document.referrer to default
    Object.defineProperty(document, 'referrer', { value: '', configurable: true });
  });

  it('returns true when referrer contains accounts.google.com', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://accounts.google.com/o/oauth2/auth',
      configurable: true,
    });
    expect(isOAuthReturn()).toBe(true);
  });

  it('returns true when referrer contains Telegram OAuth', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://oauth.telegram.org/auth?bot_id=123&origin=https%3A%2F%2Fexample.com',
      configurable: true,
    });
    expect(isOAuthReturn()).toBe(true);
  });

  it('returns true when referrer contains Facebook OAuth', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://www.facebook.com/v19.0/dialog/oauth?client_id=123',
      configurable: true,
    });
    expect(isOAuthReturn()).toBe(true);
  });

  it('returns false when referrer is empty', () => {
    Object.defineProperty(document, 'referrer', { value: '', configurable: true });
    expect(isOAuthReturn()).toBe(false);
  });
});

// ─── shouldAutoCheckVersion ─────────────────────────────────────

describe('shouldAutoCheckVersion', () => {
  it('returns true if no last check recorded', () => {
    expect(shouldAutoCheckVersion()).toBe(true);
  });

  it('returns false if checked recently (within interval)', () => {
    localMap['zenflow_last_version_check'] = Date.now().toString();
    expect(shouldAutoCheckVersion()).toBe(false);
  });
});

// ─── markVersionChecked ─────────────────────────────────────────

describe('markVersionChecked', () => {
  it('sets timestamp in localStorage via storageSetRaw', () => {
    markVersionChecked();
    expect(localMap['zenflow_last_version_check']).toBeDefined();
    const ts = parseInt(localMap['zenflow_last_version_check'], 10);
    expect(ts).toBeGreaterThan(0);
  });
});

// ─── user-triggered update reload ───────────────────────────────

describe('reloadAppForUpdate', () => {
  it('returns false when the user-triggered update reload loop guard blocks navigation', () => {
    mockSessionStorage['zenflow_hard_reload_ts'] = Date.now().toString();

    expect(reloadAppForUpdate()).toBe(false);
  });

  it('keeps user-triggered update reload scoped to cache-busted navigation without clearing all caches', () => {
    const source = readFileSync('src/lib/versionCheck.ts', 'utf8');
    const start = source.indexOf('export function reloadAppForUpdate');
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf('/**\n * Perform a hard reload', start);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);

    expect(block).toContain('buildSafeHardReloadUrl');
    expect(block).not.toContain('caches.keys');
    expect(block).not.toContain('getRegistrations');
    expect(block).not.toContain('unregister');
  });
});

// ─── checkAppVersion ────────────────────────────────────────────

describe('forceHardReload', () => {
  it('preserves only safe app navigation params while adding a cache-bust parameter', () => {
    const url = new URL('https://app.example/people-first-app/orb?nav=v2&navLayout=phone&planningDate=2026-07-01&view=week&code=oauth-code&state=oauth-state&access_token=secret#access_token=fragment-secret') as unknown as Location;

    expect(buildSafeHardReloadUrl(url, 12345)).toBe(
      'https://app.example/people-first-app/orb?nav=v2&navLayout=phone&planningDate=2026-07-01&view=week&_v=12345',
    );
  });

  it('drops unsafe app params, auth params, and hash fragments from recovery reloads', () => {
    const url = new URL('https://app.example/people-first-app/orb?nav=v1&navLayout=tablet&planningDate=soon&dev=true&orbRenderer=webgl&refresh_token=secret#token=secret') as unknown as Location;

    expect(buildSafeHardReloadUrl(url, 67890)).toBe(
      'https://app.example/people-first-app/orb?_v=67890',
    );
  });

  it('keeps the implementation from copying the full query string or hash', () => {
    const source = readFileSync('src/lib/versionCheck.ts', 'utf8');

    expect(source).toContain('SAFE_HARD_RELOAD_SEARCH_PARAMS');
    expect(source).not.toContain('url.hash = window.location.hash');
    expect(source).not.toContain('new URLSearchParams(window.location.search);\n  url.pathname = safePathname;');
  });
});

// ─── checkAppVersion ────────────────────────────────────────────

describe('checkAppVersion', () => {
  it('returns stale status details when the deployed build differs from the open tab', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ version: '1.0.0', buildTime: 2000 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkAppVersionStatus();

    expect(result).toMatchObject({
      status: 'stale',
      clientVersion: '1.0.0',
      clientBuildTime: 1000,
      serverVersion: '1.0.0',
      serverBuildTime: 2000,
    });
  });

  it('returns unavailable status for a user-triggered check when version.json cannot be reached', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkAppVersionStatus();

    expect(result).toMatchObject({
      status: 'unavailable',
      reason: 'network',
    });
  });

  it('returns true when versions match', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '1.0.0', buildTime: 1000 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkAppVersion();
    expect(result).toBe(true);
  });

  it('returns false on version mismatch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '2.0.0', buildTime: 2000 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkAppVersion();
    expect(result).toBe(false);
  });

  it('returns false on same-version rebuild mismatch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '1.0.0', buildTime: 2000 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkAppVersion();
    expect(result).toBe(false);
  });

  it('parses JSON content-type case-insensitively', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'Application/VND.ZENFLOW+JSON; charset=utf-8' }),
      json: () => Promise.resolve({ version: '2.0.0', buildTime: 2000 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkAppVersion();

    expect(result).toBe(false);
  });

  it('bounds version fetches so resume checks cannot hang the app', () => {
    const source = readFileSync('src/lib/versionCheck.ts', 'utf8');

    expect(source).toContain('VERSION_CHECK_TIMEOUT_MS');
    expect(source).toContain('new AbortController()');
    expect(source).toContain('signal: controller.signal');
    expect(source).toContain('window.setTimeout(() => controller.abort(), VERSION_CHECK_TIMEOUT_MS)');
    expect(source).toContain('window.clearTimeout(timeoutId)');
  });

  it('returns true on fetch error (network failure)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkAppVersion();
    expect(result).toBe(true);
  });

  it('returns true if version.json not found (404)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkAppVersion();
    expect(result).toBe(true);
  });

  it('returns true when SPA fallback serves HTML instead of version.json', async () => {
    const warnSpy = vi.spyOn(logger, 'warn');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: () => Promise.resolve('<!DOCTYPE html><html><body>ZenFlow</body></html>'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkAppVersion();

    expect(result).toBe(true);
    expect(warnSpy).not.toHaveBeenCalledWith(
      '[VersionCheck] Check failed, continuing anyway:',
      expect.anything(),
    );
  });
});
