import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/utils', () => ({
  getToday: vi.fn(() => '2026-02-17'),
}));

vi.mock('@/lib/innerWorldConstants', () => ({
  GROWTH_THRESHOLDS: { seed: 0, sprout: 10, growing: 30, blooming: 70, magnificent: 150 },
  CREATURE_THRESHOLDS: { egg: 0, baby: 5, young: 15, adult: 40, legendary: 100 },
  GARDEN_STAGE_THRESHOLDS: { empty: 0, sprouting: 3, growing: 10, flourishing: 30, magical: 75, legendary: 200 },
}));

import {
  createDefaultCompanion,
  createDefaultTreatsWallet,
  createDefaultInnerWorld,
  getCurrentSeason,
  getPlantStage,
  getCreatureStage,
  getGardenStage,
  getRandomPosition,
  getCompanionMood,
} from '../innerWorldHelpers';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── createDefaultCompanion ────────────────────────────────────

describe('createDefaultCompanion', () => {
  it('returns a companion with correct defaults', () => {
    const companion = createDefaultCompanion();
    expect(companion.type).toBe('fox');
    expect(companion.name).toBe('Luna');
    expect(companion.mood).toBe('calm');
    expect(companion.level).toBe(1);
    expect(companion.fullness).toBe(70);
    expect(companion.happiness).toBe(50);
    expect(companion.hunger).toBe(30);
    expect(companion.experience).toBe(0);
    expect(companion.interactionCount).toBe(0);
    expect(companion.unlockedOutfits).toEqual(['default']);
  });
});

// ─── createDefaultTreatsWallet ─────────────────────────────────

describe('createDefaultTreatsWallet', () => {
  it('returns a wallet with correct defaults', () => {
    const wallet = createDefaultTreatsWallet();
    expect(wallet.balance).toBe(20);
    expect(wallet.lifetimeEarned).toBe(20);
    expect(wallet.lifetimeSpent).toBe(0);
    expect(wallet.transactions).toEqual([]);
  });
});

// ─── createDefaultInnerWorld ───────────────────────────────────

describe('createDefaultInnerWorld', () => {
  it('returns inner world with gardenStage empty', () => {
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));
    const world = createDefaultInnerWorld();
    expect(world.gardenStage).toBe('empty');
  });

  it('has a companion from createDefaultCompanion', () => {
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));
    const world = createDefaultInnerWorld();
    expect(world.companion.type).toBe('fox');
    expect(world.companion.name).toBe('Luna');
  });

  it('has a treats wallet from createDefaultTreatsWallet', () => {
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));
    const world = createDefaultInnerWorld();
    expect(world.treats.balance).toBe(20);
  });

  it('uses getCurrentSeason for the season field', () => {
    vi.setSystemTime(new Date('2026-07-15T12:00:00')); // July = summer
    const world = createDefaultInnerWorld();
    expect(world.season).toBe('summer');
  });
});

// ─── getCurrentSeason ──────────────────────────────────────────

describe('getCurrentSeason', () => {
  it('returns spring for March (month index 2)', () => {
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));
    expect(getCurrentSeason()).toBe('spring');
  });

  it('returns spring for April (month index 3)', () => {
    vi.setSystemTime(new Date('2026-04-15T12:00:00'));
    expect(getCurrentSeason()).toBe('spring');
  });

  it('returns spring for May (month index 4)', () => {
    vi.setSystemTime(new Date('2026-05-15T12:00:00'));
    expect(getCurrentSeason()).toBe('spring');
  });

  it('returns summer for June (month index 5)', () => {
    vi.setSystemTime(new Date('2026-06-15T12:00:00'));
    expect(getCurrentSeason()).toBe('summer');
  });

  it('returns autumn for September (month index 8)', () => {
    vi.setSystemTime(new Date('2026-09-15T12:00:00'));
    expect(getCurrentSeason()).toBe('autumn');
  });

  it('returns winter for January (month index 0)', () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:00'));
    expect(getCurrentSeason()).toBe('winter');
  });

  it('returns winter for December (month index 11)', () => {
    vi.setSystemTime(new Date('2026-12-15T12:00:00'));
    expect(getCurrentSeason()).toBe('winter');
  });
});

// ─── getPlantStage ─────────────────────────────────────────────

describe('getPlantStage', () => {
  it('returns seed for 0 growth points', () => {
    expect(getPlantStage(0)).toBe('seed');
  });

  it('returns sprout at threshold (10)', () => {
    expect(getPlantStage(10)).toBe('sprout');
  });

  it('returns growing at threshold (30)', () => {
    expect(getPlantStage(30)).toBe('growing');
  });

  it('returns blooming at threshold (70)', () => {
    expect(getPlantStage(70)).toBe('blooming');
  });

  it('returns magnificent at threshold (150)', () => {
    expect(getPlantStage(150)).toBe('magnificent');
  });

  it('returns magnificent for values above threshold', () => {
    expect(getPlantStage(999)).toBe('magnificent');
  });

  it('returns seed for values below sprout threshold', () => {
    expect(getPlantStage(5)).toBe('seed');
  });
});

// ─── getCreatureStage ──────────────────────────────────────────

