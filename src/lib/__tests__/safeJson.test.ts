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
  vi.clearAllMocks();
});

// ─── safeJsonParse ───────────────────────────────────────────────

describe('safeJsonParse', () => {
  describe('valid JSON', () => {
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

    it('parses JSON null', () => {
      expect(safeJsonParse('null', 'fallback')).toBeNull();
    });

    it('parses nested objects', () => {
      const input = '{"a":{"b":{"c":3}}}';
      expect(safeJsonParse(input, {})).toEqual({ a: { b: { c: 3 } } });
    });

    it('preserves generic type on returned value', () => {
      const result = safeJsonParse<number[]>('[1,2]', []);
      expect(result).toEqual([1, 2]);
    });
  });

  describe('null/undefined/empty inputs', () => {
    it('returns fallback for null input', () => {
      expect(safeJsonParse(null, { default: true })).toEqual({ default: true });
    });

    it('returns fallback for undefined input', () => {
      expect(safeJsonParse(undefined, 'fallback')).toBe('fallback');
    });

    it('returns fallback for empty string input', () => {
      expect(safeJsonParse('', 99)).toBe(99);
    });

    it('does not log warning for null input', () => {
      safeJsonParse(null, 'fb');
      expect(mockedLogger.warn).not.toHaveBeenCalled();
    });

    it('does not log warning for undefined input', () => {
      safeJsonParse(undefined, 'fb');
      expect(mockedLogger.warn).not.toHaveBeenCalled();
    });

    it('does not log warning for empty string input', () => {
      safeJsonParse('', 'fb');
      expect(mockedLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('invalid JSON', () => {
    it('returns fallback for malformed JSON object', () => {
      expect(safeJsonParse('{broken', 'default')).toBe('default');
    });

    it('returns fallback for malformed JSON array', () => {
      expect(safeJsonParse('[invalid', [])).toEqual([]);
    });

    it('returns fallback for plain text', () => {
      expect(safeJsonParse('not json at all', 42)).toBe(42);
    });

    it('returns fallback for trailing comma JSON', () => {
      expect(safeJsonParse('{"a":1,}', {})).toEqual({});
    });

    it('returns fallback for single quotes JSON', () => {
      expect(safeJsonParse("{'a':1}", {})).toEqual({});
    });

    it('logs warning on parse failure', () => {
      safeJsonParse('{broken', 'default');
      expect(mockedLogger.warn).toHaveBeenCalled();
    });

    it('log warning includes input length', () => {
      safeJsonParse('{broken', 'default');
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ inputLength: 7 }),
      );
    });

    it('never includes malformed user content in logs', () => {
      safeJsonParse('{"privateJournal":"do not log"', null);

      expect(mockedLogger.warn).toHaveBeenCalled();
      const details = mockedLogger.warn.mock.calls.at(-1)?.[1];
      expect(details).not.toHaveProperty('inputPreview');
      expect(JSON.stringify(details)).not.toContain('privateJournal');
      expect(JSON.stringify(details)).not.toContain('do not log');
    });

    it('never leaks an unquoted private marker through any logger argument', () => {
      const privateMarker = 'PRIVATE_JOURNAL_MARKER_91f30';
      const malformedInput = `{${privateMarker}`;

      safeJsonParse(malformedInput, null);

      const latestCall = mockedLogger.warn.mock.calls.at(-1);
      expect(latestCall).toEqual([
        '[SafeJSON] Parse failed:',
        {
          reason: 'invalid-json',
          errorName: 'SyntaxError',
          inputLength: malformedInput.length,
        },
      ]);
      for (const argument of latestCall ?? []) {
        const serialized = typeof argument === 'string' ? argument : JSON.stringify(argument);
        expect(serialized).not.toContain(privateMarker);
      }
    });
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

  it('stringifies a string', () => {
    expect(safeJsonStringify('hello')).toBe('"hello"');
  });

  it('stringifies a number', () => {
    expect(safeJsonStringify(42)).toBe('42');
  });

  it('stringifies a boolean', () => {
    expect(safeJsonStringify(true)).toBe('true');
  });

  it('stringifies undefined to undefined (JSON spec)', () => {
    expect(safeJsonStringify(undefined)).toBeUndefined();
  });

  it('returns null for circular reference', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(safeJsonStringify(obj)).toBeNull();
  });

  it('logs warning on circular reference', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    safeJsonStringify(obj);
    expect(mockedLogger.warn).toHaveBeenCalled();
  });

  it('handles deeply nested objects', () => {
    const deep = { a: { b: { c: { d: 'deep' } } } };
    expect(safeJsonStringify(deep)).toBe('{"a":{"b":{"c":{"d":"deep"}}}}');
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

  it('returns fallback when localStorage throws (e.g. SecurityError)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(safeLocalStorageGet('any', 42)).toBe(42);
  });

  it('logs warning when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    safeLocalStorageGet('any', null);
    expect(mockedLogger.warn).toHaveBeenCalled();
  });

  it('returns parsed array from localStorage', () => {
    localStorage.setItem('arr', '[1,2,3]');
    expect(safeLocalStorageGet('arr', [])).toEqual([1, 2, 3]);
  });

  it('returns parsed boolean from localStorage', () => {
    localStorage.setItem('flag', 'true');
    expect(safeLocalStorageGet('flag', false)).toBe(true);
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

  it('returns false on QuotaExceededError and logs error', () => {
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError;
    });
    const result = safeLocalStorageSet('key', 'value');
    expect(result).toBe(false);
    expect(mockedLogger.error).toHaveBeenCalled();
  });

  it('stores null value as "null"', () => {
    safeLocalStorageSet('nullKey', null);
    expect(localStorage.getItem('nullKey')).toBe('null');
  });

  it('stores array value', () => {
    safeLocalStorageSet('arr', [1, 2, 3]);
    expect(localStorage.getItem('arr')).toBe('[1,2,3]');
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

  it('logs warning when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    safeSessionStorageGet('any', null);
    expect(mockedLogger.warn).toHaveBeenCalled();
  });

  it('returns parsed object from sessionStorage', () => {
    sessionStorage.setItem('data', '{"user":"test"}');
    expect(safeSessionStorageGet('data', {})).toEqual({ user: 'test' });
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

  it('logs warning when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    safeSessionStorageSet('key', 'value');
    expect(mockedLogger.warn).toHaveBeenCalled();
  });

  it('stores string value', () => {
    safeSessionStorageSet('str', 'hello');
    expect(sessionStorage.getItem('str')).toBe('"hello"');
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

  it('returns raw string without JSON parsing', () => {
    localStorage.setItem('raw', '{"not":"parsed"}');
    expect(storageGetRaw('raw')).toBe('{"not":"parsed"}');
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

  it('does not throw on QuotaExceededError', () => {
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError;
    });
    expect(() => storageSetRaw('key', 'val')).not.toThrow();
  });

  it('overwrites existing value', () => {
    localStorage.setItem('lang', 'en');
    storageSetRaw('lang', 'uk');
    expect(localStorage.getItem('lang')).toBe('uk');
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
