import { describe, it, expect } from 'vitest';
import {
  badgeDefinitions,
  getBadgeById,
  getBadgesByCategory,
  getUnlockedBadges,
  getRarityColor,
  getRarityGradient,
} from '../badges';
import type { Badge } from '@/types';

const LANGUAGES = ['en', 'uk', 'es', 'de', 'fr', 'ja', 'ar', 'he'] as const;
const VALID_CATEGORIES = ['streak', 'focus', 'gratitude', 'habit', 'special'] as const;
const VALID_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

// ─── badgeDefinitions ──────────────────────────────────────────

describe('badgeDefinitions', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(badgeDefinitions)).toBe(true);
    expect(badgeDefinitions.length).toBeGreaterThan(0);
  });

  it('every badge has id', () => {
    badgeDefinitions.forEach((badge) => {
      expect(badge.id).toBeDefined();
      expect(typeof badge.id).toBe('string');
      expect(badge.id.length).toBeGreaterThan(0);
    });
  });

  it('every badge has category', () => {
    badgeDefinitions.forEach((badge) => {
      expect(badge.category).toBeDefined();
    });
  });

  it('every badge has icon', () => {
    badgeDefinitions.forEach((badge) => {
      expect(badge.icon).toBeDefined();
      expect(typeof badge.icon).toBe('string');
    });
  });

  it('every badge has title and description', () => {
    badgeDefinitions.forEach((badge) => {
      expect(badge.title).toBeDefined();
      expect(badge.description).toBeDefined();
    });
  });

  it('every badge has requirement as a number', () => {
    badgeDefinitions.forEach((badge) => {
      expect(typeof badge.requirement).toBe('number');
      expect(badge.requirement).toBeGreaterThan(0);
    });
  });

  it('every badge has rarity', () => {
    badgeDefinitions.forEach((badge) => {
      expect(badge.rarity).toBeDefined();
    });
  });

  it('all badge IDs are unique', () => {
    const ids = badgeDefinitions.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all badges have unlocked=false by default', () => {
    badgeDefinitions.forEach((badge) => {
      expect(badge.unlocked).toBe(false);
    });
  });

  it('all badges have valid categories only', () => {
    badgeDefinitions.forEach((badge) => {
      expect(VALID_CATEGORIES).toContain(badge.category);
    });
  });

  it('all badges have valid rarities only', () => {
    badgeDefinitions.forEach((badge) => {
      expect(VALID_RARITIES).toContain(badge.rarity);
    });
  });
});

// ─── Title/Description i18n ──────────────────────────────────────

describe('badge i18n', () => {
  it('every badge title has all 8 language keys', () => {
    badgeDefinitions.forEach((badge) => {
      LANGUAGES.forEach((lang) => {
        expect(badge.title[lang]).toBeDefined();
        expect(typeof badge.title[lang]).toBe('string');
        expect(badge.title[lang].length).toBeGreaterThan(0);
      });
    });
  });

  it('every badge description has all 8 language keys', () => {
    badgeDefinitions.forEach((badge) => {
      LANGUAGES.forEach((lang) => {
        expect(badge.description[lang]).toBeDefined();
        expect(typeof badge.description[lang]).toBe('string');
        expect(badge.description[lang].length).toBeGreaterThan(0);
      });
    });
  });
});

// ─── getBadgeById ────────────────────────────────────────────────

describe('getBadgeById', () => {
  it('finds an existing badge by id', () => {
    const badge = getBadgeById('badge_streak_7');
    expect(badge).toBeDefined();
    expect(badge).toHaveProperty('id', 'badge_streak_7');
  });

  it('returns undefined for an unknown id', () => {
    expect(getBadgeById('nonexistent_badge')).toBeUndefined();
  });

  it('returns the correct badge object', () => {
    const badge = getBadgeById('badge_focus_300');
    expect(badge).toBeDefined();
    expect(badge).toHaveProperty('category', 'focus');
    expect(badge).toHaveProperty('rarity', 'common');
  });
});

// ─── getBadgesByCategory ─────────────────────────────────────────

describe('getBadgesByCategory', () => {
  it.each(VALID_CATEGORIES)('returns non-empty array for category "%s"', (category) => {
    const badges = getBadgesByCategory(category);
    expect(badges.length).toBeGreaterThan(0);
    badges.forEach((b) => expect(b.category).toBe(category));
  });

  it('returns empty array for unknown category', () => {
    const badges = getBadgesByCategory('nonexistent' as any);
    expect(badges).toEqual([]);
  });

  it('returned badges all belong to the requested category', () => {
    const streakBadges = getBadgesByCategory('streak');
    streakBadges.forEach((b) => {
      expect(b.category).toBe('streak');
    });
  });
});

// ─── getUnlockedBadges ───────────────────────────────────────────

describe('getUnlockedBadges', () => {
  it('returns empty array when none are unlocked', () => {
    const result = getUnlockedBadges(badgeDefinitions);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(getUnlockedBadges([])).toEqual([]);
  });

  it('filters correctly when some are unlocked', () => {
    const badges: Badge[] = [
      { ...badgeDefinitions[0], unlocked: true },
      { ...badgeDefinitions[1], unlocked: false },
      { ...badgeDefinitions[2], unlocked: true },
    ];
    const result = getUnlockedBadges(badges);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(badgeDefinitions[0].id);
    expect(result[1].id).toBe(badgeDefinitions[2].id);
  });

  it('returns all when all are unlocked', () => {
    const badges: Badge[] = badgeDefinitions.map((b) => ({ ...b, unlocked: true }));
    const result = getUnlockedBadges(badges);
    expect(result).toHaveLength(badgeDefinitions.length);
  });
});

// ─── getRarityColor ──────────────────────────────────────────────

describe('getRarityColor', () => {
  it('returns a string for "common"', () => {
    const color = getRarityColor('common');
    expect(typeof color).toBe('string');
    expect(color).toContain('gray');
  });

  it('returns a string for "rare"', () => {
    const color = getRarityColor('rare');
    expect(typeof color).toBe('string');
    expect(color).toContain('blue');
  });

  it('returns a string for "epic"', () => {
    const color = getRarityColor('epic');
    expect(typeof color).toBe('string');
    expect(color).toContain('purple');
  });

  it('returns a string for "legendary"', () => {
    const color = getRarityColor('legendary');
    expect(typeof color).toBe('string');
    expect(color).toContain('yellow');
  });

  it('returns gray fallback for unknown rarity', () => {
    const color = getRarityColor('mythical' as any);
    expect(color).toContain('gray');
  });
});

// ─── getRarityGradient ───────────────────────────────────────────

describe('getRarityGradient', () => {
  it('returns a gradient string for "common"', () => {
    const gradient = getRarityGradient('common');
    expect(typeof gradient).toBe('string');
    expect(gradient).toContain('gray');
  });

  it('returns a gradient string for "rare"', () => {
    const gradient = getRarityGradient('rare');
    expect(typeof gradient).toBe('string');
    expect(gradient).toContain('blue');
  });

  it('returns a gradient string for "epic"', () => {
    const gradient = getRarityGradient('epic');
    expect(typeof gradient).toBe('string');
    expect(gradient).toContain('purple');
  });

  it('returns a gradient string for "legendary"', () => {
    const gradient = getRarityGradient('legendary');
    expect(typeof gradient).toBe('string');
    expect(gradient).toContain('yellow');
  });

  it('returns gray gradient for unknown rarity', () => {
    const gradient = getRarityGradient('mythical' as any);
    expect(gradient).toContain('gray');
  });
});
