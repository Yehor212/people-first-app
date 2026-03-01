import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  validateArray,
  validateObject,
  runtimeMoodEntrySchema,
  runtimeHabitSchema,
  runtimeFocusSessionSchema,
  runtimeGratitudeEntrySchema,
  innerWorldSchema,
  gamificationStateSchema,
} from '../schemas';
import { logger } from '@/lib/logger';

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// HELPER: validateArray
// ============================================

describe('validateArray', () => {
  it('passes all valid items through', () => {
    const items = [
      { id: 'g1', text: 'Sunshine', date: '2026-02-16', timestamp: 1000 },
      { id: 'g2', text: 'Coffee', date: '2026-02-15', timestamp: 2000 },
    ];
    const result = validateArray(runtimeGratitudeEntrySchema, items, 'gratitude');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('g1');
    expect(result[1].id).toBe('g2');
  });

  it('filters out invalid items', () => {
    const items = [
      { id: '', text: 'Bad id', date: '2026-01-01', timestamp: 1 },
      { id: 'g1', text: '', date: '2026-01-01', timestamp: 2 },
    ];
    const result = validateArray(runtimeGratitudeEntrySchema, items, 'gratitude');
    expect(result).toHaveLength(0);
  });

  it('keeps only valid items in a mixed array', () => {
    const items = [
      { id: 'g1', text: 'Valid', date: '2026-02-16', timestamp: 100 },
      { id: '', text: 'Invalid', date: '2026-02-16', timestamp: 200 },
      { id: 'g3', text: 'Also valid', date: '2026-02-14', timestamp: 300 },
    ];
    const result = validateArray(runtimeGratitudeEntrySchema, items, 'gratitude');
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['g1', 'g3']);
  });

  it('returns empty array for empty input', () => {
    const result = validateArray(runtimeGratitudeEntrySchema, [], 'gratitude');
    expect(result).toEqual([]);
  });

  it('calls logger.warn for dropped items', () => {
    const items = [{ id: '', text: 'Bad', date: '2026-01-01', timestamp: 1 }];
    validateArray(runtimeGratitudeEntrySchema, items, 'gratitude');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid gratitude item dropped'),
      expect.anything()
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Dropped 1/1 invalid gratitude items')
    );
  });
});

// ============================================
// HELPER: validateObject
// ============================================

describe('validateObject', () => {
  it('returns validated object for valid data', () => {
    const data = { id: 'g1', text: 'Sun', date: '2026-02-16', timestamp: 100 };
    const result = validateObject(runtimeGratitudeEntrySchema, data, 'gratitude');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('id', 'g1');
  });

  it('returns null for invalid data', () => {
    const result = validateObject(runtimeGratitudeEntrySchema, { id: '' }, 'gratitude');
    expect(result).toBeNull();
  });

  it('preserves unknown keys via .passthrough()', () => {
    const data = {
      id: 'g1',
      text: 'Sun',
      date: '2026-02-16',
      timestamp: 100,
      futureField: 'from-v2',
    };
    const result = validateObject(runtimeGratitudeEntrySchema, data, 'gratitude');
    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).futureField).toBe('from-v2');
  });

  it('calls logger.warn for failures', () => {
    validateObject(runtimeGratitudeEntrySchema, { id: '' }, 'gratitude');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid gratitude'),
      expect.anything()
    );
  });
});

// ============================================
// runtimeMoodEntrySchema
// ============================================

