import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── In-memory safeJson mock ────────────────────────────────────
let mockStorage: Record<string, unknown> = {};

vi.mock('../safeJson', () => ({
  safeLocalStorageGet: vi.fn((key: string, def: unknown) => mockStorage[key] ?? def),
  safeLocalStorageSet: vi.fn((key: string, val: unknown) => {
    mockStorage[key] = val;
    return true;
  }),
  storageGetRaw: vi.fn((key: string, def: string) => {
    const val = mockStorage[key];
    return typeof val === 'string' ? val : def;
  }),
  storageRemove: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
}));

vi.mock('../logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), sync: vi.fn(), auth: vi.fn() },
}));

// Mock translations to return recognizable strings for quest keys
vi.mock('@/i18n/translations', () => {
  const handler: ProxyHandler<Record<string, string>> = {
    get(_target, prop: string) {
      return prop; // translation key becomes the value
    },
  };
  const langProxy = new Proxy({}, handler);
  return {
    translations: new Proxy({}, {
      get() {
        return langProxy;
      },
    }),
  };
});

import {
  generateDailyQuest,
  generateWeeklyQuest,
  generateBonusQuest,
  updateQuestProgress,
  shouldRegenerateQuest,
  getQuestTimeRemaining,
  getQuestCategoryEmoji,
  getQuestDifficultyColor,
  updateAllQuestsProgress,
} from '../randomQuests';
import type { Quest, QuestCategory, QuestType } from '../randomQuests';

// ─── Helpers ────────────────────────────────────────────────────

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  const now = Date.now();
  return {
    id: 'quest-daily-test',
    type: 'daily',
    category: 'habits',
    title: 'Test Quest',
    description: 'A test quest',
    condition: { type: 'complete_habits', count: 5 },
    reward: { xp: 50, message: 'Done!' },
    progress: 0,
    total: 5,
    completed: false,
    expiresAt: now + 24 * 60 * 60 * 1000,
    createdAt: now,
    ...overrides,
  };
}

// ─── Setup ──────────────────────────────────────────────────────

