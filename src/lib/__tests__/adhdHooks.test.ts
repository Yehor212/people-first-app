import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  getDailyLoginRewards,
  getLoginStreakBonus,
  initCombo,
  updateCombo,
  getComboMessage,
  getSpinWheelPrizes,
  spinWheel,
  openMysteryBox,
  getMysteryBoxInfo,
  generateFlashChallenge,
  generateHourlyChallenge,
  generateWeekendChallenge,
  getAvailablePowerUps,
  activatePowerUp,
  getStreakRiskNotification,
  getComebackNotification,
  getMilestoneNotification,
  formatTimeRemaining,
  shouldShowUrgentPrompt,
} from '../adhdHooks';
import type { MysteryBox } from '../adhdHooks';

// ─── Setup ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T10:00:00')); // Monday
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================
// getDailyLoginRewards
// ============================================
describe('getDailyLoginRewards', () => {
  it('returns exactly 7 rewards (one per day)', () => {
    const rewards = getDailyLoginRewards();
    expect(rewards).toHaveLength(7);
  });

  it('each reward has day, reward object, and claimed=false', () => {
    const rewards = getDailyLoginRewards();
    for (const r of rewards) {
      expect(r.day).toBeGreaterThanOrEqual(1);
      expect(r.day).toBeLessThanOrEqual(7);
      expect(r.reward).toHaveProperty('type');
      expect(r.reward).toHaveProperty('value');
      expect(r.reward).toHaveProperty('label');
      expect(r.reward).toHaveProperty('icon');
      expect(r.claimed).toBe(false);
    }
  });

  it('days are sequential from 1 to 7', () => {
    const rewards = getDailyLoginRewards();
    rewards.forEach((r, i) => {
      expect(r.day).toBe(i + 1);
    });
  });
});

// ============================================
// getLoginStreakBonus
// ============================================
describe('getLoginStreakBonus', () => {
  it('returns 0 for 1 day', () => {
    expect(getLoginStreakBonus(1)).toBe(0);
  });

  it('returns 0 for 2 days', () => {
    expect(getLoginStreakBonus(2)).toBe(0);
  });

  it('returns 50 for 3 days', () => {
    expect(getLoginStreakBonus(3)).toBe(50);
  });

  it('returns 100 for 7 days', () => {
    expect(getLoginStreakBonus(7)).toBe(100);
  });

  it('returns 200 for 14 days', () => {
    expect(getLoginStreakBonus(14)).toBe(200);
  });

  it('returns 500 for 30 days', () => {
    expect(getLoginStreakBonus(30)).toBe(500);
  });

  it('returns 500 for values above 30', () => {
    expect(getLoginStreakBonus(100)).toBe(500);
  });
});

// ============================================
// Combo System
// ============================================
describe('initCombo', () => {
  it('returns a combo state with count=0 and multiplier=1', () => {
    const combo = initCombo();
    expect(combo.count).toBe(0);
    expect(combo.multiplier).toBe(1);
    expect(combo.lastActionTime).toBe(0);
    expect(combo.expiresAt).toBe(0);
    expect(combo.bonusXp).toBe(0);
  });
});

describe('updateCombo', () => {
  it('increments count from initial state', () => {
    const initial = initCombo();
    const updated = updateCombo(initial);
    expect(updated.count).toBe(1);
    expect(updated.multiplier).toBe(1.0);
  });

  it('increases multiplier to 1.5 at count 3', () => {
    let combo = initCombo();
    for (let i = 0; i < 3; i++) {
      combo = updateCombo(combo);
    }
    expect(combo.count).toBe(3);
    expect(combo.multiplier).toBe(1.5);
  });

  it('increases multiplier to 2.0 at count 5', () => {
    let combo = initCombo();
    for (let i = 0; i < 5; i++) {
      combo = updateCombo(combo);
    }
    expect(combo.count).toBe(5);
    expect(combo.multiplier).toBe(2.0);
  });

  it('caps at MAX_COMBO=10 with multiplier 3.0', () => {
    let combo = initCombo();
    for (let i = 0; i < 12; i++) {
      combo = updateCombo(combo);
    }
    expect(combo.count).toBe(10);
    expect(combo.multiplier).toBe(3.0);
    expect(combo.bonusXp).toBe(100);
  });

  it('resets to count=1 when combo has expired', () => {
    let combo = initCombo();
    combo = updateCombo(combo);
    combo = updateCombo(combo);
    expect(combo.count).toBe(2);

    // Advance past 5-minute window
    vi.advanceTimersByTime(6 * 60 * 1000);
    const reset = updateCombo(combo);
    expect(reset.count).toBe(1);
    expect(reset.multiplier).toBe(1.0);
    expect(reset.bonusXp).toBe(0);
  });

  it('sets expiresAt to 5 minutes in the future', () => {
    const combo = updateCombo(initCombo());
    const fiveMin = 5 * 60 * 1000;
    expect(combo.expiresAt).toBe(Date.now() + fiveMin);
  });
});

