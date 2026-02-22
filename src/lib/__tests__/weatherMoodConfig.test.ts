import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

vi.mock('../utils', () => ({
  getToday: vi.fn(() => '2026-02-17'),
  formatDate: vi.fn((d: Date) => d.toISOString().split('T')[0]),
}));

// Pin Date.now() to match the mocked getToday — prevents drift as
// real calendar advances and test entries fall outside the 7-day window.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-02-17T12:00:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
});

import {
  WEATHER_MOOD_REGISTRY,
  deriveWeatherMood,
  getWeatherMoodConfig,
  WEATHER_MOOD_ORDER,
  MOOD_SCORE,
  deriveCurrentWeather,
} from '../weatherMoodConfig';
import type { WeatherMoodId } from '../weatherMoodConfig';
import type { MoodType, MoodEntry } from '@/types';

// ============================================
// WEATHER_MOOD_REGISTRY
// ============================================

describe('WEATHER_MOOD_REGISTRY', () => {
  const ALL_IDS: WeatherMoodId[] = [
    'calm', 'happy', 'focused', 'anxious', 'sad', 'angry',
    'tired', 'energized', 'neutral', 'radiant', 'melancholy', 'stormy',
  ];

  it('contains all 12 weather mood IDs', () => {
    const registryIds = Object.keys(WEATHER_MOOD_REGISTRY);
    expect(registryIds).toHaveLength(12);
    for (const id of ALL_IDS) {
      expect(WEATHER_MOOD_REGISTRY).toHaveProperty(id);
    }
  });

  it('each entry has palette with light and dark themes', () => {
    for (const id of ALL_IDS) {
      const config = WEATHER_MOOD_REGISTRY[id];
      expect(config.palette.light).toBeDefined();
      expect(config.palette.dark).toBeDefined();
      expect(config.palette.light.accent).toBeTruthy();
      expect(config.palette.dark.accent).toBeTruthy();
    }
  });

  it('each entry has weatherEffect layer', () => {
    for (const id of ALL_IDS) {
      const config = WEATHER_MOOD_REGISTRY[id];
      expect(config.layers.weatherEffect.type).toBeTruthy();
      expect(['light', 'medium', 'heavy']).toContain(config.layers.weatherEffect.intensity);
    }
  });

  it('each entry has particles layer', () => {
    for (const id of ALL_IDS) {
      const config = WEATHER_MOOD_REGISTRY[id];
      const p = config.layers.particles;
      expect(p).toBeDefined();
      expect(['dots', 'rain', 'sparkle', 'fog', 'none']).toContain(p.type);
      expect(typeof p.count).toBe('number');
    }
  });

  it('each entry has motion config with durations and easing', () => {
    for (const id of ALL_IDS) {
      const config = WEATHER_MOOD_REGISTRY[id];
      expect(typeof config.motion.bgDuration).toBe('number');
      expect(typeof config.motion.effectDuration).toBe('number');
      expect(typeof config.motion.particleDuration).toBe('number');
      expect(typeof config.motion.easing).toBe('string');
    }
  });
});

// ============================================
// getWeatherMoodConfig
// ============================================

describe('getWeatherMoodConfig', () => {
  it('returns the correct config for a known id', () => {
    const config = getWeatherMoodConfig('happy');
    expect(config.id).toBe('happy');
    expect(config.emoji).toBe('\u2600\uFE0F');
  });

  it('returns config for every valid id in the registry', () => {
    for (const id of WEATHER_MOOD_ORDER) {
      const config = getWeatherMoodConfig(id);
      expect(config).toBeDefined();
      expect(config.id).toBe(id);
    }
  });

  it('returns undefined for an unknown id', () => {
    const invalidId = 'nonexistent' as unknown as Parameters<typeof getWeatherMoodConfig>[0];
    const config = getWeatherMoodConfig(invalidId);
    expect(config).toBeUndefined();
  });
});

// ============================================
// deriveWeatherMood
// ============================================

