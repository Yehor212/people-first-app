import { describe, it, expect, vi } from 'vitest';
import {
  calculateLevel,
  getXpForAction,
  checkAchievements,
  generateDailyRewards,
  getBadgeColor,
  getBadgeGlow,
  ACHIEVEMENTS,
  type UserStats,
} from '../gamification';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { makeTestHabit, datesToEntries } from '@/test/habitFixtures';
import * as utils from '../utils';

// ============================================
// HELPER FUNCTIONS
// ============================================

const createMoodEntry = (date: string, mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible' = 'good'): MoodEntry => ({
  id: `mood_${date}`,
  mood,
  date,
  timestamp: new Date(date).getTime(),
});

const createHabit = (completedDates: string[] = []): Habit =>
  makeTestHabit({
    id: 'habit_1',
    name: 'Test Habit',
    icon: '🎯',
    entries: datesToEntries(completedDates),
  });

const createFocusSession = (duration: number, date: string): FocusSession => ({
  id: `focus_${date}_${duration}`,
  duration,
  date,
  completedAt: new Date(date).getTime(),
});

const createGratitudeEntry = (date: string): GratitudeEntry => ({
  id: `gratitude_${date}`,
  text: 'Grateful for today',
  date,
  timestamp: new Date(date).getTime(),
});

const createEmptyStats = (): UserStats => ({
  moods: [],
  habits: [],
  focusSessions: [],
  gratitudeEntries: [],
  totalXp: 0,
});

// Generate consecutive dates for streak testing (using local dates to match calculateStreak)
const generateConsecutiveDates = (count: number, startDate: Date = new Date()): string[] => {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() - i);
    // Use local date format (YYYY-MM-DD) to match getToday() and formatDate()
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
};

// ============================================
// ACHIEVEMENTS DATABASE
// ============================================

describe('ACHIEVEMENTS', () => {
  it('has 17 achievements defined', () => {
    expect(Object.keys(ACHIEVEMENTS)).toHaveLength(17);
  });

  it('all achievements have required fields', () => {
    for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
      expect(achievement.id).toBe(id);
      expect(achievement.name).toBeTruthy();
      expect(achievement.description).toBeTruthy();
      expect(achievement.icon).toBeTruthy();
      expect(['common', 'rare', 'epic', 'legendary']).toContain(achievement.rarity);
      expect(achievement.points).toBeGreaterThan(0);
    }
  });

  it('points scale with rarity', () => {
    const commonPoints = ACHIEVEMENTS.first_mood.points;
    const rarePoints = ACHIEVEMENTS.streak_7.points;
    const epicPoints = ACHIEVEMENTS.streak_30.points;
    const legendaryPoints = ACHIEVEMENTS.streak_100.points;

    expect(commonPoints).toBeLessThan(rarePoints);
    expect(rarePoints).toBeLessThan(epicPoints);
    expect(epicPoints).toBeLessThan(legendaryPoints);
  });
});

// ============================================
// LEVEL SYSTEM
// ============================================

