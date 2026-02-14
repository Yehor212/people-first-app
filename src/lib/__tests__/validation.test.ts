import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeUserName } from '../sanitize';
import {
  generateSecureRandom,
  generateSecureId,
  sanitizeObject,
  safeParseInt,
  safeParseFloat,
  safeAverage,
  safeValidate,
  userNameSchema,
  moodNoteSchema,
  habitNameSchema,
  taskNameSchema,
  emailSchema,
  gratitudeTextSchema,
  moodEntrySchema,
  habitSchema,
  focusSessionSchema,
  settingSchema,
  backupDataSchema,
} from '../validation';

// ============================================
// generateSecureRandom
// ============================================

describe('generateSecureRandom', () => {
  it('generates string of default length (9)', () => {
    const result = generateSecureRandom();
    expect(result).toHaveLength(9);
  });

  it('generates string of specified length', () => {
    expect(generateSecureRandom(5)).toHaveLength(5);
    expect(generateSecureRandom(20)).toHaveLength(20);
    expect(generateSecureRandom(1)).toHaveLength(1);
  });

  it('contains only alphanumeric lowercase characters', () => {
    const result = generateSecureRandom(100);
    expect(result).toMatch(/^[a-z0-9]+$/);
  });

  it('generates unique values on each call', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(generateSecureRandom());
    }
    // Should have 100 unique values (collision extremely unlikely)
    expect(results.size).toBe(100);
  });
});

// ============================================
// generateSecureId
// ============================================

