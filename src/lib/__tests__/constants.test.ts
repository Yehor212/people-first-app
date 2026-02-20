import { describe, it, expect } from 'vitest';

import {
  TIMING,
  TASK_DEFAULTS,
  GAMIFICATION,
  SPIN_WHEEL,
  TIME_BOUNDARIES,
  UI,
  Z_INDEX,
  LIMITS,
  MODAL_SIZES,
  ANIMATION,
} from '@/lib/constants';

// ─── TIMING ─────────────────────────────────────────────────────

describe('TIMING', () => {
  it('has correct keys', () => {
    const expectedKeys = [
      'INTERVAL_CHECK',
      'TOAST_DURATION',
      'SPIN_ANIMATION_DURATION',
      'MOMENTUM_TIMEOUT',
      'CELEBRATION_DURATION',
      'DEBOUNCE_DELAY',
      'AUTO_SAVE_INTERVAL',
    ];
    expectedKeys.forEach((key) => {
      expect(TIMING).toHaveProperty(key);
    });
  });

  it('all values are positive numbers', () => {
    Object.values(TIMING).forEach((value) => {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    });
  });
});

// ─── TASK_DEFAULTS ──────────────────────────────────────────────

describe('TASK_DEFAULTS', () => {
  it('has valid min/max/base values', () => {
    expect(TASK_DEFAULTS.MIN_DURATION).toBeGreaterThan(0);
    expect(TASK_DEFAULTS.MAX_DURATION).toBeGreaterThan(TASK_DEFAULTS.MIN_DURATION);
    expect(TASK_DEFAULTS.DURATION_MINUTES).toBeGreaterThanOrEqual(TASK_DEFAULTS.MIN_DURATION);
    expect(TASK_DEFAULTS.DURATION_MINUTES).toBeLessThanOrEqual(TASK_DEFAULTS.MAX_DURATION);
    expect(TASK_DEFAULTS.BASE_XP).toBeGreaterThan(0);
    expect(TASK_DEFAULTS.MIN_INTEREST).toBeGreaterThan(0);
    expect(TASK_DEFAULTS.MAX_INTEREST).toBeGreaterThan(TASK_DEFAULTS.MIN_INTEREST);
    expect(TASK_DEFAULTS.INTEREST_LEVEL).toBeGreaterThanOrEqual(TASK_DEFAULTS.MIN_INTEREST);
    expect(TASK_DEFAULTS.INTEREST_LEVEL).toBeLessThanOrEqual(TASK_DEFAULTS.MAX_INTEREST);
  });
});

// ─── GAMIFICATION ───────────────────────────────────────────────

describe('GAMIFICATION', () => {
  it('has streak milestones sorted in ascending order', () => {
    const milestones = GAMIFICATION.STREAK_MILESTONES;
    for (let i = 1; i < milestones.length; i++) {
      expect(milestones[i]).toBeGreaterThan(milestones[i - 1]);
    }
  });

  it('has positive XP values', () => {
    expect(GAMIFICATION.HABIT_BASE_XP).toBeGreaterThan(0);
    expect(GAMIFICATION.MOOD_XP).toBeGreaterThan(0);
    expect(GAMIFICATION.GRATITUDE_XP).toBeGreaterThan(0);
    expect(GAMIFICATION.FOCUS_XP_PER_MINUTE).toBeGreaterThan(0);
  });
});

// ─── SPIN_WHEEL ─────────────────────────────────────────────────

describe('SPIN_WHEEL', () => {
  it('MIN_ROTATIONS < MIN_ROTATIONS + MAX_EXTRA_ROTATIONS', () => {
    expect(SPIN_WHEEL.MIN_ROTATIONS).toBeLessThan(
      SPIN_WHEEL.MIN_ROTATIONS + SPIN_WHEEL.MAX_EXTRA_ROTATIONS
    );
  });
});

// ─── TIME_BOUNDARIES ────────────────────────────────────────────

describe('TIME_BOUNDARIES', () => {
  it('morning < afternoon < evening', () => {
    expect(TIME_BOUNDARIES.MORNING_START).toBeLessThan(TIME_BOUNDARIES.AFTERNOON_START);
    expect(TIME_BOUNDARIES.AFTERNOON_START).toBeLessThan(TIME_BOUNDARIES.EVENING_START);
  });
});

// ─── UI ─────────────────────────────────────────────────────────

describe('UI', () => {
  it('has minimum touch target >= 44 (accessibility)', () => {
    expect(UI.MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44);
  });
});

// ─── Z_INDEX ────────────────────────────────────────────────────

describe('Z_INDEX', () => {
  it('layers are in ascending order: DROPDOWN < STICKY < OVERLAY < MODAL < TOAST < CELEBRATION', () => {
    expect(Z_INDEX.DROPDOWN).toBeLessThan(Z_INDEX.STICKY);
    expect(Z_INDEX.STICKY).toBeLessThan(Z_INDEX.OVERLAY);
    expect(Z_INDEX.OVERLAY).toBeLessThan(Z_INDEX.MODAL);
    expect(Z_INDEX.MODAL).toBeLessThan(Z_INDEX.TOAST);
    expect(Z_INDEX.TOAST).toBeLessThan(Z_INDEX.CELEBRATION);
  });
});

// ─── LIMITS ─────────────────────────────────────────────────────

describe('LIMITS', () => {
  it('max values are positive', () => {
    Object.values(LIMITS).forEach((value) => {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    });
  });
});

// ─── MODAL_SIZES ────────────────────────────────────────────────

describe('MODAL_SIZES', () => {
  it('has all expected sizes', () => {
    expect(MODAL_SIZES).toHaveProperty('SM');
    expect(MODAL_SIZES).toHaveProperty('MD');
    expect(MODAL_SIZES).toHaveProperty('LG');
    expect(MODAL_SIZES).toHaveProperty('XL');
    expect(MODAL_SIZES).toHaveProperty('FULL');
  });
});

// ─── ANIMATION ──────────────────────────────────────────────────

describe('ANIMATION', () => {
  it('has valid CSS duration strings', () => {
    expect(ANIMATION.FAST).toMatch(/^\d+ms$/);
    expect(ANIMATION.NORMAL).toMatch(/^\d+ms$/);
    expect(ANIMATION.SLOW).toMatch(/^\d+ms$/);
  });

  it('FAST <= NORMAL <= SLOW', () => {
    const fast = parseInt(ANIMATION.FAST);
    const normal = parseInt(ANIMATION.NORMAL);
    const slow = parseInt(ANIMATION.SLOW);
    expect(fast).toBeLessThanOrEqual(normal);
    expect(normal).toBeLessThanOrEqual(slow);
  });
});