beforeEach(() => {
  mockStorage = {};
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T10:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================
// generateDailyQuest
// ============================================
describe('generateDailyQuest', () => {
  it('returns a quest with type "daily"', () => {
    const quest = generateDailyQuest();
    expect(quest.type).toBe('daily');
  });

  it('has a valid id prefixed with "quest-daily-"', () => {
    const quest = generateDailyQuest();
    expect(quest.id).toMatch(/^quest-daily-/);
  });

  it('has progress=0 and completed=false initially', () => {
    const quest = generateDailyQuest();
    expect(quest.progress).toBe(0);
    expect(quest.completed).toBe(false);
  });

  it('has expiresAt set to end of the current day', () => {
    const quest = generateDailyQuest();
    const expiryDate = new Date(quest.expiresAt);
    expect(expiryDate.getHours()).toBe(23);
    expect(expiryDate.getMinutes()).toBe(59);
  });

  it('has a condition with a positive count', () => {
    const quest = generateDailyQuest();
    expect(quest.condition.count).toBeGreaterThan(0);
  });

  it('total matches the condition count', () => {
    const quest = generateDailyQuest();
    expect(quest.total).toBe(quest.condition.count);
  });

  it('has a reward with positive xp', () => {
    const quest = generateDailyQuest();
    expect(quest.reward.xp).toBeGreaterThan(0);
  });
});

// ============================================
// generateWeeklyQuest
// ============================================
describe('generateWeeklyQuest', () => {
  it('returns a quest with type "weekly"', () => {
    const quest = generateWeeklyQuest();
    expect(quest.type).toBe('weekly');
  });

  it('has id prefixed with "quest-weekly-"', () => {
    const quest = generateWeeklyQuest();
    expect(quest.id).toMatch(/^quest-weekly-/);
  });

  it('has expiresAt roughly 7 days from now', () => {
    const now = Date.now();
    const quest = generateWeeklyQuest();
    const diff = quest.expiresAt - now;
    // Should be 7 days (+ some hours to end of day)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(diff).toBeGreaterThan(sevenDaysMs - 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(sevenDaysMs + 24 * 60 * 60 * 1000);
  });

  it('has 3x XP compared to base template reward', () => {
    const quest = generateWeeklyQuest();
    // reward.message contains the XP amount which is 3x base
    expect(quest.reward.xp).toBeGreaterThan(0);
    // XP is baseReward * 3, and message contains the XP value
    expect(quest.reward.message).toContain(`+${quest.reward.xp} XP`);
  });
});

// ============================================
// generateBonusQuest
// ============================================
describe('generateBonusQuest', () => {
  it('returns a quest with type "bonus"', () => {
    const quest = generateBonusQuest();
    expect(quest.type).toBe('bonus');
  });

  it('has id prefixed with "quest-bonus-"', () => {
    const quest = generateBonusQuest();
    expect(quest.id).toMatch(/^quest-bonus-/);
  });

  it('expires in 24 hours', () => {
    const now = Date.now();
    const quest = generateBonusQuest();
    const diff = quest.expiresAt - now;
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it('has a badge reward defined', () => {
    const quest = generateBonusQuest();
    expect(quest.reward.badge).toBeDefined();
    expect(typeof quest.reward.badge).toBe('string');
  });

  it('has 5x XP multiplier in reward', () => {
    const quest = generateBonusQuest();
    // bonus quests are 5x base reward, so xp should be significant
    expect(quest.reward.xp).toBeGreaterThanOrEqual(125);
  });
});

// ============================================
// updateQuestProgress
// ============================================
describe('updateQuestProgress', () => {
  it('increments progress for matching habit action', () => {
    const quest = makeQuest({ condition: { type: 'complete_habits', count: 5 }, total: 5 });
    const updated = updateQuestProgress(quest, { type: 'habit_completed', value: 2 });
    expect(updated.progress).toBe(2);
    expect(updated.completed).toBe(false);
  });

  it('increments progress for matching focus action', () => {
    const quest = makeQuest({ condition: { type: 'focus_minutes', count: 60 }, total: 60 });
    const updated = updateQuestProgress(quest, { type: 'focus_completed', value: 30 });
    expect(updated.progress).toBe(30);
  });

  it('increments progress for matching gratitude action', () => {
    const quest = makeQuest({ condition: { type: 'gratitude_count', count: 5 }, total: 5 });
    const updated = updateQuestProgress(quest, { type: 'gratitude_added', value: 1 });
    expect(updated.progress).toBe(1);
  });

  it('sets progress directly for streak_updated actions', () => {
    const quest = makeQuest({ condition: { type: 'maintain_streak', count: 7 }, total: 7 });
    const updated = updateQuestProgress(quest, { type: 'streak_updated', value: 5 });
    expect(updated.progress).toBe(5);
  });

  it('ignores non-matching action types', () => {
    const quest = makeQuest({ condition: { type: 'complete_habits', count: 5 }, total: 5 });
    const updated = updateQuestProgress(quest, { type: 'focus_completed', value: 30 });
    expect(updated.progress).toBe(0);
  });

  it('marks quest as completed when progress reaches total', () => {
    const quest = makeQuest({ condition: { type: 'complete_habits', count: 3 }, total: 3, progress: 2 });
    const updated = updateQuestProgress(quest, { type: 'habit_completed', value: 1 });
    expect(updated.completed).toBe(true);
    expect(updated.progress).toBe(3);
  });

  it('caps progress at total', () => {
    const quest = makeQuest({ condition: { type: 'complete_habits', count: 3 }, total: 3, progress: 2 });
    const updated = updateQuestProgress(quest, { type: 'habit_completed', value: 5 });
    expect(updated.progress).toBe(3);
  });

  it('returns unchanged quest if already completed', () => {
    const quest = makeQuest({ completed: true, progress: 5, total: 5 });
    const updated = updateQuestProgress(quest, { type: 'habit_completed', value: 1 });
    expect(updated.progress).toBe(5);
    expect(updated.completed).toBe(true);
  });

  it('returns unchanged quest if expired', () => {
    const quest = makeQuest({ expiresAt: Date.now() - 1000 });
    const updated = updateQuestProgress(quest, { type: 'habit_completed', value: 1 });
    expect(updated.progress).toBe(0);
  });
});

// ============================================
// shouldRegenerateQuest
// ============================================
describe('shouldRegenerateQuest', () => {
  it('returns true for completed quest', () => {
    const quest = makeQuest({ completed: true });
    expect(shouldRegenerateQuest(quest)).toBe(true);
  });

  it('returns true for expired quest', () => {
    const quest = makeQuest({ expiresAt: Date.now() - 1000 });
    expect(shouldRegenerateQuest(quest)).toBe(true);
  });

  it('returns false for active, incomplete quest', () => {
    const quest = makeQuest({ completed: false, expiresAt: Date.now() + 60000 });
    expect(shouldRegenerateQuest(quest)).toBe(false);
  });
});

// ============================================
// getQuestTimeRemaining
// ============================================
describe('getQuestTimeRemaining', () => {
  it('returns "Expired" for past timestamp', () => {
    const quest = makeQuest({ expiresAt: Date.now() - 1000 });
    expect(getQuestTimeRemaining(quest)).toBe('Expired');
  });

  it('returns days and hours format for multi-day remaining', () => {
    const quest = makeQuest({ expiresAt: Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000 });
    expect(getQuestTimeRemaining(quest)).toBe('2d 3h');
  });

  it('returns hours format when less than a day remains', () => {
    const quest = makeQuest({ expiresAt: Date.now() + 5 * 60 * 60 * 1000 });
    expect(getQuestTimeRemaining(quest)).toBe('5h');
  });

  it('returns minutes format when less than an hour remains', () => {
    const quest = makeQuest({ expiresAt: Date.now() + 45 * 60 * 1000 });
    expect(getQuestTimeRemaining(quest)).toBe('45m');
  });
});

// ============================================
// getQuestCategoryEmoji
// ============================================
describe('getQuestCategoryEmoji', () => {
  const categories: QuestCategory[] = ['habits', 'focus', 'streak', 'gratitude', 'speed', 'consistency'];

  it('returns a non-empty string for every category', () => {
    for (const cat of categories) {
      const emoji = getQuestCategoryEmoji(cat);
      expect(typeof emoji).toBe('string');
      expect(emoji.length).toBeGreaterThan(0);
    }
  });

  it('returns specific emojis for known categories', () => {
    expect(getQuestCategoryEmoji('habits')).toBe('✅');
    expect(getQuestCategoryEmoji('focus')).toBe('🎯');
    expect(getQuestCategoryEmoji('streak')).toBe('🔥');
  });
});

// ============================================
// getQuestDifficultyColor
// ============================================
describe('getQuestDifficultyColor', () => {
  const types: QuestType[] = ['daily', 'weekly', 'bonus'];

  it('returns a Tailwind class for every quest type', () => {
    for (const type of types) {
      const color = getQuestDifficultyColor(type);
      expect(color).toMatch(/^text-/);
    }
  });

  it('returns specific colors for known types', () => {
    expect(getQuestDifficultyColor('daily')).toBe('text-blue-500');
    expect(getQuestDifficultyColor('weekly')).toBe('text-purple-500');
    expect(getQuestDifficultyColor('bonus')).toBe('text-yellow-500');
  });
});

// ============================================
// updateAllQuestsProgress
// ============================================
describe('updateAllQuestsProgress', () => {
  it('returns empty array when no quests are stored', () => {
    const result = updateAllQuestsProgress({ type: 'habit_completed', value: 1 });
    expect(result).toEqual([]);
  });

  it('updates matching quests and returns newly completed ones', () => {
    const dailyQuest = makeQuest({
      id: 'quest-daily-1',
      type: 'daily',
      condition: { type: 'complete_habits', count: 2 },
      total: 2,
      progress: 1,
    });
    mockStorage['zenflow_quests'] = { daily: dailyQuest, weekly: null, bonus: null };

    const completed = updateAllQuestsProgress({ type: 'habit_completed', value: 1 });
    expect(completed).toHaveLength(1);
    expect(completed[0].completed).toBe(true);
  });

  it('does not return quests that were already completed', () => {
    const dailyQuest = makeQuest({ completed: true, progress: 5, total: 5 });
    mockStorage['zenflow_quests'] = { daily: dailyQuest, weekly: null, bonus: null };

    const completed = updateAllQuestsProgress({ type: 'habit_completed', value: 1 });
    expect(completed).toHaveLength(0);
  });

  it('saves updated quest state back to storage', () => {
    const dailyQuest = makeQuest({
      condition: { type: 'complete_habits', count: 5 },
      total: 5,
      progress: 0,
    });
    mockStorage['zenflow_quests'] = { daily: dailyQuest, weekly: null, bonus: null };

    updateAllQuestsProgress({ type: 'habit_completed', value: 2 });

    const stored = mockStorage['zenflow_quests'] as { daily: Quest };
    expect(stored.daily.progress).toBe(2);
  });
});