describe('deriveWeatherMood', () => {
  it('maps great mood to happy weather', () => {
    expect(deriveWeatherMood('great')).toBe('happy');
  });

  it('maps good mood to calm weather', () => {
    expect(deriveWeatherMood('good')).toBe('calm');
  });

  it('maps okay mood to neutral weather', () => {
    expect(deriveWeatherMood('okay')).toBe('neutral');
  });

  it('maps bad mood to sad weather', () => {
    expect(deriveWeatherMood('bad')).toBe('sad');
  });

  it('maps terrible mood to stormy weather', () => {
    expect(deriveWeatherMood('terrible')).toBe('stormy');
  });

  it('uses emotion data when present — joy intense → radiant', () => {
    expect(deriveWeatherMood('great', { primary: 'joy', intensity: 'intense' })).toBe('radiant');
  });

  it('uses emotion data — joy moderate → happy', () => {
    expect(deriveWeatherMood('good', { primary: 'joy', intensity: 'moderate' })).toBe('happy');
  });

  it('uses emotion data — anger intense → stormy', () => {
    expect(deriveWeatherMood('bad', { primary: 'anger', intensity: 'intense' })).toBe('stormy');
  });

  it('uses emotion data — sadness intense → melancholy', () => {
    expect(deriveWeatherMood('bad', { primary: 'sadness', intensity: 'intense' })).toBe('melancholy');
  });

  it('uses emotion data — fear → anxious', () => {
    expect(deriveWeatherMood('bad', { primary: 'fear', intensity: 'moderate' })).toBe('anxious');
  });

  it('uses emotion data — trust → calm', () => {
    expect(deriveWeatherMood('good', { primary: 'trust', intensity: 'mild' })).toBe('calm');
  });
});

// ============================================
// deriveCurrentWeather
// ============================================

describe('deriveCurrentWeather', () => {
  it('returns neutral (okay) for empty moods', () => {
    const result = deriveCurrentWeather([]);
    expect(result.mood).toBe('okay');
    expect(result.emotion).toBeNull();
  });

  it('returns today latest entry when present', () => {
    const moods: MoodEntry[] = [
      { id: '1', mood: 'great', date: '2026-02-17', timestamp: 1000, tags: [] },
      { id: '2', mood: 'good', date: '2026-02-17', timestamp: 2000, tags: [] },
    ];
    const result = deriveCurrentWeather(moods);
    expect(result.mood).toBe('good'); // latest by timestamp
  });

  it('falls back to yesterday when no today entries', () => {
    const moods: MoodEntry[] = [
      { id: '1', mood: 'great', date: '2026-02-16', timestamp: 5000, tags: [] },
    ];
    const result = deriveCurrentWeather(moods);
    expect(result.mood).toBe('great');
  });

  it('falls back to weighted average for older entries', () => {
    // All entries within last 7 days but not today or yesterday
    const moods: MoodEntry[] = [
      { id: '1', mood: 'great', date: '2026-02-14', timestamp: 1000, tags: [] },
      { id: '2', mood: 'great', date: '2026-02-13', timestamp: 1000, tags: [] },
    ];
    const result = deriveCurrentWeather(moods);
    // Average score of 'great' (5) → should be 'great'
    expect(result.mood).toBe('great');
    expect(result.emotion).toBeNull();
  });
});

// ============================================
// MOOD_SCORE
// ============================================

describe('MOOD_SCORE', () => {
  it('maps all 5 MoodType values', () => {
    const moodTypes: MoodType[] = ['great', 'good', 'okay', 'bad', 'terrible'];
    for (const mood of moodTypes) {
      expect(typeof MOOD_SCORE[mood]).toBe('number');
    }
  });

  it('scores are in descending order great > good > okay > bad > terrible', () => {
    expect(MOOD_SCORE.great).toBeGreaterThan(MOOD_SCORE.good);
    expect(MOOD_SCORE.good).toBeGreaterThan(MOOD_SCORE.okay);
    expect(MOOD_SCORE.okay).toBeGreaterThan(MOOD_SCORE.bad);
    expect(MOOD_SCORE.bad).toBeGreaterThan(MOOD_SCORE.terrible);
  });
});

// ============================================
// WEATHER_MOOD_ORDER
// ============================================

describe('WEATHER_MOOD_ORDER', () => {
  it('is a non-empty array', () => {
    expect(WEATHER_MOOD_ORDER.length).toBeGreaterThan(0);
  });

  it('contains exactly 12 entries matching all registry IDs', () => {
    expect(WEATHER_MOOD_ORDER).toHaveLength(12);
    for (const id of WEATHER_MOOD_ORDER) {
      expect(WEATHER_MOOD_REGISTRY).toHaveProperty(id);
    }
  });
});