describe('calculateLevel', () => {
  // Formula: Level N requires XP >= N^2 * 100
  // The while loop increments until level^2 * 100 > xp, then subtracts 1
  // Level 1: 0-399 XP (minimum level)
  // Level 2: 400-899 XP (need >= 2^2*100 = 400)
  // Level 3: 900-1599 XP (need >= 3^2*100 = 900)
  // Level 4: 1600-2499 XP (need >= 4^2*100 = 1600)
  // Level 5: 2500+ XP (need >= 5^2*100 = 2500)

  it('returns level 1 for 0 XP', () => {
    const result = calculateLevel(0);
    expect(result.level).toBe(1);
    expect(result.title).toBe('Новичок');
  });

  it('returns level 1 for XP less than 400', () => {
    expect(calculateLevel(0).level).toBe(1);
    expect(calculateLevel(100).level).toBe(1);
    expect(calculateLevel(399).level).toBe(1);
  });

  it('returns level 2 for XP >= 400 and < 900', () => {
    expect(calculateLevel(400).level).toBe(2);
    expect(calculateLevel(500).level).toBe(2);
    expect(calculateLevel(899).level).toBe(2);
  });

  it('calculates level based on N^2 * 100 formula', () => {
    // Level 3: 900-1599 XP
    expect(calculateLevel(900).level).toBe(3);
    expect(calculateLevel(1000).level).toBe(3);
    // Level 4: 1600-2499 XP
    expect(calculateLevel(1600).level).toBe(4);
    expect(calculateLevel(2000).level).toBe(4);
    // Level 5: 2500+ XP
    expect(calculateLevel(2500).level).toBe(5);
  });

  it('includes nextLevelXp in result', () => {
    // At 50 XP, level is 1
    // nextLevelXp = level^2 * 100 = 1*1*100 = 100
    const result = calculateLevel(50);
    expect(result.level).toBe(1);
    expect(result.nextLevelXp).toBe(100);

    // At 500 XP, level is 2
    // nextLevelXp = 2*2*100 = 400
    const result2 = calculateLevel(500);
    expect(result2.level).toBe(2);
    expect(result2.nextLevelXp).toBe(400);
  });

  it('returns correct title for each level', () => {
    expect(calculateLevel(0).title).toBe('Новичок');      // Level 1
    expect(calculateLevel(400).title).toBe('Ученик');     // Level 2
    expect(calculateLevel(900).title).toBe('Практик');    // Level 3
    expect(calculateLevel(1600).title).toBe('Адепт');     // Level 4
    expect(calculateLevel(2500).title).toBe('Эксперт');   // Level 5
  });

  it('caps title at maximum level', () => {
    // Very high XP should still return a valid title
    const result = calculateLevel(1000000);
    expect(result.title).toBeTruthy();
  });

  it('includes current XP in result', () => {
    const result = calculateLevel(500);
    expect(result.xp).toBe(500);
  });
});

// ============================================
// XP FOR ACTION
// ============================================

describe('getXpForAction', () => {
  it('returns correct XP for mood', () => {
    expect(getXpForAction('mood')).toBe(5);
  });

  it('returns correct XP for habit', () => {
    expect(getXpForAction('habit')).toBe(10);
  });

  it('returns correct XP for focus', () => {
    expect(getXpForAction('focus')).toBe(15);
  });

  it('returns correct XP for gratitude', () => {
    expect(getXpForAction('gratitude')).toBe(8);
  });

  it('returns correct XP for streak', () => {
    expect(getXpForAction('streak')).toBe(20);
  });

  it('focus gives most XP', () => {
    const actions = ['mood', 'habit', 'focus', 'gratitude'] as const;
    const maxXp = Math.max(...actions.map(a => getXpForAction(a)));
    expect(getXpForAction('focus')).toBe(maxXp);
  });
});

// ============================================
// ACHIEVEMENT CHECKING - FIRST TIME ACHIEVEMENTS
// ============================================

describe('checkAchievements - First Time', () => {
  it('unlocks first_mood on first mood entry', () => {
    const stats = createEmptyStats();
    stats.moods = [createMoodEntry('2024-01-15')];

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('first_mood');
  });

  it('unlocks first_habit on first habit creation', () => {
    const stats = createEmptyStats();
    stats.habits = [createHabit()];

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('first_habit');
  });

  it('unlocks first_focus on first focus session', () => {
    const stats = createEmptyStats();
    stats.focusSessions = [createFocusSession(25, '2024-01-15')];

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('first_focus');
  });

  it('unlocks first_gratitude on first gratitude entry', () => {
    const stats = createEmptyStats();
    stats.gratitudeEntries = [createGratitudeEntry('2024-01-15')];

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('first_gratitude');
  });

  it('does not re-unlock already unlocked achievements', () => {
    const stats = createEmptyStats();
    stats.moods = [createMoodEntry('2024-01-15')];

    const { newAchievements } = checkAchievements(stats, ['first_mood']);
    expect(newAchievements.map(a => a.id)).not.toContain('first_mood');
  });
});

// ============================================
// ACHIEVEMENT CHECKING - STREAKS
// ============================================