describe('runtimeMoodEntrySchema', () => {
  const validMood = {
    id: 'm1',
    mood: 'great' as const,
    date: '2026-02-16',
    timestamp: Date.now(),
    note: 'Feeling great today',
    tags: ['exercise', 'sleep'],
    emotion: { primary: 'joy' as const, intensity: 'moderate' as const },
  };

  it('accepts a valid mood entry', () => {
    const result = runtimeMoodEntrySchema.safeParse(validMood);
    expect(result.success).toBe(true);
  });

  it('rejects invalid mood enum value', () => {
    const result = runtimeMoodEntrySchema.safeParse({ ...validMood, mood: 'amazing' });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    const { id: _id, ...noId } = validMood;
    const result = runtimeMoodEntrySchema.safeParse(noId);
    expect(result.success).toBe(false);
  });

  it('accepts entry without optional tags and emotion', () => {
    const { tags: _t, emotion: _e, note: _n, ...minimal } = validMood;
    const result = runtimeMoodEntrySchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});

// ============================================
// runtimeHabitSchema
// ============================================

describe('runtimeHabitSchema', () => {
  const validHabit = {
    id: 'h1',
    name: 'Meditate',
    icon: '🧘',
    color: 8,
    createdAt: Date.now(),
    habitType: 'boolean' as const,
    reminders: [{ enabled: true, time: '09:00', days: [1, 2, 3, 4, 5] }],
    frequency: { numerator: 1, denominator: 1 },
    entries: {
      '2026-02-15': { value: 2 },
      '2026-02-16': { value: 2 },
    },
  };

  it('accepts a valid habit', () => {
    const result = runtimeHabitSchema.safeParse(validHabit);
    expect(result.success).toBe(true);
  });

  it('applies defaults for old habits without habitType/frequency/reminders', () => {
    const { habitType: _t, frequency: _f, reminders: _r, ...oldHabit } = validHabit;
    const result = runtimeHabitSchema.safeParse(oldHabit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.habitType).toBe('boolean');
      expect(result.data.frequency).toEqual({ numerator: 1, denominator: 1 });
      expect(result.data.reminders).toEqual([]);
    }
  });

  it('rejects missing required fields (no id)', () => {
    const { id: _id, ...noId } = validHabit;
    const result = runtimeHabitSchema.safeParse(noId);
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields (no name)', () => {
    const result = runtimeHabitSchema.safeParse({ ...validHabit, name: '' });
    expect(result.success).toBe(false);
  });
});

// ============================================
// runtimeFocusSessionSchema
// ============================================

describe('runtimeFocusSessionSchema', () => {
  const validSession = {
    id: 'f1',
    duration: 25,
    completedAt: Date.now(),
    date: '2026-02-16',
    label: 'Deep Work',
    status: 'completed' as const,
  };

  it('accepts a valid focus session', () => {
    const result = runtimeFocusSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it('rejects negative duration', () => {
    const result = runtimeFocusSessionSchema.safeParse({ ...validSession, duration: -5 });
    expect(result.success).toBe(false);
  });
});

// ============================================
// runtimeGratitudeEntrySchema
// ============================================

describe('runtimeGratitudeEntrySchema', () => {
  it('accepts a valid gratitude entry', () => {
    const result = runtimeGratitudeEntrySchema.safeParse({
      id: 'g1',
      text: 'Grateful for sunshine',
      date: '2026-02-16',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty text', () => {
    const result = runtimeGratitudeEntrySchema.safeParse({
      id: 'g1',
      text: '',
      date: '2026-02-16',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// innerWorldSchema
// ============================================

describe('innerWorldSchema', () => {
  const validWorld = {
    treats: {
      balance: 150,
      lifetimeEarned: 500,
      lifetimeSpent: 350,
      transactions: [],
    },
    gardenStage: 'flourishing',
    plants: [],
    creatures: [],
    weather: 'sunny',
    season: 'spring',
    companion: {
      type: 'fox',
      name: 'Pixel',
      mood: 'happy',
      level: 12,
      experience: 2400,
      fullness: 80,
      happiness: 90,
      hunger: 20,
    },
    totalPlantsGrown: 15,
    totalCreaturesAttracted: 4,
    daysActive: 60,
    longestActiveStreak: 21,
    currentActiveStreak: 7,
    lastActiveDate: '2026-02-16',
  };

  it('accepts a valid inner world', () => {
    const result = innerWorldSchema.safeParse(validWorld);
    expect(result.success).toBe(true);
  });

  it('rejects when companion is missing', () => {
    const { companion: _c, ...noCompanion } = validWorld;
    const result = innerWorldSchema.safeParse(noCompanion);
    expect(result.success).toBe(false);
  });
});

// ============================================
// gamificationStateSchema
// ============================================

describe('gamificationStateSchema', () => {
  const validState = {
    totalXp: 4200,
    unlockedAchievements: ['first_mood', 'streak_7', 'focus_master'],
    achievementProgress: { streak_30: 21, focus_500: 340 },
  };

  it('accepts a valid gamification state', () => {
    const result = gamificationStateSchema.safeParse(validState);
    expect(result.success).toBe(true);
  });

  it('rejects when totalXp is missing', () => {
    const { totalXp: _xp, ...noXp } = validState;
    const result = gamificationStateSchema.safeParse(noXp);
    expect(result.success).toBe(false);
  });
});