describe('generateSecureId', () => {
  it('generates id with correct prefix', () => {
    const id = generateSecureId('challenge');
    expect(id).toMatch(/^challenge_\d+_[a-z0-9]{9}$/);
  });

  it('includes timestamp', () => {
    const before = Date.now();
    const id = generateSecureId('test');
    const after = Date.now();

    const timestamp = parseInt(id.split('_')[1], 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('generates unique ids', () => {
    const id1 = generateSecureId('task');
    const id2 = generateSecureId('task');
    expect(id1).not.toBe(id2);
  });
});

// ============================================
// sanitizeString (XSS Prevention)
// ============================================

describe('sanitizeString', () => {
  it('removes script tags', () => {
    const malicious = '<script>alert("xss")</script>Hello';
    const result = sanitizeString(malicious);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('</script>');
    expect(result).toContain('Hello');
  });

  it('removes onclick and other event handlers', () => {
    const malicious = '<div onclick="alert(1)">Click</div>';
    const result = sanitizeString(malicious);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert');
  });

  it('removes javascript: protocol', () => {
    const malicious = '<a href="javascript:alert(1)">Link</a>';
    const result = sanitizeString(malicious);
    expect(result).not.toContain('javascript:');
  });

  it('removes data: protocol', () => {
    const malicious = '<img src="data:text/html,<script>alert(1)</script>">';
    const result = sanitizeString(malicious);
    expect(result).not.toContain('data:');
  });

  it('removes vbscript: protocol', () => {
    const malicious = '<a href="vbscript:msgbox(1)">Link</a>';
    const result = sanitizeString(malicious);
    expect(result).not.toContain('vbscript:');
  });

  it('removes eval() calls', () => {
    const malicious = 'eval("alert(1)")';
    const result = sanitizeString(malicious);
    expect(result).not.toContain('eval(');
  });

  it('removes expression() CSS hack', () => {
    const malicious = 'style="width:expression(alert(1))"';
    const result = sanitizeString(malicious);
    expect(result).not.toContain('expression(');
  });

  it('removes url() CSS attacks', () => {
    const malicious = 'background:url(javascript:alert(1))';
    const result = sanitizeString(malicious);
    expect(result).not.toContain('url(');
  });

  it('removes angle brackets', () => {
    const input = '<div>content</div>';
    const result = sanitizeString(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('removes curly braces', () => {
    const input = '{"key": "value"}';
    const result = sanitizeString(input);
    expect(result).not.toContain('{');
    expect(result).not.toContain('}');
  });

  it('removes backslashes', () => {
    const input = 'path\\to\\file';
    const result = sanitizeString(input);
    expect(result).not.toContain('\\');
  });

  it('trims whitespace', () => {
    const input = '  hello world  ';
    const result = sanitizeString(input);
    expect(result).toBe('hello world');
  });

  it('truncates to 1000 characters', () => {
    const longInput = 'a'.repeat(2000);
    const result = sanitizeString(longInput);
    expect(result).toHaveLength(1000);
  });

  it('handles empty string', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('preserves normal text', () => {
    const normal = 'Hello, my name is John! How are you?';
    const result = sanitizeString(normal);
    expect(result).toBe(normal);
  });

  it('preserves unicode characters', () => {
    const unicode = 'Привет мир! 你好世界 🎉';
    const result = sanitizeString(unicode);
    expect(result).toContain('Привет');
    expect(result).toContain('你好');
  });

  it('handles nested XSS attempts', () => {
    const malicious = '<<script>script>alert(1)<</script>/script>';
    const result = sanitizeString(malicious);
    // Should not contain actual script tags (angle brackets are removed)
    expect(result).not.toContain('<script');
    expect(result).not.toContain('</script');
  });

  it('handles mixed case XSS attempts', () => {
    const malicious = '<ScRiPt>alert(1)</sCrIpT>';
    const result = sanitizeString(malicious);
    expect(result).not.toContain('ScRiPt');
  });
});

// ============================================
// sanitizeUserName
// ============================================

describe('sanitizeUserName', () => {
  it('truncates to 100 characters', () => {
    const longName = 'a'.repeat(200);
    const result = sanitizeUserName(longName);
    expect(result).toHaveLength(100);
  });

  it('sanitizes XSS in username', () => {
    const malicious = '<script>steal(cookie)</script>John';
    const result = sanitizeUserName(malicious);
    expect(result).not.toContain('script');
    expect(result).toContain('John');
  });

  it('preserves normal names', () => {
    expect(sanitizeUserName('John Doe')).toBe('John Doe');
    expect(sanitizeUserName('Иван Иванов')).toBe('Иван Иванов');
  });
});

// ============================================
// sanitizeObject (Prototype Pollution Prevention)
// ============================================

describe('sanitizeObject', () => {
  it('removes __proto__ property', () => {
    const malicious = { name: 'test', __proto__: { isAdmin: true } };
    const result = sanitizeObject(malicious as Record<string, unknown>);
    expect(result).not.toHaveProperty('__proto__');
    expect(result.name).toBe('test');
  });

  it('removes constructor property', () => {
    const malicious = { name: 'test', constructor: { prototype: {} } };
    const result = sanitizeObject(malicious as Record<string, unknown>);
    expect(Object.keys(result)).not.toContain('constructor');
  });

  it('removes prototype property', () => {
    const malicious = { name: 'test', prototype: { evil: true } };
    const result = sanitizeObject(malicious as Record<string, unknown>);
    expect(result).not.toHaveProperty('prototype');
  });

  it('sanitizes nested objects recursively', () => {
    const malicious = {
      level1: {
        level2: {
          __proto__: { hack: true },
          value: 'safe',
        },
      },
    };
    const result = sanitizeObject(malicious as Record<string, unknown>);
    expect((result.level1 as Record<string, unknown>).level2).not.toHaveProperty('__proto__');
  });

  it('sanitizes arrays with objects', () => {
    const malicious = {
      items: [{ __proto__: { hack: true }, name: 'item1' }],
    };
    const result = sanitizeObject(malicious as Record<string, unknown>);
    expect((result.items as unknown[])[0]).not.toHaveProperty('__proto__');
  });

  it('preserves normal data', () => {
    const normal = {
      name: 'John',
      age: 30,
      hobbies: ['reading', 'coding'],
      address: { city: 'NYC', zip: '10001' },
    };
    const result = sanitizeObject(normal);
    expect(result).toEqual(normal);
  });

  it('handles null input', () => {
    expect(sanitizeObject(null as unknown as Record<string, unknown>)).toBeNull();
  });

  it('handles primitive input', () => {
    expect(sanitizeObject('string' as unknown as Record<string, unknown>)).toBe('string');
    expect(sanitizeObject(123 as unknown as Record<string, unknown>)).toBe(123);
  });
});

// ============================================
// safeParseInt
// ============================================

describe('safeParseInt', () => {
  it('parses valid integers', () => {
    expect(safeParseInt('42', 0)).toBe(42);
    expect(safeParseInt('0', -1)).toBe(0);
    expect(safeParseInt('-10', 0)).toBe(-10);
  });

  it('returns default for NaN', () => {
    expect(safeParseInt('abc', 100)).toBe(100);
    expect(safeParseInt('', 50)).toBe(50);
    expect(safeParseInt(NaN, 25)).toBe(25);
  });

  it('accepts number input', () => {
    expect(safeParseInt(42, 0)).toBe(42);
    // Note: When input is already a number, it's used as-is (no parseInt truncation)
    expect(safeParseInt(3.14, 0)).toBeCloseTo(3.14);
  });

  it('clamps to minimum', () => {
    expect(safeParseInt('5', 0, 10)).toBe(10);
    expect(safeParseInt('-5', 0, 0)).toBe(0);
  });

  it('clamps to maximum', () => {
    expect(safeParseInt('100', 0, undefined, 50)).toBe(50);
    expect(safeParseInt('1000', 0, 0, 100)).toBe(100);
  });

  it('clamps to both min and max', () => {
    expect(safeParseInt('5', 0, 10, 100)).toBe(10);
    expect(safeParseInt('150', 0, 10, 100)).toBe(100);
    expect(safeParseInt('50', 0, 10, 100)).toBe(50);
  });

  it('handles Infinity', () => {
    expect(safeParseInt(Infinity, 0)).toBe(Infinity);
    expect(safeParseInt(Infinity, 0, 0, 100)).toBe(100);
  });
});

// ============================================
// safeParseFloat
// ============================================

describe('safeParseFloat', () => {
  it('parses valid floats', () => {
    expect(safeParseFloat('3.14', 0)).toBeCloseTo(3.14);
    expect(safeParseFloat('0.001', 0)).toBeCloseTo(0.001);
    expect(safeParseFloat('-2.5', 0)).toBeCloseTo(-2.5);
  });

  it('returns default for NaN', () => {
    expect(safeParseFloat('abc', 1.5)).toBe(1.5);
    expect(safeParseFloat('', 0.5)).toBe(0.5);
    expect(safeParseFloat(NaN, 2.0)).toBe(2.0);
  });

  it('accepts number input', () => {
    expect(safeParseFloat(3.14, 0)).toBeCloseTo(3.14);
  });

  it('clamps to bounds', () => {
    expect(safeParseFloat('0.5', 0, 1.0, 2.0)).toBeCloseTo(1.0);
    expect(safeParseFloat('3.0', 0, 1.0, 2.0)).toBeCloseTo(2.0);
  });
});

// ============================================
// safeAverage
// ============================================

describe('safeAverage', () => {
  it('calculates average correctly', () => {
    expect(safeAverage([1, 2, 3, 4, 5])).toBe(3);
    expect(safeAverage([10, 20])).toBe(15);
  });

  it('returns 0 for empty array', () => {
    expect(safeAverage([])).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(safeAverage(null as unknown as number[])).toBe(0);
    expect(safeAverage(undefined as unknown as number[])).toBe(0);
  });

  it('handles single value', () => {
    expect(safeAverage([42])).toBe(42);
  });

  it('handles negative numbers', () => {
    expect(safeAverage([-10, 10])).toBe(0);
  });

  it('handles decimal values', () => {
    expect(safeAverage([1.5, 2.5])).toBe(2);
  });
});

// ============================================
// Zod Schemas
// ============================================

describe('userNameSchema', () => {
  it('accepts valid names', () => {
    expect(userNameSchema.safeParse('John').success).toBe(true);
    expect(userNameSchema.safeParse('Иван Иванов').success).toBe(true);
    expect(userNameSchema.safeParse('José García').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(userNameSchema.safeParse('').success).toBe(false);
  });

  it('rejects names over 100 chars', () => {
    expect(userNameSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });

  it('rejects angle brackets', () => {
    expect(userNameSchema.safeParse('<script>').success).toBe(false);
    expect(userNameSchema.safeParse('John<>').success).toBe(false);
  });

  it('rejects dangerous patterns', () => {
    expect(userNameSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(userNameSchema.safeParse('onclick=alert(1)').success).toBe(false);
  });
});

describe('moodNoteSchema', () => {
  it('accepts valid notes', () => {
    expect(moodNoteSchema.safeParse('').success).toBe(true);
    expect(moodNoteSchema.safeParse('Feeling great today!').success).toBe(true);
  });

  it('rejects notes over 1000 chars', () => {
    expect(moodNoteSchema.safeParse('a'.repeat(1001)).success).toBe(false);
  });

  it('rejects XSS attempts', () => {
    expect(moodNoteSchema.safeParse('<script>').success).toBe(false);
  });
});

describe('habitNameSchema', () => {
  it('accepts valid habit names', () => {
    expect(habitNameSchema.safeParse('Morning workout').success).toBe(true);
    expect(habitNameSchema.safeParse('Медитация').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(habitNameSchema.safeParse('').success).toBe(false);
  });

  it('rejects names over 100 chars', () => {
    expect(habitNameSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });
});

describe('taskNameSchema', () => {
  it('accepts valid task names', () => {
    expect(taskNameSchema.safeParse('Complete project').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(taskNameSchema.safeParse('').success).toBe(false);
  });

  it('rejects names over 200 chars', () => {
    expect(taskNameSchema.safeParse('a'.repeat(201)).success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('accepts valid emails', () => {
    expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    expect(emailSchema.safeParse('user.name+tag@domain.co.uk').success).toBe(true);
  });

  it('accepts empty string', () => {
    expect(emailSchema.safeParse('').success).toBe(true);
  });

  it('accepts undefined', () => {
    expect(emailSchema.safeParse(undefined).success).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(emailSchema.safeParse('notanemail').success).toBe(false);
    expect(emailSchema.safeParse('missing@domain').success).toBe(false);
  });

  it('rejects emails over 254 chars', () => {
    const longEmail = 'a'.repeat(250) + '@b.com';
    expect(emailSchema.safeParse(longEmail).success).toBe(false);
  });
});

describe('gratitudeTextSchema', () => {
  it('accepts valid gratitude text', () => {
    expect(gratitudeTextSchema.safeParse('Grateful for my family').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(gratitudeTextSchema.safeParse('').success).toBe(false);
  });

  it('rejects text over 500 chars', () => {
    expect(gratitudeTextSchema.safeParse('a'.repeat(501)).success).toBe(false);
  });
});

// ============================================
// Data Entry Schemas
// ============================================

describe('moodEntrySchema', () => {
  it('accepts valid mood entry', () => {
    const valid = {
      id: 'mood_123',
      mood: 'great',
      date: '2024-01-15',
      timestamp: 1705334400000,
    };
    expect(moodEntrySchema.safeParse(valid).success).toBe(true);
  });

  it('accepts entry with optional note', () => {
    const valid = {
      id: 'mood_123',
      mood: 'good',
      date: '2024-01-15',
      timestamp: 1705334400000,
      note: 'Productive day',
    };
    expect(moodEntrySchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid mood values', () => {
    const invalid = {
      id: 'mood_123',
      mood: 'amazing', // not in enum
      date: '2024-01-15',
      timestamp: 1705334400000,
    };
    expect(moodEntrySchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects invalid date format', () => {
    const invalid = {
      id: 'mood_123',
      mood: 'great',
      date: '2024/01/15', // wrong format
      timestamp: 1705334400000,
    };
    expect(moodEntrySchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects negative timestamp', () => {
    const invalid = {
      id: 'mood_123',
      mood: 'great',
      date: '2024-01-15',
      timestamp: -1,
    };
    expect(moodEntrySchema.safeParse(invalid).success).toBe(false);
  });
});

describe('habitSchema', () => {
  it('accepts valid habit', () => {
    const valid = {
      id: 'habit_123',
      name: 'Morning meditation',
      icon: '🧘',
      color: 'blue',
      completedDates: ['2024-01-15', '2024-01-16'],
      createdAt: 1705334400000,
    };
    expect(habitSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects completedDates array over 10000', () => {
    const invalid = {
      id: 'habit_123',
      name: 'Test',
      icon: '🧘',
      color: 'blue',
      completedDates: new Array(10001).fill('2024-01-15'),
      createdAt: 1705334400000,
    };
    expect(habitSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('focusSessionSchema', () => {
  it('accepts valid focus session', () => {
    const valid = {
      id: 'focus_123',
      duration: 1500, // 25 minutes
      date: '2024-01-15',
      completedAt: 1705334400000,
    };
    expect(focusSessionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects duration over 24 hours', () => {
    const invalid = {
      id: 'focus_123',
      duration: 86401, // > 24 hours
      date: '2024-01-15',
      completedAt: 1705334400000,
    };
    expect(focusSessionSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects negative duration', () => {
    const invalid = {
      id: 'focus_123',
      duration: -100,
      date: '2024-01-15',
      completedAt: 1705334400000,
    };
    expect(focusSessionSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('settingSchema', () => {
  it('accepts valid setting', () => {
    const valid = { key: 'theme_mode', value: 'dark' };
    expect(settingSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts setting with any value type', () => {
    expect(settingSchema.safeParse({ key: 'count', value: 42 }).success).toBe(true);
    expect(settingSchema.safeParse({ key: 'enabled', value: true }).success).toBe(true);
    expect(settingSchema.safeParse({ key: 'config', value: { a: 1 } }).success).toBe(true);
  });

  it('rejects keys with special characters', () => {
    expect(settingSchema.safeParse({ key: 'key<script>', value: 1 }).success).toBe(false);
    expect(settingSchema.safeParse({ key: 'key with spaces', value: 1 }).success).toBe(false);
  });

  it('accepts keys with underscores and hyphens', () => {
    expect(settingSchema.safeParse({ key: 'my-setting_v2', value: 1 }).success).toBe(true);
  });
});

// ============================================
// safeValidate
// ============================================

describe('safeValidate', () => {
  it('returns data for valid input', () => {
    const result = safeValidate(userNameSchema, 'John');
    expect(result).toBe('John');
  });

  it('returns null for invalid input', () => {
    const result = safeValidate(userNameSchema, '');
    expect(result).toBeNull();
  });

  it('returns null for XSS attempts', () => {
    const result = safeValidate(userNameSchema, '<script>alert(1)</script>');
    expect(result).toBeNull();
  });
});

// ============================================
// backupDataSchema
// ============================================

describe('backupDataSchema', () => {
  it('accepts valid backup structure', () => {
    const valid = {
      version: '1.6.0',
      exportDate: '2024-01-15T12:00:00Z',
      data: {
        moods: [],
        habits: [],
        habitCompletions: [],
        gratitudeEntries: [],
        settings: [],
      },
    };
    expect(backupDataSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects arrays over 100000 items', () => {
    const invalid = {
      version: '1.6.0',
      exportDate: '2024-01-15T12:00:00Z',
      data: {
        moods: new Array(100001).fill({}),
        habits: [],
        habitCompletions: [],
        gratitudeEntries: [],
        settings: [],
      },
    };
    expect(backupDataSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects missing data fields', () => {
    const invalid = {
      version: '1.6.0',
      exportDate: '2024-01-15T12:00:00Z',
      data: {
        moods: [],
        // missing habits, habitCompletions, etc.
      },
    };
    expect(backupDataSchema.safeParse(invalid).success).toBe(false);
  });
});