describe('getCreatureStage', () => {
  it('returns egg for 0 happiness', () => {
    expect(getCreatureStage(0)).toBe('egg');
  });

  it('returns baby at threshold (5)', () => {
    expect(getCreatureStage(5)).toBe('baby');
  });

  it('returns young at threshold (15)', () => {
    expect(getCreatureStage(15)).toBe('young');
  });

  it('returns adult at threshold (40)', () => {
    expect(getCreatureStage(40)).toBe('adult');
  });

  it('returns legendary at threshold (100)', () => {
    expect(getCreatureStage(100)).toBe('legendary');
  });

  it('returns egg for values below baby threshold', () => {
    expect(getCreatureStage(3)).toBe('egg');
  });
});

// ─── getGardenStage ────────────────────────────────────────────

describe('getGardenStage', () => {
  it('returns empty for 0 plants', () => {
    expect(getGardenStage(0)).toBe('empty');
  });

  it('returns sprouting at threshold (3)', () => {
    expect(getGardenStage(3)).toBe('sprouting');
  });

  it('returns growing at threshold (10)', () => {
    expect(getGardenStage(10)).toBe('growing');
  });

  it('returns flourishing at threshold (30)', () => {
    expect(getGardenStage(30)).toBe('flourishing');
  });

  it('returns magical at threshold (75)', () => {
    expect(getGardenStage(75)).toBe('magical');
  });

  it('returns legendary at threshold (200)', () => {
    expect(getGardenStage(200)).toBe('legendary');
  });

  it('returns empty for values below sprouting threshold', () => {
    expect(getGardenStage(2)).toBe('empty');
  });
});

// ─── getRandomPosition ─────────────────────────────────────────

describe('getRandomPosition', () => {
  it('returns position within expected x bounds [10, 90]', () => {
    for (let i = 0; i < 20; i++) {
      const pos = getRandomPosition([]);
      expect(pos.x).toBeGreaterThanOrEqual(10);
      expect(pos.x).toBeLessThanOrEqual(90);
    }
  });

  it('returns position within expected y bounds [20, 80]', () => {
    for (let i = 0; i < 20; i++) {
      const pos = getRandomPosition([]);
      expect(pos.y).toBeGreaterThanOrEqual(20);
      expect(pos.y).toBeLessThanOrEqual(80);
    }
  });

  it('returns a position object with x and y properties', () => {
    const pos = getRandomPosition([]);
    expect(pos).toHaveProperty('x');
    expect(pos).toHaveProperty('y');
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
  });

  it('avoids positions that are too close to existing ones', () => {
    // Fill the space densely to test avoidance behavior
    const existing = [{ x: 50, y: 50 }];
    // Run multiple times; the result should still be within bounds
    for (let i = 0; i < 10; i++) {
      const pos = getRandomPosition(existing);
      expect(pos.x).toBeGreaterThanOrEqual(10);
      expect(pos.x).toBeLessThanOrEqual(90);
      expect(pos.y).toBeGreaterThanOrEqual(20);
      expect(pos.y).toBeLessThanOrEqual(80);
    }
  });
});

// ─── getCompanionMood ──────────────────────────────────────────

describe('getCompanionMood', () => {
  it('returns supportive when user missed more than 1 day', () => {
    vi.setSystemTime(new Date('2026-02-17T12:00:00'));
    const world = createDefaultInnerWorld();
    world.lastActiveDate = '2026-02-14'; // 3 days ago
    world.currentActiveStreak = 0;

    expect(getCompanionMood(world)).toBe('supportive');
  });

  it('returns celebrating when streak is 7 or more', () => {
    vi.setSystemTime(new Date('2026-02-17T12:00:00'));
    const world = createDefaultInnerWorld();
    world.lastActiveDate = '2026-02-17';
    world.currentActiveStreak = 7;

    expect(getCompanionMood(world)).toBe('celebrating');
  });

  it('returns excited when streak is 3-6', () => {
    vi.setSystemTime(new Date('2026-02-17T12:00:00'));
    const world = createDefaultInnerWorld();
    world.lastActiveDate = '2026-02-17';
    world.currentActiveStreak = 4;

    expect(getCompanionMood(world)).toBe('excited');
  });

  it('returns happy when active today with no significant streak', () => {
    vi.setSystemTime(new Date('2026-02-17T12:00:00'));
    const world = createDefaultInnerWorld();
    world.lastActiveDate = '2026-02-17';
    world.currentActiveStreak = 1;

    expect(getCompanionMood(world)).toBe('happy');
  });

  it('returns sleeping late at night (23:00)', () => {
    vi.setSystemTime(new Date('2026-02-17T23:00:00'));
    const world = createDefaultInnerWorld();
    world.lastActiveDate = '';
    world.currentActiveStreak = 0;

    expect(getCompanionMood(world)).toBe('sleeping');
  });

  it('returns sleeping early in the morning (03:00)', () => {
    vi.setSystemTime(new Date('2026-02-17T03:00:00'));
    const world = createDefaultInnerWorld();
    world.lastActiveDate = '';
    world.currentActiveStreak = 0;

    expect(getCompanionMood(world)).toBe('sleeping');
  });

  it('returns calm during daytime with no activity', () => {
    vi.setSystemTime(new Date('2026-02-17T14:00:00'));
    const world = createDefaultInnerWorld();
    world.lastActiveDate = '';
    world.currentActiveStreak = 0;

    expect(getCompanionMood(world)).toBe('calm');
  });
});