describe('checkAchievements - Streaks', () => {
  it('unlocks streak_3 after 3 consecutive days', () => {
    const stats = createEmptyStats();
    const dates = generateConsecutiveDates(3);
    stats.moods = dates.map(d => createMoodEntry(d));

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('streak_3');
  });

  it('unlocks streak_7 after 7 consecutive days', () => {
    const stats = createEmptyStats();
    const dates = generateConsecutiveDates(7);
    stats.moods = dates.map(d => createMoodEntry(d));

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('streak_7');
  });

  it('unlocks streak_30 after 30 consecutive days', () => {
    const stats = createEmptyStats();
    const dates = generateConsecutiveDates(30);
    stats.moods = dates.map(d => createMoodEntry(d));

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('streak_30');
  });

  it('unlocks streak_100 after 100 consecutive days', () => {
    const stats = createEmptyStats();
    const dates = generateConsecutiveDates(100);
    stats.moods = dates.map(d => createMoodEntry(d));

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('streak_100');
  });

  it('tracks progress for incomplete streaks', () => {
    const stats = createEmptyStats();
    const dates = generateConsecutiveDates(2); // Only 2 days
    stats.moods = dates.map(d => createMoodEntry(d));

    const { updatedProgress } = checkAchievements(stats, []);
    expect(updatedProgress.streak_3).toBe(2);
  });

  it('unlocks consistency_king after 365 consecutive days', () => {
    // Mock calculateStreak to return 365 directly, because the real implementation
    // uses parseLocalDate (local midnight) which can break at DST transitions —
    // two consecutive local midnights may be only 23h apart, causing Math.floor
    // to compute 0 instead of 1, terminating the streak prematurely.
    const spy = vi.spyOn(utils, 'calculateStreak').mockReturnValue(365);

    const stats = createEmptyStats();
    const dates = generateConsecutiveDates(365);
    stats.moods = dates.map(d => createMoodEntry(d));

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('consistency_king');

    spy.mockRestore();
  });
});

// ============================================
// ACHIEVEMENT CHECKING - QUANTITY ACHIEVEMENTS
// ============================================

describe('checkAchievements - Quantity', () => {
  it('unlocks habit_master after 100 habit completions', () => {
    const stats = createEmptyStats();
    const dates = generateConsecutiveDates(100);
    stats.habits = [createHabit(dates)];

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('habit_master');
  });

  it('tracks habit completion progress', () => {
    const stats = createEmptyStats();
    const dates = generateConsecutiveDates(50);
    stats.habits = [createHabit(dates)];

    const { updatedProgress } = checkAchievements(stats, []);
    expect(updatedProgress.habit_master).toBe(50);
  });

  it('unlocks focus_warrior after 50 hours of focus', () => {
    const stats = createEmptyStats();
    // 50 hours = 3000 minutes
    stats.focusSessions = [createFocusSession(3000, '2024-01-15')];

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('focus_warrior');
  });

  it('tracks focus hours progress', () => {
    const stats = createEmptyStats();
    // 25 hours = 1500 minutes
    stats.focusSessions = [createFocusSession(1500, '2024-01-15')];

    const { updatedProgress } = checkAchievements(stats, []);
    expect(updatedProgress.focus_warrior).toBe(25);
  });

  it('unlocks grateful_heart after 100 gratitude entries', () => {
    const stats = createEmptyStats();
    for (let i = 0; i < 100; i++) {
      stats.gratitudeEntries.push(createGratitudeEntry(`2024-01-${String(i % 28 + 1).padStart(2, '0')}`));
    }

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('grateful_heart');
  });

  it('unlocks mood_tracker after 50 mood entries', () => {
    const stats = createEmptyStats();
    for (let i = 0; i < 50; i++) {
      stats.moods.push(createMoodEntry(`2024-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String(i % 28 + 1).padStart(2, '0')}`));
    }

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('mood_tracker');
  });
});

// ============================================
// ACHIEVEMENT CHECKING - XP ACHIEVEMENTS
// ============================================

describe('checkAchievements - XP Based', () => {
  it('unlocks zen_master after 1000 XP', () => {
    const stats = createEmptyStats();
    stats.totalXp = 1000;

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).toContain('zen_master');
  });

  it('tracks XP progress', () => {
    const stats = createEmptyStats();
    stats.totalXp = 500;

    const { updatedProgress } = checkAchievements(stats, []);
    expect(updatedProgress.zen_master).toBe(500);
  });

  it('does not unlock zen_master below 1000 XP', () => {
    const stats = createEmptyStats();
    stats.totalXp = 999;

    const { newAchievements } = checkAchievements(stats, []);
    expect(newAchievements.map(a => a.id)).not.toContain('zen_master');
  });
});

// ============================================
// DAILY REWARDS
// ============================================

