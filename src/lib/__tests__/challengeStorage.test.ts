import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Challenge, Badge, UserStats, Habit } from '@/types';

// ─── In-memory storage mock ────────────────────────────────────
let mockStorage: Record<string, unknown> = {};

vi.mock('../safeJson', () => ({
  safeLocalStorageGet: vi.fn(<T>(key: string, defaultValue: T): T => {
    return key in mockStorage ? (mockStorage[key] as T) : defaultValue;
  }),
  safeLocalStorageSet: vi.fn((key: string, value: unknown): boolean => {
    mockStorage[key] = value;
    return true;
  }),
  storageRemove: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
}));

vi.mock('../badges', () => ({
  badgeDefinitions: [
    { id: 'badge_streak_7', name: 'Streak 7', icon: '🔥', category: 'streak', title: { en: 'Streak 7' }, description: { en: 'desc' }, requirement: 7, unlocked: false, rarity: 'common' },
    { id: 'badge_special_first_habit', name: 'First Habit', icon: '💪', category: 'special', title: { en: 'First Habit' }, description: { en: 'desc' }, requirement: 1, unlocked: false, rarity: 'common' },
    { id: 'badge_special_perfectionist', name: 'Perfectionist', icon: '⭐', category: 'special', title: { en: 'Perfectionist' }, description: { en: 'desc' }, requirement: 10, unlocked: false, rarity: 'rare' },
    { id: 'badge_special_early_bird', name: 'Early Bird', icon: '🌅', category: 'special', title: { en: 'Early Bird' }, description: { en: 'desc' }, requirement: 20, unlocked: false, rarity: 'epic' },
    { id: 'badge_special_night_owl', name: 'Night Owl', icon: '🦉', category: 'special', title: { en: 'Night Owl' }, description: { en: 'desc' }, requirement: 20, unlocked: false, rarity: 'epic' },
    { id: 'badge_special_zen_master', name: 'Zen Master', icon: '🧘', category: 'special', title: { en: 'Zen Master' }, description: { en: 'desc' }, requirement: 30, unlocked: false, rarity: 'legendary' },
  ],
}));

vi.mock('../utils', () => ({ formatDate: vi.fn(() => '2026-02-17') }));
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { SK } from '@/lib/storageKeys';
import {
  getChallenges,
  saveChallenges,
  addChallenge,
  updateChallenge,
  deleteChallenge,
  getBadges,
  initializeBadges,
  saveBadges,
  unlockBadge,
  updateChallengeProgress,
  syncChallengeProgress,
  checkSpecialBadges,
  getActiveChallengesCount,
  getCompletedChallengesCount,
  getUnlockedBadgesCount,
  clearAllChallengesAndBadges,
} from '../challengeStorage';
import { safeLocalStorageSet, storageRemove } from '../safeJson';
import { logger } from '../logger';

// ─── Helpers ───────────────────────────────────────────────────

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'ch-1',
    type: 'streak',
    target: 7,
    progress: 0,
    completed: false,
    startDate: '2026-01-01',
    icon: '🔥',
    title: { en: 'Test Challenge' },
    description: { en: 'A test challenge' },
    ...overrides,
  };
}

function makeBadge(overrides: Partial<Badge> = {}): Badge {
  return {
    id: 'badge_streak_7',
    category: 'streak',
    icon: '🔥',
    title: { en: 'Streak 7' },
    description: { en: 'desc' },
    requirement: 7,
    unlocked: false,
    rarity: 'common',
    ...overrides,
  };
}

// ─── Setup ─────────────────────────────────────────────────────

beforeEach(() => {
  mockStorage = {};
  vi.clearAllMocks();
});

// ============================================================
// getChallenges
// ============================================================
describe('getChallenges', () => {
  it('returns empty array when nothing stored', () => {
    expect(getChallenges()).toEqual([]);
  });

  it('returns challenges from storage', () => {
    const challenges = [makeChallenge()];
    mockStorage[SK.CHALLENGES] = challenges;
    expect(getChallenges()).toEqual(challenges);
  });
});

// ============================================================
// saveChallenges
// ============================================================
describe('saveChallenges', () => {
  it('saves challenges to storage', () => {
    const challenges = [makeChallenge()];
    saveChallenges(challenges);
    expect(safeLocalStorageSet).toHaveBeenCalledWith(SK.CHALLENGES, challenges);
    expect(mockStorage[SK.CHALLENGES]).toEqual(challenges);
  });

  it('logs error when safeLocalStorageSet returns false', () => {
    vi.mocked(safeLocalStorageSet).mockReturnValueOnce(false);
    saveChallenges([]);
    expect(logger.error).toHaveBeenCalledWith('Failed to save challenges');
  });
});

