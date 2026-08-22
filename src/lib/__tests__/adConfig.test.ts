import { describe, it, expect } from 'vitest';
import {
  AD_UNIT_IDS,
  AD_FREQUENCY,
  AD_MOOD_RULES,
  AD_SACRED_ZONES,
  AD_SAFE_ZONES,
  AD_REWARDS,
  AD_STORAGE_KEYS,
} from '../adConfig';

// ============================================
// AD_UNIT_IDS
// ============================================

describe('AD_UNIT_IDS', () => {
  it('has only the Android rewarded ID', () => {
    expect(typeof AD_UNIT_IDS.android.rewarded).toBe('string');
    expect(AD_UNIT_IDS.android).not.toHaveProperty('banner');
  });

  it('has only the iOS rewarded ID', () => {
    expect(typeof AD_UNIT_IDS.ios.rewarded).toBe('string');
    expect(AD_UNIT_IDS.ios).not.toHaveProperty('banner');
  });
});

// ============================================
// AD_FREQUENCY
// ============================================

describe('AD_FREQUENCY', () => {
  it('has sensible frequency caps', () => {
    expect(AD_FREQUENCY.maxRewardedPerDay).toBeGreaterThan(0);
    expect(AD_FREQUENCY.maxRewardedPerSession).toBeGreaterThan(0);
    expect(AD_FREQUENCY.maxRewardedPerSession).toBeLessThanOrEqual(AD_FREQUENCY.maxRewardedPerDay);
  });

  it('has minimum interval between ads', () => {
    expect(AD_FREQUENCY.minIntervalMs).toBeGreaterThan(0);
    // At least 1 minute between ads
    expect(AD_FREQUENCY.minIntervalMs).toBeGreaterThanOrEqual(60_000);
  });

  it('has dismiss cooldown longer than min interval', () => {
    expect(AD_FREQUENCY.dismissCooldownMs).toBeGreaterThan(AD_FREQUENCY.minIntervalMs);
  });
});

// ============================================
// AD_MOOD_RULES
// ============================================

describe('AD_MOOD_RULES', () => {
  it('blocks ads for terrible and bad mood', () => {
    expect(AD_MOOD_RULES.blockedMoods).toContain('terrible');
    expect(AD_MOOD_RULES.blockedMoods).toContain('bad');
  });

  it('does not reduce ads for low mood because low mood is blocked', () => {
    expect(AD_MOOD_RULES.reducedMoods).not.toContain('bad');
  });

  it('has a reduced max per session that is less than normal', () => {
    expect(AD_MOOD_RULES.reducedMaxPerSession).toBeLessThan(AD_FREQUENCY.maxRewardedPerSession);
  });
});

// ============================================
// AD_SACRED_ZONES
// ============================================

describe('AD_SACRED_ZONES', () => {
  it('is a non-empty array of zones', () => {
    expect(AD_SACRED_ZONES.length).toBeGreaterThan(0);
  });

  it('includes focus_active and breathing_active', () => {
    expect(AD_SACRED_ZONES).toContain('focus_active');
    expect(AD_SACRED_ZONES).toContain('breathing_active');
  });

  it('includes mood_logging and journaling', () => {
    expect(AD_SACRED_ZONES).toContain('mood_logging');
    expect(AD_SACRED_ZONES).toContain('journaling');
  });
});

// ============================================
// AD_SAFE_ZONES
// ============================================

describe('AD_SAFE_ZONES', () => {
  it('is a non-empty array of zones', () => {
    expect(AD_SAFE_ZONES.length).toBeGreaterThan(0);
  });

  it('allows only the dedicated optional-rewards surface initially', () => {
    expect(AD_SAFE_ZONES).toEqual(['optional_rewards']);
  });
});

// ============================================
// AD_REWARDS
// ============================================

describe('AD_REWARDS', () => {
  it('gives positive treat rewards for watching ads', () => {
    expect(AD_REWARDS.rewardedVideoTreats).toBeGreaterThan(0);
  });

  it('gives bonus XP for rewarded videos', () => {
    expect(AD_REWARDS.rewardedVideoXp).toBeGreaterThan(0);
  });

  it('has a daily reward multiplier of at least 2x', () => {
    expect(AD_REWARDS.dailyRewardMultiplier).toBeGreaterThanOrEqual(2);
  });
});

// ============================================
// AD_STORAGE_KEYS
// ============================================

describe('AD_STORAGE_KEYS', () => {
  it('has all required storage keys as non-empty strings', () => {
    expect(typeof AD_STORAGE_KEYS.dailyRewardedCount).toBe('string');
    expect(typeof AD_STORAGE_KEYS.dailyCountDate).toBe('string');
    expect(typeof AD_STORAGE_KEYS.sessionRewardedCount).toBe('string');
    expect(typeof AD_STORAGE_KEYS.lastAdTimestamp).toBe('string');
    expect(typeof AD_STORAGE_KEYS.lastDismissTimestamp).toBe('string');
    expect(typeof AD_STORAGE_KEYS.adConsentShown).toBe('string');
  });

  it('all storage keys have zenflow prefix', () => {
    for (const key of Object.values(AD_STORAGE_KEYS)) {
      expect(key).toMatch(/^zenflow-/);
    }
  });
});