describe('getComboMessage', () => {
  it('returns null for count below 3', () => {
    expect(getComboMessage(1)).toBeNull();
    expect(getComboMessage(2)).toBeNull();
  });

  it('returns message at count 3', () => {
    const msg = getComboMessage(3);
    expect(msg).not.toBeNull();
    expect(msg.text).toContain('x3');
  });

  it('returns message at count 5', () => {
    const msg = getComboMessage(5);
    expect(msg).not.toBeNull();
    expect(msg.text).toContain('SUPER');
  });

  it('returns message at count 10', () => {
    const msg = getComboMessage(10);
    expect(msg).not.toBeNull();
    expect(msg.text).toContain('UNSTOPPABLE');
  });

  it('returns null for counts between milestones', () => {
    expect(getComboMessage(4)).toBeNull();
    expect(getComboMessage(6)).toBeNull();
    expect(getComboMessage(8)).toBeNull();
  });
});

// ============================================
// Spin Wheel
// ============================================
describe('getSpinWheelPrizes', () => {
  it('returns a non-empty array of prizes', () => {
    const prizes = getSpinWheelPrizes();
    expect(prizes.length).toBeGreaterThan(0);
  });

  it('every prize has id, label, icon, xp, rarity, probability', () => {
    for (const prize of getSpinWheelPrizes()) {
      expect(prize).toHaveProperty('id');
      expect(prize).toHaveProperty('label');
      expect(prize).toHaveProperty('icon');
      expect(typeof prize.xp).toBe('number');
      expect(prize).toHaveProperty('rarity');
      expect(prize.probability).toBeGreaterThan(0);
    }
  });

  it('probabilities roughly sum to 1', () => {
    const total = getSpinWheelPrizes().reduce((sum, p) => sum + p.probability, 0);
    expect(total).toBeCloseTo(1.0, 1);
  });
});

describe('spinWheel', () => {
  it('returns a prize object with label and rarity', () => {
    const prize = spinWheel();
    expect(prize).toHaveProperty('label');
    expect(prize).toHaveProperty('rarity');
    expect(prize).toHaveProperty('id');
  });

  it('always returns a valid prize from the known set', () => {
    const validIds = getSpinWheelPrizes().map(p => p.id);
    for (let i = 0; i < 20; i++) {
      const prize = spinWheel();
      expect(validIds).toContain(prize.id);
    }
  });
});

// ============================================
// Mystery Boxes
// ============================================
describe('openMysteryBox', () => {
  const boxTypes: MysteryBox['type'][] = ['bronze', 'silver', 'gold', 'diamond'];

  it('returns a non-empty rewards array for each box type', () => {
    for (const type of boxTypes) {
      const rewards = openMysteryBox(type);
      expect(rewards.length).toBeGreaterThan(0);
    }
  });

  it('each reward has type, value, label, icon', () => {
    for (const type of boxTypes) {
      const rewards = openMysteryBox(type);
      for (const reward of rewards) {
        expect(reward).toHaveProperty('type');
        expect(reward).toHaveProperty('value');
        expect(reward).toHaveProperty('label');
        expect(reward).toHaveProperty('icon');
      }
    }
  });
});

describe('getMysteryBoxInfo', () => {
  const boxTypes: MysteryBox['type'][] = ['bronze', 'silver', 'gold', 'diamond'];

  it('returns icon, label, and color for each box type', () => {
    for (const type of boxTypes) {
      const info = getMysteryBoxInfo(type);
      expect(info).toHaveProperty('icon');
      expect(info).toHaveProperty('label');
      expect(info).toHaveProperty('color');
      expect(info.color).toMatch(/^bg-/);
    }
  });

  it('returns specific info for bronze', () => {
    const info = getMysteryBoxInfo('bronze');
    expect(info.label).toBe('Bronze Box');
  });

  it('returns specific info for diamond', () => {
    const info = getMysteryBoxInfo('diamond');
    expect(info.label).toBe('Diamond Box');
  });
});