// ============================================================
// addChallenge
// ============================================================
describe('addChallenge', () => {
  it('appends a challenge to empty list', () => {
    const ch = makeChallenge();
    addChallenge(ch);
    const stored = mockStorage[SK.CHALLENGES] as Challenge[];
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('ch-1');
  });

  it('appends to existing challenges', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-0' })];
    addChallenge(makeChallenge({ id: 'ch-1' }));
    const stored = mockStorage[SK.CHALLENGES] as Challenge[];
    expect(stored).toHaveLength(2);
    expect(stored[1].id).toBe('ch-1');
  });
});

// ============================================================
// updateChallenge
// ============================================================
describe('updateChallenge', () => {
  it('merges updates for existing challenge', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-1', progress: 0 })];
    updateChallenge('ch-1', { progress: 5 });
    const stored = mockStorage[SK.CHALLENGES] as Challenge[];
    expect(stored[0].progress).toBe(5);
  });

  it('no-op when challenge not found', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-1' })];
    updateChallenge('nonexistent', { progress: 99 });
    const stored = mockStorage[SK.CHALLENGES] as Challenge[];
    expect(stored[0].progress).toBe(0);
  });
});

// ============================================================
// deleteChallenge
// ============================================================
describe('deleteChallenge', () => {
  it('removes the specified challenge', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-1' }), makeChallenge({ id: 'ch-2' })];
    deleteChallenge('ch-1');
    const stored = mockStorage[SK.CHALLENGES] as Challenge[];
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('ch-2');
  });

  it('saves empty array when deleting the only challenge', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-1' })];
    deleteChallenge('ch-1');
    const stored = mockStorage[SK.CHALLENGES] as Challenge[];
    expect(stored).toHaveLength(0);
  });
});

// ============================================================
// getBadges / initializeBadges
// ============================================================
describe('getBadges', () => {
  it('returns stored badges when present', () => {
    const badges = [makeBadge({ id: 'b1', unlocked: true })];
    mockStorage[SK.BADGES] = badges;
    expect(getBadges()).toEqual(badges);
  });

  it('initializes badges when nothing stored', () => {
    const badges = getBadges();
    expect(badges).toHaveLength(6);
    expect(badges.every((b: Badge) => b.unlocked === false)).toBe(true);
  });
});

describe('initializeBadges', () => {
  it('creates badges from badgeDefinitions with unlocked=false', () => {
    const badges = initializeBadges();
    expect(badges).toHaveLength(6);
    for (const b of badges) {
      expect(b.unlocked).toBe(false);
    }
  });

  it('saves badges to storage', () => {
    initializeBadges();
    expect(mockStorage[SK.BADGES]).toBeDefined();
  });
});

// ============================================================
// saveBadges
// ============================================================
describe('saveBadges', () => {
  it('persists badges via safeLocalStorageSet', () => {
    const badges = [makeBadge()];
    saveBadges(badges);
    expect(safeLocalStorageSet).toHaveBeenCalledWith(SK.BADGES, badges);
  });
});

// ============================================================
// unlockBadge
// ============================================================
describe('unlockBadge', () => {
  it('unlocks a locked badge and returns it', () => {
    initializeBadges();
    const result = unlockBadge('badge_streak_7');
    expect(result).not.toBeNull();
    expect(result.unlocked).toBe(true);
    expect(result.unlockedDate).toBe('2026-02-17');
  });

  it('returns null if badge is already unlocked', () => {
    initializeBadges();
    unlockBadge('badge_streak_7');
    const result = unlockBadge('badge_streak_7');
    expect(result).toBeNull();
  });

  it('returns null if badge id does not exist', () => {
    initializeBadges();
    const result = unlockBadge('nonexistent_badge');
    expect(result).toBeNull();
  });
});

// ============================================================
// updateChallengeProgress
// ============================================================
describe('updateChallengeProgress', () => {
  it('updates progress for an incomplete challenge', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-1', target: 10, progress: 0 })];
    const result = updateChallengeProgress('ch-1', 5);
    expect(result).not.toBeNull();
    expect(result.progress).toBe(5);
    expect(result.completed).toBe(false);
  });

  it('marks challenge completed when progress reaches target', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-1', target: 10, progress: 0 })];
    const result = updateChallengeProgress('ch-1', 10);
    expect(result).not.toBeNull();
    expect(result.completed).toBe(true);
    expect(result.completedDate).toBe('2026-02-17');
  });

  it('marks challenge completed when progress exceeds target', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-1', target: 5, progress: 0 })];
    const result = updateChallengeProgress('ch-1', 8);
    expect(result.completed).toBe(true);
  });

  it('unlocks reward badge when challenge completes', () => {
    initializeBadges();
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-1', target: 7, progress: 0, reward: 'badge_streak_7' })];
    updateChallengeProgress('ch-1', 7);
    const badges = mockStorage[SK.BADGES] as Badge[];
    const badge = badges.find(b => b.id === 'badge_streak_7');
    expect(badge).toBeDefined();
    expect(badge.unlocked).toBe(true);
  });

  it('returns null for already completed challenge', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-1', completed: true })];
    const result = updateChallengeProgress('ch-1', 5);
    expect(result).toBeNull();
  });

  it('returns null for nonexistent challenge', () => {
    mockStorage[SK.CHALLENGES] = [];
    const result = updateChallengeProgress('nonexistent', 5);
    expect(result).toBeNull();
  });
});

