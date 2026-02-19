import { describe, it, expect } from 'vitest';
import {
  TREAT_REWARDS,
  STREAK_MULTIPLIER,
  COMPANION_COSTS,
  COMPANION_LEVELING,
  FULLNESS_DECAY,
  getStreakMultiplier,
  calculateTreatsEarned,
  getXpForNextLevel,
} from '../treatConstants';

// ============================================
// CONSTANTS
// ============================================

describe('treat constants', () => {
  it('TREAT_REWARDS has all activity reward values', () => {
    expect(TREAT_REWARDS.mood).toBeGreaterThan(0);
    expect(TREAT_REWARDS.habit).toBeGreaterThan(0);
    expect(TREAT_REWARDS.focus_per_minute).toBeGreaterThan(0);
    expect(TREAT_REWARDS.gratitude).toBeGreaterThan(0);
    expect(TREAT_REWARDS.breathing).toBeGreaterThan(0);
  });

  it('STREAK_MULTIPLIER has perDay, maxMultiplier, and daysToMax', () => {
    expect(STREAK_MULTIPLIER.perDay).toBe(0.1);
    expect(STREAK_MULTIPLIER.maxMultiplier).toBe(2.0);
    expect(STREAK_MULTIPLIER.daysToMax).toBe(10);
  });

  it('COMPANION_COSTS has feed and pet configs', () => {
    expect(COMPANION_COSTS.feed.treatCost).toBeGreaterThan(0);
    expect(COMPANION_COSTS.feed.fullnessGain).toBeGreaterThan(0);
    expect(COMPANION_COSTS.feed.xpGain).toBeGreaterThan(0);
    expect(COMPANION_COSTS.pet.treatCost).toBe(0); // petting is free
    expect(COMPANION_COSTS.pet.xpGain).toBeGreaterThan(0);
    expect(COMPANION_COSTS.pet.cooldownMs).toBeGreaterThan(0);
  });

  it('FULLNESS_DECAY has decay rate and thresholds', () => {
    expect(FULLNESS_DECAY.perHour).toBeGreaterThan(0);
    expect(FULLNESS_DECAY.hungerThreshold).toBeGreaterThan(FULLNESS_DECAY.starvingThreshold);
  });
});

// ============================================
// getStreakMultiplier
// ============================================

describe('getStreakMultiplier', () => {
  it('returns 1.0 for 0-day streak', () => {
    expect(getStreakMultiplier(0)).toBe(1.0);
  });

  it('returns 1.5 for 5-day streak', () => {
    expect(getStreakMultiplier(5)).toBe(1.5);
  });

  it('returns 2.0 for 10-day streak (max cap)', () => {
    expect(getStreakMultiplier(10)).toBe(2.0);
  });

  it('caps at 2.0 for streaks beyond 10 days', () => {
    expect(getStreakMultiplier(20)).toBe(2.0);
    expect(getStreakMultiplier(100)).toBe(2.0);
  });
});

// ============================================
// calculateTreatsEarned
// ============================================

describe('calculateTreatsEarned', () => {
  it('returns base amount with no streak', () => {
    const result = calculateTreatsEarned(10, 0);
    expect(result.base).toBe(10);
    expect(result.total).toBe(10);
    expect(result.bonus).toBe(0);
    expect(result.multiplier).toBe(1.0);
  });

  it('doubles base at 10-day streak', () => {
    const result = calculateTreatsEarned(10, 10);
    expect(result.total).toBe(20);
    expect(result.bonus).toBe(10);
    expect(result.multiplier).toBe(2.0);
  });

  it('rounds the total correctly', () => {
    // 10 * 1.3 = 13
    const result = calculateTreatsEarned(10, 3);
    expect(result.total).toBe(13);
  });
});

// ============================================
// getXpForNextLevel
// ============================================

describe('getXpForNextLevel', () => {
  it('returns 50 for level 1', () => {
    expect(getXpForNextLevel(1)).toBe(50);
  });

  it('returns 250 for level 5', () => {
    expect(getXpForNextLevel(5)).toBe(250);
  });

  it('scales linearly with level', () => {
    expect(getXpForNextLevel(10)).toBe(500);
    expect(getXpForNextLevel(100)).toBe(5000);
  });

  it('COMPANION_LEVELING maxLevel is 100', () => {
    expect(COMPANION_LEVELING.maxLevel).toBe(100);
  });
});