// ============================================
// Time-Limited Challenges
// ============================================
describe('generateFlashChallenge', () => {
  it('returns a TimeChallenge with type "flash"', () => {
    const challenge = generateFlashChallenge();
    expect(challenge.type).toBe('flash');
  });

  it('has progress=0 and completed=false', () => {
    const challenge = generateFlashChallenge();
    expect(challenge.progress).toBe(0);
    expect(challenge.completed).toBe(false);
  });

  it('has a positive xpReward', () => {
    const challenge = generateFlashChallenge();
    expect(challenge.xpReward).toBeGreaterThan(0);
  });

  it('has expiresAt after startsAt', () => {
    const challenge = generateFlashChallenge();
    expect(challenge.expiresAt).toBeGreaterThan(challenge.startsAt);
  });
});

describe('generateHourlyChallenge', () => {
  it('returns a TimeChallenge with type "hourly"', () => {
    const challenge = generateHourlyChallenge();
    expect(challenge.type).toBe('hourly');
  });

  it('expires exactly 1 hour after creation', () => {
    const challenge = generateHourlyChallenge();
    const diff = challenge.expiresAt - challenge.startsAt;
    expect(diff).toBe(60 * 60 * 1000);
  });

  it('has a target greater than 0', () => {
    const challenge = generateHourlyChallenge();
    expect(challenge.target).toBeGreaterThan(0);
  });
});

describe('generateWeekendChallenge', () => {
  it('returns null on a weekday (Monday)', () => {
    // 2026-06-15 is Monday
    vi.setSystemTime(new Date('2026-06-15T10:00:00'));
    expect(generateWeekendChallenge()).toBeNull();
  });

  it('returns a challenge on Saturday', () => {
    // 2026-06-20 is Saturday
    vi.setSystemTime(new Date('2026-06-20T10:00:00'));
    const challenge = generateWeekendChallenge();
    expect(challenge).not.toBeNull();
    expect(challenge.type).toBe('weekend');
  });

  it('returns a challenge on Sunday', () => {
    // 2026-06-21 is Sunday
    vi.setSystemTime(new Date('2026-06-21T10:00:00'));
    const challenge = generateWeekendChallenge();
    expect(challenge).not.toBeNull();
    expect(challenge.type).toBe('weekend');
  });

  it('weekend challenge has positive xpReward', () => {
    vi.setSystemTime(new Date('2026-06-20T10:00:00'));
    const challenge = generateWeekendChallenge();
    expect(challenge).not.toBeNull();
    expect(challenge.xpReward).toBeGreaterThan(0);
  });
});

// ============================================
// Power-Ups
// ============================================
describe('getAvailablePowerUps', () => {
  it('returns a non-empty array', () => {
    const powerUps = getAvailablePowerUps();
    expect(powerUps.length).toBeGreaterThan(0);
  });

  it('each power-up has id, name, icon, description, duration, effect', () => {
    for (const pu of getAvailablePowerUps()) {
      expect(pu).toHaveProperty('id');
      expect(pu).toHaveProperty('name');
      expect(pu).toHaveProperty('icon');
      expect(pu).toHaveProperty('description');
      expect(pu.duration).toBeGreaterThan(0);
      expect(pu).toHaveProperty('effect');
    }
  });
});

describe('activatePowerUp', () => {
  it('returns a PowerUp with activatedAt and expiresAt for valid id', () => {
    const result = activatePowerUp('2x_xp');
    expect(result).not.toBeNull();
    expect(result.activatedAt).toBeDefined();
    expect(result.expiresAt).toBeDefined();
    expect(result.effect).toBe('2x_xp');
  });

  it('sets expiresAt = activatedAt + duration in ms', () => {
    const result = activatePowerUp('2x_xp');
    expect(result).not.toBeNull();
    const expectedExpiry = result.activatedAt + result.duration * 60 * 1000;
    expect(result.expiresAt).toBe(expectedExpiry);
  });

  it('returns null for unknown power-up id', () => {
    expect(activatePowerUp('nonexistent')).toBeNull();
  });

  it('activates streak freeze with 1440 min duration', () => {
    const result = activatePowerUp('freeze');
    expect(result).not.toBeNull();
    expect(result.effect).toBe('freeze_streak');
    expect(result.duration).toBe(1440);
  });
});