// ============================================================
// syncChallengeProgress
// ============================================================
describe('syncChallengeProgress', () => {
  const baseStats: UserStats = {
    totalFocusMinutes: 0,
    currentStreak: 10,
    longestStreak: 10,
    habitsCompleted: 50,
    moodEntries: 5,
    gratitudeEntries: 20,
    perfectDaysCount: 0,
    earlyBirdCount: 0,
    nightOwlCount: 0,
    zenMasterDays: 0,
  };

  it('updates streak challenge from stats.currentStreak', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-streak', type: 'streak', target: 30, progress: 0 })];
    syncChallengeProgress(baseStats, 100, 10);
    const stored = mockStorage[SK.CHALLENGES] as Challenge[];
    expect(stored[0].progress).toBe(10);
  });

  it('updates focus challenge from focusMinutes', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-focus', type: 'focus', target: 500, progress: 0 })];
    syncChallengeProgress(baseStats, 200, 10);
    const stored = mockStorage[SK.CHALLENGES] as Challenge[];
    expect(stored[0].progress).toBe(200);
  });

  it('updates gratitude challenge from gratitudeCount', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-grat', type: 'gratitude', target: 50, progress: 0 })];
    syncChallengeProgress(baseStats, 100, 25);
    const stored = mockStorage[SK.CHALLENGES] as Challenge[];
    expect(stored[0].progress).toBe(25);
  });

  it('updates total challenge from stats.habitsCompleted', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-total', type: 'total', target: 100, progress: 0 })];
    syncChallengeProgress(baseStats, 100, 10);
    const stored = mockStorage[SK.CHALLENGES] as Challenge[];
    expect(stored[0].progress).toBe(50);
  });

  it('skips already completed challenges', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-done', type: 'streak', target: 5, progress: 5, completed: true })];
    const result = syncChallengeProgress(baseStats, 100, 10);
    expect(result).toEqual([]);
  });

  it('returns empty array when no badges unlocked', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge({ id: 'ch-1', type: 'streak', target: 999, progress: 0 })];
    const result = syncChallengeProgress(baseStats, 0, 0);
    expect(result).toEqual([]);
  });
});