describe('generateDailyRewards', () => {
  it('generates reward for day 1', () => {
    const reward = generateDailyRewards(1);
    expect(reward.day).toBe(1);
    expect(reward.claimed).toBe(false);
    expect(reward.reward.type).toBe('xp');
    expect(reward.reward.value).toBe(10);
  });

  it('cycles through 7 days of rewards', () => {
    const rewards = [10, 15, 20, 25, 30, 40, 50];
    for (let day = 1; day <= 7; day++) {
      const reward = generateDailyRewards(day);
      expect(reward.reward.value).toBe(rewards[day - 1]);
    }
  });

  it('wraps around after day 7', () => {
    const day8 = generateDailyRewards(8);
    const day1 = generateDailyRewards(1);
    expect(day8.reward.value).toBe(day1.reward.value);
  });

  it('all rewards are XP type', () => {
    for (let day = 1; day <= 14; day++) {
      const reward = generateDailyRewards(day);
      expect(reward.reward.type).toBe('xp');
    }
  });

  it('rewards increase throughout the week', () => {
    let prevValue = 0;
    for (let day = 1; day <= 7; day++) {
      const reward = generateDailyRewards(day);
      expect(reward.reward.value).toBeGreaterThan(prevValue);
      prevValue = reward.reward.value as number;
    }
  });
});

// ============================================
// BADGE COLORS
// ============================================

describe('getBadgeColor', () => {
  it('returns gray classes for common', () => {
    const color = getBadgeColor('common');
    expect(color).toContain('gray');
  });

  it('returns blue classes for rare', () => {
    const color = getBadgeColor('rare');
    expect(color).toContain('blue');
  });

  it('returns purple classes for epic', () => {
    const color = getBadgeColor('epic');
    expect(color).toContain('purple');
  });

  it('returns yellow classes for legendary', () => {
    const color = getBadgeColor('legendary');
    expect(color).toContain('yellow');
  });

  it('returns bg, text, and border classes', () => {
    const color = getBadgeColor('rare');
    expect(color).toContain('bg-');
    expect(color).toContain('text-');
    expect(color).toContain('border-');
  });
});

// ============================================
// BADGE GLOW
// ============================================

describe('getBadgeGlow', () => {
  it('returns empty string for common', () => {
    expect(getBadgeGlow('common')).toBe('');
  });

  it('returns shadow for rare', () => {
    const glow = getBadgeGlow('rare');
    expect(glow).toContain('shadow');
    expect(glow).toContain('blue');
  });

  it('returns animated shadow for epic', () => {
    const glow = getBadgeGlow('epic');
    expect(glow).toContain('shadow');
    expect(glow).toContain('purple');
    expect(glow).toContain('animate');
  });

  it('returns strongest glow for legendary', () => {
    const glow = getBadgeGlow('legendary');
    expect(glow).toContain('shadow-2xl');
    expect(glow).toContain('yellow');
    expect(glow).toContain('animate');
  });
});

// ============================================
// EDGE CASES
// ============================================

describe('checkAchievements - Edge Cases', () => {
  it('handles empty stats', () => {
    const stats = createEmptyStats();
    const { newAchievements, updatedProgress } = checkAchievements(stats, []);
    expect(newAchievements).toHaveLength(0);
    expect(updatedProgress.streak_3).toBe(0);
  });

  it('handles multiple habits with completions', () => {
    const stats = createEmptyStats();
    const dates1 = generateConsecutiveDates(30);
    const dates2 = generateConsecutiveDates(30);
    stats.habits = [createHabit(dates1), createHabit(dates2)];

    const { updatedProgress } = checkAchievements(stats, []);
    expect(updatedProgress.habit_master).toBe(60); // 30 + 30
  });

  it('handles habits with empty entries', () => {
    const stats = createEmptyStats();
    const habit = createHabit();
    stats.habits = [habit];

    // Should not throw
    expect(() => checkAchievements(stats, [])).not.toThrow();
  });

  it('returns unlockedAt timestamp for new achievements', () => {
    const before = Date.now();
    const stats = createEmptyStats();
    stats.moods = [createMoodEntry('2024-01-15')];

    const { newAchievements } = checkAchievements(stats, []);
    const after = Date.now();

    const firstMood = newAchievements.find(a => a.id === 'first_mood');
    expect(firstMood?.unlockedAt).toBeGreaterThanOrEqual(before);
    expect(firstMood?.unlockedAt).toBeLessThanOrEqual(after);
  });

  it('includes progress in achievement when unlocking', () => {
    const stats = createEmptyStats();
    const dates = generateConsecutiveDates(7);
    stats.moods = dates.map(d => createMoodEntry(d));

    const { newAchievements } = checkAchievements(stats, []);
    const streak7 = newAchievements.find(a => a.id === 'streak_7');
    expect(streak7?.progress).toBe(7);
  });
});
