import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  interpolate,
  formatDate,
  getToday,
  parseLocalDate,
  generateId,
  formatTime,
  getDaysInMonth,
  calculateStreak,
} from '@/lib/utils';

// ─── cn ─────────────────────────────────────────────────────────

describe('cn', () => {
  it('merges simple class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('filters out falsy values', () => {
    expect(cn('base', false, undefined, null, 'end')).toBe('base end');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles array of classes', () => {
    expect(cn(['px-2', 'py-1'])).toBe('px-2 py-1');
  });
});

// ─── interpolate ────────────────────────────────────────────────

describe('interpolate', () => {
  it('replaces a single placeholder', () => {
    expect(interpolate('Hello {name}!', { name: 'World' })).toBe('Hello World!');
  });

  it('replaces multiple placeholders', () => {
    expect(interpolate('{greeting} {name}!', { greeting: 'Hi', name: 'Alice' })).toBe('Hi Alice!');
  });

  it('keeps placeholder when key is missing', () => {
    expect(interpolate('Hello {name}!', {})).toBe('Hello {name}!');
  });

  it('handles numeric values', () => {
    expect(interpolate('Count: {count}', { count: 42 })).toBe('Count: 42');
  });

  it('returns empty string for empty template', () => {
    expect(interpolate('', { key: 'value' })).toBe('');
  });

  it('handles template with no placeholders', () => {
    expect(interpolate('No placeholders here', { key: 'value' })).toBe('No placeholders here');
  });

  it('replaces duplicate placeholders', () => {
    expect(interpolate('{x} and {x}', { x: 'A' })).toBe('A and A');
  });

  it('handles zero as a numeric value', () => {
    expect(interpolate('Value: {n}', { n: 0 })).toBe('Value: 0');
  });
});

// ─── formatDate ─────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a normal date', () => {
    expect(formatDate(new Date(2026, 1, 17))).toBe('2026-02-17');
  });

  it('pads single-digit month', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('pads single-digit day', () => {
    expect(formatDate(new Date(2026, 11, 3))).toBe('2026-12-03');
  });

  it('handles year boundary (Dec 31)', () => {
    expect(formatDate(new Date(2025, 11, 31))).toBe('2025-12-31');
  });

  it('handles year boundary (Jan 1)', () => {
    expect(formatDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

// ─── getToday ───────────────────────────────────────────────────

describe('getToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-17T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today in YYYY-MM-DD format', () => {
    expect(getToday()).toBe('2026-02-17');
  });

  it('returns correct date after advancing time', () => {
    vi.setSystemTime(new Date('2026-12-31T23:59:59'));
    expect(getToday()).toBe('2026-12-31');
  });

  it('matches formatDate(new Date())', () => {
    expect(getToday()).toBe(formatDate(new Date()));
  });
});

// ─── parseLocalDate ─────────────────────────────────────────────

describe('parseLocalDate', () => {
  it('parses a valid date string', () => {
    const date = parseLocalDate('2026-02-17');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1); // 0-indexed
    expect(date.getDate()).toBe(17);
  });

  it('handles month 0-indexing correctly (January)', () => {
    const date = parseLocalDate('2026-01-15');
    expect(date.getMonth()).toBe(0);
  });

  it('handles month 0-indexing correctly (December)', () => {
    const date = parseLocalDate('2026-12-25');
    expect(date.getMonth()).toBe(11);
  });

  it('creates a local date (hour is 0, no UTC shift)', () => {
    const date = parseLocalDate('2026-06-15');
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
  });

  it('roundtrips with formatDate', () => {
    const original = '2026-07-04';
    expect(formatDate(parseLocalDate(original))).toBe(original);
  });

  it('handles year boundary dates', () => {
    const dec31 = parseLocalDate('2025-12-31');
    expect(dec31.getFullYear()).toBe(2025);
    expect(dec31.getMonth()).toBe(11);
    expect(dec31.getDate()).toBe(31);

    const jan1 = parseLocalDate('2026-01-01');
    expect(jan1.getFullYear()).toBe(2026);
    expect(jan1.getMonth()).toBe(0);
    expect(jan1.getDate()).toBe(1);
  });
});

// ─── generateId ─────────────────────────────────────────────────

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('returns a string of length 21 (nanoid default)', () => {
    expect(generateId()).toHaveLength(21);
  });

  it('generates unique IDs on consecutive calls', () => {
    const id1 = generateId();
    const id2 = generateId();
    const id3 = generateId();
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });
});

// ─── formatTime ─────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('formats 90 seconds as 01:30', () => {
    expect(formatTime(90)).toBe('01:30');
  });

  it('formats 3600 seconds as 60:00', () => {
    expect(formatTime(3600)).toBe('60:00');
  });

  it('formats 5 seconds as 00:05', () => {
    expect(formatTime(5)).toBe('00:05');
  });

  it('formats 59 seconds as 00:59', () => {
    expect(formatTime(59)).toBe('00:59');
  });

  it('formats 60 seconds as 01:00', () => {
    expect(formatTime(60)).toBe('01:00');
  });

  it('formats 61 seconds as 01:01', () => {
    expect(formatTime(61)).toBe('01:01');
  });
});

// ─── getDaysInMonth ─────────────────────────────────────────────

describe('getDaysInMonth', () => {
  it('returns 31 for January (month 0)', () => {
    expect(getDaysInMonth(2026, 0)).toBe(31);
  });

  it('returns 30 for April (month 3)', () => {
    expect(getDaysInMonth(2026, 3)).toBe(30);
  });

  it('returns 29 for February in leap year 2024 (month 1)', () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
  });

  it('returns 28 for February in non-leap year 2025 (month 1)', () => {
    expect(getDaysInMonth(2025, 1)).toBe(28);
  });

  it('returns 31 for December (month 11)', () => {
    expect(getDaysInMonth(2026, 11)).toBe(31);
  });

  it('returns 30 for September (month 8)', () => {
    expect(getDaysInMonth(2026, 8)).toBe(30);
  });
});

// ─── calculateStreak ────────────────────────────────────────────

describe('calculateStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-17T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 for empty array', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('returns 1 for today only', () => {
    expect(calculateStreak(['2026-02-17'])).toBe(1);
  });

  it('returns 2 for today and yesterday', () => {
    expect(calculateStreak(['2026-02-17', '2026-02-16'])).toBe(2);
  });

  it('returns correct streak for consecutive days ending today', () => {
    expect(calculateStreak(['2026-02-17', '2026-02-16', '2026-02-15', '2026-02-14'])).toBe(4);
  });

  it('breaks streak on gap', () => {
    expect(calculateStreak(['2026-02-17', '2026-02-16', '2026-02-14'])).toBe(2);
  });

  it('returns 1 when streak starts at yesterday', () => {
    expect(calculateStreak(['2026-02-16'])).toBe(1);
  });

  it('returns streak starting from yesterday', () => {
    expect(calculateStreak(['2026-02-16', '2026-02-15', '2026-02-14'])).toBe(3);
  });

  it('returns 0 for old dates not connected to today/yesterday', () => {
    expect(calculateStreak(['2026-02-10', '2026-02-09'])).toBe(0);
  });

  it('handles unsorted input correctly', () => {
    expect(calculateStreak(['2026-02-15', '2026-02-17', '2026-02-16'])).toBe(3);
  });

  it('handles duplicate dates (diff=0 breaks streak)', () => {
    // Duplicate dates produce diffDays=0, which breaks the streak loop
    expect(calculateStreak(['2026-02-17', '2026-02-17', '2026-02-16'])).toBe(1);
  });
});
