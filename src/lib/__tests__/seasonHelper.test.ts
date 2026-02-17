import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCurrentSeason,
  getSeasonEmoji,
  getSeasonName,
  getSeasonColors,
  Season,
} from '../seasonHelper';

// ============================================
// getCurrentSeason (requires fake timers)
// ============================================
describe('getCurrentSeason', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "spring" in March', () => {
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
    expect(getCurrentSeason()).toBe('spring');
  });

  it('returns "spring" in April', () => {
    vi.setSystemTime(new Date('2026-04-01T12:00:00Z'));
    expect(getCurrentSeason()).toBe('spring');
  });

  it('returns "spring" in May', () => {
    vi.setSystemTime(new Date('2026-05-31T12:00:00Z'));
    expect(getCurrentSeason()).toBe('spring');
  });

  it('returns "summer" in June', () => {
    vi.setSystemTime(new Date('2026-06-21T12:00:00Z'));
    expect(getCurrentSeason()).toBe('summer');
  });

  it('returns "summer" in August', () => {
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(getCurrentSeason()).toBe('summer');
  });

  it('returns "autumn" in September', () => {
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
    expect(getCurrentSeason()).toBe('autumn');
  });

  it('returns "autumn" in November', () => {
    vi.setSystemTime(new Date('2026-11-25T12:00:00Z'));
    expect(getCurrentSeason()).toBe('autumn');
  });

  it('returns "winter" in December', () => {
    vi.setSystemTime(new Date('2026-12-25T12:00:00Z'));
    expect(getCurrentSeason()).toBe('winter');
  });

  it('returns "winter" in January', () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    expect(getCurrentSeason()).toBe('winter');
  });

  it('returns "winter" in February', () => {
    vi.setSystemTime(new Date('2026-02-17T12:00:00Z'));
    expect(getCurrentSeason()).toBe('winter');
  });
});

// ============================================
// getSeasonEmoji
// ============================================
describe('getSeasonEmoji', () => {
  it('returns cherry blossom for spring', () => {
    expect(getSeasonEmoji('spring')).toBe('\u{1F338}'); // 🌸
  });

  it('returns sun for summer', () => {
    expect(getSeasonEmoji('summer')).toBe('\u2600\uFE0F'); // ☀️
  });

  it('returns fallen leaf for autumn', () => {
    expect(getSeasonEmoji('autumn')).toBe('\u{1F342}'); // 🍂
  });

  it('returns snowflake for winter', () => {
    expect(getSeasonEmoji('winter')).toBe('\u2744\uFE0F'); // ❄️
  });
});

// ============================================
// getSeasonName
// ============================================
describe('getSeasonName', () => {
  it('returns English name by default', () => {
    expect(getSeasonName('spring', 'en')).toBe('Spring');
    expect(getSeasonName('summer', 'en')).toBe('Summer');
    expect(getSeasonName('autumn', 'en')).toBe('Autumn');
    expect(getSeasonName('winter', 'en')).toBe('Winter');
  });

  it('returns Ukrainian name for "uk" language', () => {
    expect(getSeasonName('spring', 'uk')).toBe('Весна');
    expect(getSeasonName('winter', 'uk')).toBe('Зима');
  });

  it('returns Japanese name for "ja" language', () => {
    expect(getSeasonName('summer', 'ja')).toBe('夏');
  });

  it('falls back to English for unknown language', () => {
    expect(getSeasonName('autumn', 'zz')).toBe('Autumn');
  });
});

// ============================================
// getSeasonColors
// ============================================
describe('getSeasonColors', () => {
  it('returns an object with all required color properties', () => {
    const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
    for (const season of seasons) {
      const colors = getSeasonColors(season);
      expect(colors).toHaveProperty('primary');
      expect(colors).toHaveProperty('secondary');
      expect(colors).toHaveProperty('accent');
      expect(colors).toHaveProperty('background');
      expect(colors).toHaveProperty('backgroundEnd');
      expect(colors).toHaveProperty('particle');
    }
  });

  it('returns distinct palettes for each season', () => {
    const spring = getSeasonColors('spring');
    const summer = getSeasonColors('summer');
    const autumn = getSeasonColors('autumn');
    const winter = getSeasonColors('winter');

    // Primary colors should all be different
    const primaries = [spring.primary, summer.primary, autumn.primary, winter.primary];
    const uniquePrimaries = new Set(primaries);
    expect(uniquePrimaries.size).toBe(4);
  });

  it('returns hex color strings for spring', () => {
    const colors = getSeasonColors('spring');
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    expect(colors.primary).toMatch(hexPattern);
    expect(colors.secondary).toMatch(hexPattern);
    expect(colors.accent).toMatch(hexPattern);
    expect(colors.background).toMatch(hexPattern);
    expect(colors.backgroundEnd).toMatch(hexPattern);
    expect(colors.particle).toMatch(hexPattern);
  });

  it('returns specific known colors for winter', () => {
    const colors = getSeasonColors('winter');
    expect(colors.primary).toBe('#E8E8E8');
    expect(colors.accent).toBe('#FFFFFF');
  });
});
