import { describe, it, expect } from 'vitest';
import {
  parseTime,
  formatTime,
  isValidTimeFormat,
  localeMap,
  getLocale,
  formatLocalizedDate,
  formatLocalizedTime,
} from '@/lib/timeUtils';

// ─── parseTime ───────────────────────────────────────────────────

describe('parseTime', () => {
  it('parses "09:30" correctly', () => {
    expect(parseTime('09:30')).toEqual({ hour: 9, minute: 30 });
  });

  it('parses "00:00" correctly', () => {
    expect(parseTime('00:00')).toEqual({ hour: 0, minute: 0 });
  });

  it('parses "23:59" correctly', () => {
    expect(parseTime('23:59')).toEqual({ hour: 23, minute: 59 });
  });

  it('returns defaults for undefined', () => {
    expect(parseTime(undefined)).toEqual({ hour: 9, minute: 0 });
  });

  it('returns defaults for null', () => {
    expect(parseTime(null)).toEqual({ hour: 9, minute: 0 });
  });

  it('returns defaults for empty string', () => {
    expect(parseTime('')).toEqual({ hour: 9, minute: 0 });
  });

  it('returns defaults for non-string input', () => {
    // @ts-expect-error testing invalid input
    expect(parseTime(123)).toEqual({ hour: 9, minute: 0 });
  });

  it('clamps hour 25 to 23', () => {
    expect(parseTime('25:00')).toEqual({ hour: 23, minute: 0 });
  });

  it('clamps minute 60 to 59', () => {
    expect(parseTime('12:60')).toEqual({ hour: 12, minute: 59 });
  });

  it('parses hour-only string "14" as {14, 0}', () => {
    expect(parseTime('14')).toEqual({ hour: 14, minute: 0 });
  });

  it('returns defaults for NaN parts', () => {
    expect(parseTime('abc:def')).toEqual({ hour: 9, minute: 0 });
  });

  it('uses custom default hour and minute', () => {
    expect(parseTime(undefined, 12, 30)).toEqual({ hour: 12, minute: 30 });
  });

  it('uses custom defaults when hour part is NaN', () => {
    // 'abc' splits to ['abc'], hour is NaN -> defaultHour,
    // minute part absent -> 0 (parseInt branch, not NaN path)
    expect(parseTime('abc', 8, 15)).toEqual({ hour: 8, minute: 0 });
  });

  it('uses custom default minute when minute part is NaN', () => {
    expect(parseTime('abc:xyz', 8, 15)).toEqual({ hour: 8, minute: 15 });
  });
});

// ─── formatTime ──────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats 0, 0 to "00:00"', () => {
    expect(formatTime(0, 0)).toBe('00:00');
  });

  it('formats 9, 30 to "09:30"', () => {
    expect(formatTime(9, 30)).toBe('09:30');
  });

  it('formats 23, 59 to "23:59"', () => {
    expect(formatTime(23, 59)).toBe('23:59');
  });

  it('clamps hour 25 to "23:xx"', () => {
    expect(formatTime(25, 10)).toBe('23:10');
  });

  it('clamps minute 60 to "xx:59"', () => {
    expect(formatTime(10, 60)).toBe('10:59');
  });

  it('clamps negative hour to "00:00"', () => {
    expect(formatTime(-1, 0)).toBe('00:00');
  });

  it('clamps negative minute to "xx:00"', () => {
    expect(formatTime(5, -1)).toBe('05:00');
  });
});

// ─── isValidTimeFormat ───────────────────────────────────────────

describe('isValidTimeFormat', () => {
  it('returns true for "09:30"', () => {
    expect(isValidTimeFormat('09:30')).toBe(true);
  });

  it('returns true for "0:00" (single digit hour)', () => {
    expect(isValidTimeFormat('0:00')).toBe(true);
  });

  it('returns true for "23:59"', () => {
    expect(isValidTimeFormat('23:59')).toBe(true);
  });

  it('returns false for undefined', () => {
    expect(isValidTimeFormat(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidTimeFormat(null)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidTimeFormat('')).toBe(false);
  });

  it('returns false for "25:00" (hour out of range)', () => {
    expect(isValidTimeFormat('25:00')).toBe(false);
  });

  it('returns false for "12:60" (minute out of range)', () => {
    expect(isValidTimeFormat('12:60')).toBe(false);
  });

  it('returns false for "12:5" (single digit minute)', () => {
    expect(isValidTimeFormat('12:5')).toBe(false);
  });

  it('returns false for "abc"', () => {
    expect(isValidTimeFormat('abc')).toBe(false);
  });
});

// ─── localeMap ───────────────────────────────────────────────────

describe('localeMap', () => {
  it('has all 8 language entries', () => {
    const languages = ['en', 'uk', 'es', 'de', 'fr', 'ja', 'ar', 'he'] as const;
    for (const lang of languages) {
      expect(localeMap[lang]).toBeDefined();
      expect(typeof localeMap[lang]).toBe('string');
    }
  });

  it('maps en to en-US', () => {
    expect(localeMap.en).toBe('en-US');
  });

  it('maps uk to uk-UA', () => {
    expect(localeMap.uk).toBe('uk-UA');
  });

  it('maps ja to ja-JP', () => {
    expect(localeMap.ja).toBe('ja-JP');
  });
});

// ─── getLocale ───────────────────────────────────────────────────

describe('getLocale', () => {
  it('returns en-US for "en"', () => {
    expect(getLocale('en')).toBe('en-US');
  });

  it('returns uk-UA for "uk"', () => {
    expect(getLocale('uk')).toBe('uk-UA');
  });

  it('returns es-ES for "es"', () => {
    expect(getLocale('es')).toBe('es-ES');
  });

  it('returns de-DE for "de"', () => {
    expect(getLocale('de')).toBe('de-DE');
  });

  it('returns fr-FR for "fr"', () => {
    expect(getLocale('fr')).toBe('fr-FR');
  });

  it('returns ja-JP for "ja"', () => {
    expect(getLocale('ja')).toBe('ja-JP');
  });

  it('returns ar-SA for "ar"', () => {
    expect(getLocale('ar')).toBe('ar-SA');
  });

  it('returns he-IL for "he"', () => {
    expect(getLocale('he')).toBe('he-IL');
  });

  it('returns en-US for unknown language', () => {
    // @ts-expect-error testing unknown language fallback
    expect(getLocale('xx')).toBe('en-US');
  });
});

// ─── formatLocalizedDate ─────────────────────────────────────────

describe('formatLocalizedDate', () => {
  const date = new Date(2025, 0, 15); // January 15, 2025

  it('returns a non-empty string for English', () => {
    const result = formatLocalizedDate(date, 'en');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for Japanese', () => {
    const result = formatLocalizedDate(date, 'ja');
    expect(result.length).toBeGreaterThan(0);
  });

  it('accepts formatting options', () => {
    const result = formatLocalizedDate(date, 'en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(result).toContain('2025');
  });
});

// ─── formatLocalizedTime ─────────────────────────────────────────

describe('formatLocalizedTime', () => {
  const date = new Date(2025, 0, 15, 14, 30, 0); // 2:30 PM

  it('returns a non-empty string for English', () => {
    const result = formatLocalizedTime(date, 'en');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for Arabic', () => {
    const result = formatLocalizedTime(date, 'ar');
    expect(result.length).toBeGreaterThan(0);
  });

  it('accepts formatting options', () => {
    const result = formatLocalizedTime(date, 'en', {
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(result.length).toBeGreaterThan(0);
  });
});