// ============================================================
// checkSpecialBadges
// ============================================================
describe('checkSpecialBadges', () => {
  const emptyHabits: Habit[] = [];

  it('unlocks first_habit when habitsCompleted >= 1', () => {
    initializeBadges();
    const stats: UserStats = {
      totalFocusMinutes: 0, currentStreak: 0, longestStreak: 0,
      habitsCompleted: 1, moodEntries: 0, gratitudeEntries: 0,
      perfectDaysCount: 0, earlyBirdCount: 0, nightOwlCount: 0, zenMasterDays: 0,
    };
    const result = checkSpecialBadges(stats, emptyHabits);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('badge_special_first_habit');
  });

  it('unlocks perfectionist when perfectDaysCount >= 10', () => {
    initializeBadges();
    const stats: UserStats = {
      totalFocusMinutes: 0, currentStreak: 0, longestStreak: 0,
      habitsCompleted: 0, moodEntries: 0, gratitudeEntries: 0,
      perfectDaysCount: 10, earlyBirdCount: 0, nightOwlCount: 0, zenMasterDays: 0,
    };
    const result = checkSpecialBadges(stats, emptyHabits);
    expect(result.some(b => b.id === 'badge_special_perfectionist')).toBe(true);
  });

  it('unlocks early_bird when earlyBirdCount >= 20', () => {
    initializeBadges();
    const stats: UserStats = {
      totalFocusMinutes: 0, currentStreak: 0, longestStreak: 0,
      habitsCompleted: 0, moodEntries: 0, gratitudeEntries: 0,
      perfectDaysCount: 0, earlyBirdCount: 20, nightOwlCount: 0, zenMasterDays: 0,
    };
    const result = checkSpecialBadges(stats, emptyHabits);
    expect(result.some(b => b.id === 'badge_special_early_bird')).toBe(true);
  });

  it('unlocks night_owl when nightOwlCount >= 20', () => {
    initializeBadges();
    const stats: UserStats = {
      totalFocusMinutes: 0, currentStreak: 0, longestStreak: 0,
      habitsCompleted: 0, moodEntries: 0, gratitudeEntries: 0,
      perfectDaysCount: 0, earlyBirdCount: 0, nightOwlCount: 20, zenMasterDays: 0,
    };
    const result = checkSpecialBadges(stats, emptyHabits);
    expect(result.some(b => b.id === 'badge_special_night_owl')).toBe(true);
  });

  it('unlocks zen_master when zenMasterDays >= 30', () => {
    initializeBadges();
    const stats: UserStats = {
      totalFocusMinutes: 0, currentStreak: 0, longestStreak: 0,
      habitsCompleted: 0, moodEntries: 0, gratitudeEntries: 0,
      perfectDaysCount: 0, earlyBirdCount: 0, nightOwlCount: 0, zenMasterDays: 30,
    };
    const result = checkSpecialBadges(stats, emptyHabits);
    expect(result.some(b => b.id === 'badge_special_zen_master')).toBe(true);
  });

  it('does not unlock badges below thresholds', () => {
    initializeBadges();
    const stats: UserStats = {
      totalFocusMinutes: 0, currentStreak: 0, longestStreak: 0,
      habitsCompleted: 0, moodEntries: 0, gratitudeEntries: 0,
      perfectDaysCount: 9, earlyBirdCount: 19, nightOwlCount: 19, zenMasterDays: 29,
    };
    const result = checkSpecialBadges(stats, emptyHabits);
    expect(result).toHaveLength(0);
  });

  it('does not re-unlock already unlocked badge', () => {
    initializeBadges();
    const stats: UserStats = {
      totalFocusMinutes: 0, currentStreak: 0, longestStreak: 0,
      habitsCompleted: 5, moodEntries: 0, gratitudeEntries: 0,
      perfectDaysCount: 0, earlyBirdCount: 0, nightOwlCount: 0, zenMasterDays: 0,
    };
    checkSpecialBadges(stats, emptyHabits);
    const second = checkSpecialBadges(stats, emptyHabits);
    expect(second).toHaveLength(0);
  });
});

// ============================================================
// getActiveChallengesCount / getCompletedChallengesCount
// ============================================================
describe('getActiveChallengesCount', () => {
  it('returns 0 when no challenges', () => {
    expect(getActiveChallengesCount()).toBe(0);
  });

  it('counts only incomplete challenges', () => {
    mockStorage[SK.CHALLENGES] = [
      makeChallenge({ id: 'a', completed: false }),
      makeChallenge({ id: 'b', completed: true }),
      makeChallenge({ id: 'c', completed: false }),
    ];
    expect(getActiveChallengesCount()).toBe(2);
  });
});

describe('getCompletedChallengesCount', () => {
  it('returns 0 when no challenges', () => {
    expect(getCompletedChallengesCount()).toBe(0);
  });

  it('counts only completed challenges', () => {
    mockStorage[SK.CHALLENGES] = [
      makeChallenge({ id: 'a', completed: true }),
      makeChallenge({ id: 'b', completed: false }),
      makeChallenge({ id: 'c', completed: true }),
    ];
    expect(getCompletedChallengesCount()).toBe(2);
  });
});

// ============================================================
// getUnlockedBadgesCount
// ============================================================
describe('getUnlockedBadgesCount', () => {
  it('returns 0 when all badges locked', () => {
    initializeBadges();
    expect(getUnlockedBadgesCount()).toBe(0);
  });

  it('counts only unlocked badges', () => {
    initializeBadges();
    unlockBadge('badge_streak_7');
    unlockBadge('badge_special_first_habit');
    expect(getUnlockedBadgesCount()).toBe(2);
  });
});

// ============================================================
// clearAllChallengesAndBadges
// ============================================================
describe('clearAllChallengesAndBadges', () => {
  it('removes challenges and badges from storage', () => {
    mockStorage[SK.CHALLENGES] = [makeChallenge()];
    mockStorage[SK.BADGES] = [makeBadge()];
    clearAllChallengesAndBadges();
    expect(storageRemove).toHaveBeenCalledWith(SK.CHALLENGES);
    expect(storageRemove).toHaveBeenCalledWith(SK.BADGES);
    expect(mockStorage[SK.CHALLENGES]).toBeUndefined();
    expect(mockStorage[SK.BADGES]).toBeUndefined();
  });
});
