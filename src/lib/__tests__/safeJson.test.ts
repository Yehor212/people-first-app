import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  safeJsonParse,
  safeJsonStringify,
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeSessionStorageGet,
  safeSessionStorageSet,
  storageGetRaw,
  storageSetRaw,
  storageRemove,
} from '@/lib/safeJson';
import { logger } from '@/lib/logger';

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockedLogger = vi.mocked(logger);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// ─── safeJsonParse ───────────────────────────────────────────────

describe('safeJsonParse', () => {
  it('parses a valid JSON object', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  it('parses a valid JSON array', () => {
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('parses a valid JSON number', () => {
    expect(safeJsonParse('42', 0)).toBe(42);
  });

  it('parses a valid JSON boolean', () => {
    expect(safeJsonParse('true', false)).toBe(true);
  });

  it('parses a valid JSON string', () => {
    expect(safeJsonParse('"hello"', '')).toBe('hello');
  });

  it('returns fallback for null input', () => {
    expect(safeJsonParse(null, { default: true })).toEqual({ default: true });
  });

  it('returns fallback for undefined input', () => {
    expect(safeJsonParse(undefined, 'fallback')).toBe('fallback');
  });

  it('returns fallback for empty string input', () => {
    expect(safeJsonParse('', 99)).toBe(99);
  });

  it('returns fallback for malformed JSON and logs warning', () => {
    const result = safeJsonParse('{broken', 'default');
    expect(result).toBe('default');
    expect(mockedLogger.warn).toHaveBeenCalled();
  });

  it('returns fallback array for malformed JSON', () => {
    expect(safeJsonParse('[invalid', [])).toEqual([]);
  });

  it('preserves generic type on returned value', () => {
    const result = safeJsonParse<number[]>('[1,2]', []);
    expect(result).toEqual([1, 2]);
  });
});

// ─── safeJsonStringify ───────────────────────────────────────────

describe('safeJsonStringify', () => {
  it('stringifies a valid object', () => {
    expect(safeJsonStringify({ a: 1 })).toBe('{"a":1}');
  });

  it('stringifies null to "null"', () => {
    expect(safeJsonStringify(null)).toBe('null');
  });

  it('stringifies an array', () => {
    expect(safeJsonStringify([1, 2])).toBe('[1,2]');
  });

  it('returns null for circular reference and logs warning', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    const result = safeJsonStringify(obj);
    expect(result).toBeNull();
    expect(mockedLogger.warn).toHaveBeenCalled();
  });
});

// ─── safeLocalStorageGet ─────────────────────────────────────────

describe('safeLocalStorageGet', () => {
  it('returns parsed value from localStorage', () => {
    localStorage.setItem('key1', '{"x":10}');
    expect(safeLocalStorageGet('key1', {})).toEqual({ x: 10 });
  });

  it('returns fallback for missing key', () => {
    expect(safeLocalStorageGet('missing', 'default')).toBe('default');
  });

  it('returns fallback for malformed JSON in storage', () => {
    localStorage.setItem('bad', '{corrupt');
    expect(safeLocalStorageGet('bad', [])).toEqual([]);
  });

  it('returns fallback when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(safeLocalStorageGet('any', 42)).toBe(42);
  });
});

// ─── safeLocalStorageSet ─────────────────────────────────────────

describe('safeLocalStorageSet', () => {
  it('stores value and returns true', () => {
    const result = safeLocalStorageSet('key', { a: 1 });
    expect(result).toBe(true);
    expect(localStorage.getItem('key')).toBe('{"a":1}');
  });

  it('returns false when stringify fails (circular ref)', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(safeLocalStorageSet('key', obj)).toBe(false);
  });

  it('returns false when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(safeLocalStorageSet('key', 'value')).toBe(false);
  });
});

// ─── safeSessionStorageGet ───────────────────────────────────────

describe('safeSessionStorageGet', () => {
  it('returns parsed value from sessionStorage', () => {
    sessionStorage.setItem('token', '"abc123"');
    expect(safeSessionStorageGet('token', '')).toBe('abc123');
  });

  it('returns fallback for missing key', () => {
    expect(safeSessionStorageGet('missing', null)).toBeNull();
  });

  it('returns fallback when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(safeSessionStorageGet('any', 'fallback')).toBe('fallback');
  });
});

// ─── safeSessionStorageSet ───────────────────────────────────────

describe('safeSessionStorageSet', () => {
  it('stores value and returns true', () => {
    const result = safeSessionStorageSet('token', { jwt: 'xyz' });
    expect(result).toBe(true);
    expect(sessionStorage.getItem('token')).toBe('{"jwt":"xyz"}');
  });

  it('returns false when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(safeSessionStorageSet('key', 'value')).toBe(false);
  });

  it('returns false when stringify fails', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(safeSessionStorageSet('key', obj)).toBe(false);
  });
});

// ─── storageGetRaw ───────────────────────────────────────────────

describe('storageGetRaw', () => {
  it('returns stored string', () => {
    localStorage.setItem('theme', 'dark');
    expect(storageGetRaw('theme')).toBe('dark');
  });

  it('returns custom fallback for missing key', () => {
    expect(storageGetRaw('missing', 'light')).toBe('light');
  });

  it('returns empty string as default fallback for missing key', () => {
    expect(storageGetRaw('missing')).toBe('');
  });

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(storageGetRaw('key', 'safe')).toBe('safe');
  });
});

// ─── storageSetRaw ───────────────────────────────────────────────

describe('storageSetRaw', () => {
  it('stores a string in localStorage', () => {
    storageSetRaw('lang', 'en');
    expect(localStorage.getItem('lang')).toBe('en');
  });

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => storageSetRaw('key', 'val')).not.toThrow();
  });
});

// ─── storageRemove ───────────────────────────────────────────────

describe('storageRemove', () => {
  it('removes existing key from localStorage', () => {
    localStorage.setItem('remove-me', 'value');
    storageRemove('remove-me');
    expect(localStorage.getItem('remove-me')).toBeNull();
  });

  it('does not throw when key does not exist', () => {
    expect(() => storageRemove('nonexistent')).not.toThrow();
  });

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => storageRemove('key')).not.toThrow();
  });
});
