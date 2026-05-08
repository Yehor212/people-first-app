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

import {
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

// ─── checkAppVersion ────────────────────────────────────────────

describe('checkAppVersion', () => {
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
});