// ============================================
// Notifications
// ============================================
describe('getStreakRiskNotification', () => {
  it('returns null when more than 3 hours until midnight', () => {
    expect(getStreakRiskNotification(5, 4)).toBeNull();
  });

  it('returns notification when 3 hours or less until midnight', () => {
    const notif = getStreakRiskNotification(5, 2);
    expect(notif).not.toBeNull();
    expect(notif.type).toBe('streak_risk');
  });

  it('sets urgency to "critical" when less than 1 hour', () => {
    const notif = getStreakRiskNotification(10, 0.5);
    expect(notif).not.toBeNull();
    expect(notif.urgency).toBe('critical');
  });

  it('sets urgency to "high" when between 1-3 hours', () => {
    const notif = getStreakRiskNotification(10, 2);
    expect(notif).not.toBeNull();
    expect(notif.urgency).toBe('high');
  });
});

describe('getComebackNotification', () => {
  it('returns null when daysSinceLastLogin < 1', () => {
    expect(getComebackNotification(0)).toBeNull();
    expect(getComebackNotification(0.5)).toBeNull();
  });

  it('returns notification for 1 day absence', () => {
    const notif = getComebackNotification(1);
    expect(notif).not.toBeNull();
    expect(notif.type).toBe('comeback');
  });

  it('returns different message for 3+ days', () => {
    const notif = getComebackNotification(3);
    expect(notif).not.toBeNull();
    expect(notif.icon).toBe('🎁');
  });

  it('returns special message for 7+ days', () => {
    const notif = getComebackNotification(10);
    expect(notif).not.toBeNull();
    expect(notif.title).toContain('С возвращением');
  });
});

describe('getMilestoneNotification', () => {
  it('returns notification for habits milestone at 10', () => {
    const notif = getMilestoneNotification('habits', 10);
    expect(notif).not.toBeNull();
    expect(notif.type).toBe('milestone');
  });

  it('returns notification for xp milestone at 1000', () => {
    const notif = getMilestoneNotification('xp', 1000);
    expect(notif).not.toBeNull();
    expect(notif.title).toContain('1000');
  });

  it('returns null for non-milestone values', () => {
    expect(getMilestoneNotification('habits', 7)).toBeNull();
    expect(getMilestoneNotification('xp', 42)).toBeNull();
  });

  it('returns null for unknown type', () => {
    expect(getMilestoneNotification('unknown_type', 10)).toBeNull();
  });

  it('returns notification for focus milestone at 60', () => {
    const notif = getMilestoneNotification('focus', 60);
    expect(notif).not.toBeNull();
    expect(notif.type).toBe('milestone');
  });
});

// ============================================
// formatTimeRemaining / shouldShowUrgentPrompt
// ============================================
describe('formatTimeRemaining', () => {
  it('returns expired text for past timestamp', () => {
    expect(formatTimeRemaining(Date.now() - 1000)).toBe('Истекло');
  });

  it('returns hours and minutes for multi-hour remaining', () => {
    const twoHoursThirty = Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
    expect(formatTimeRemaining(twoHoursThirty)).toBe('2ч 30м');
  });

  it('returns minutes and seconds for sub-hour remaining', () => {
    const fiveMin = Date.now() + 5 * 60 * 1000 + 30 * 1000;
    expect(formatTimeRemaining(fiveMin)).toBe('5м 30с');
  });

  it('returns seconds only for sub-minute remaining', () => {
    const thirtySec = Date.now() + 30 * 1000;
    expect(formatTimeRemaining(thirtySec)).toBe('30с');
  });
});

describe('shouldShowUrgentPrompt', () => {
  it('returns true when less than 5 minutes remain', () => {
    const twoMin = Date.now() + 2 * 60 * 1000;
    expect(shouldShowUrgentPrompt(twoMin)).toBe(true);
  });

  it('returns false when more than 5 minutes remain', () => {
    const tenMin = Date.now() + 10 * 60 * 1000;
    expect(shouldShowUrgentPrompt(tenMin)).toBe(false);
  });

  it('returns false for already expired timestamp', () => {
    expect(shouldShowUrgentPrompt(Date.now() - 1000)).toBe(false);
  });

  it('returns true at exactly 4 minutes 59 seconds remaining', () => {
    const almostFive = Date.now() + 4 * 60 * 1000 + 59 * 1000;
    expect(shouldShowUrgentPrompt(almostFive)).toBe(true);
  });
});
