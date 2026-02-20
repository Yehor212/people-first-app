import { describe, it, expect } from 'vitest';
import {
  getDecorationForAchievement,
  getUnlockedDecorations,
  computeGardenDecorationIds,
} from '@/lib/achievementDecorations';
import type { AchievementId } from '@/lib/gamification';

describe('getDecorationForAchievement', () => {
  it('returns the bench decoration for first_mood', () => {
    const decoration = getDecorationForAchievement('first_mood');
    expect(decoration).not.toBeNull();
    expect(decoration?.id).toBe('deco_bench');
    expect(decoration?.type).toBe('furniture');
    expect(decoration?.name).toBe('Garden Bench');
    expect(decoration?.rarity).toBe('common');
  });

  it('returns the zen garden decoration for zen_master with legendary rarity', () => {
    const decoration = getDecorationForAchievement('zen_master');
    expect(decoration).not.toBeNull();
    expect(decoration?.id).toBe('deco_zen_garden');
    expect(decoration?.type).toBe('area');
    expect(decoration?.name).toBe('Zen Garden');
    expect(decoration?.rarity).toBe('legendary');
  });

  it('returns null for an achievement that has no decoration mapping', () => {
    // Cast to AchievementId to simulate an ID that is valid but unmapped
    const result = getDecorationForAchievement('mood_week' as AchievementId);
    expect(result).toBeNull();
  });

  it('returns the lantern decoration for first_habit', () => {
    const decoration = getDecorationForAchievement('first_habit');
    expect(decoration).not.toBeNull();
    expect(decoration?.id).toBe('deco_lantern');
    expect(decoration?.rarity).toBe('common');
  });

  it('returns the fountain decoration for first_focus', () => {
    const decoration = getDecorationForAchievement('first_focus');
    expect(decoration).not.toBeNull();
    expect(decoration?.id).toBe('deco_fountain');
  });

  it('returns the birdhouse decoration for first_gratitude', () => {
    const decoration = getDecorationForAchievement('first_gratitude');
    expect(decoration).not.toBeNull();
    expect(decoration?.id).toBe('deco_birdhouse');
  });

  it('returns a stone path decoration for streak_7 with rare rarity', () => {
    const decoration = getDecorationForAchievement('streak_7');
    expect(decoration).not.toBeNull();
    expect(decoration?.id).toBe('deco_stone_path');
    expect(decoration?.rarity).toBe('rare');
  });

  it('returns an epic flower arch for streak_30', () => {
    const decoration = getDecorationForAchievement('streak_30');
    expect(decoration).not.toBeNull();
    expect(decoration?.id).toBe('deco_flower_arch');
    expect(decoration?.rarity).toBe('epic');
  });

  it('returns the crystal cave biome for focus_warrior', () => {
    const decoration = getDecorationForAchievement('focus_warrior');
    expect(decoration).not.toBeNull();
    expect(decoration?.id).toBe('deco_crystal_cave');
    expect(decoration?.type).toBe('biome');
    expect(decoration?.rarity).toBe('epic');
  });

  it('returns the cherry grove biome for consistency_king with legendary rarity', () => {
    const decoration = getDecorationForAchievement('consistency_king');
    expect(decoration).not.toBeNull();
    expect(decoration?.id).toBe('deco_cherry_grove');
    expect(decoration?.type).toBe('biome');
    expect(decoration?.rarity).toBe('legendary');
  });

  it('returns the rainbow bridge biome for wellness_warrior with legendary rarity', () => {
    const decoration = getDecorationForAchievement('wellness_warrior');
    expect(decoration).not.toBeNull();
    expect(decoration?.id).toBe('deco_rainbow_bridge');
    expect(decoration?.type).toBe('biome');
    expect(decoration?.rarity).toBe('legendary');
  });
});

describe('getUnlockedDecorations', () => {
  it('returns an array of decorations for multiple achievements', () => {
    const decorations = getUnlockedDecorations(['first_mood', 'first_habit', 'streak_7']);
    expect(decorations).toHaveLength(3);
    const ids = decorations.map(d => d.id);
    expect(ids).toContain('deco_bench');
    expect(ids).toContain('deco_lantern');
    expect(ids).toContain('deco_stone_path');
  });

  it('filters out achievements that have no decoration mapping', () => {
    const decorations = getUnlockedDecorations([
      'first_mood',
      'unmapped_achievement' as AchievementId,
      'zen_master',
    ]);
    expect(decorations).toHaveLength(2);
    const ids = decorations.map(d => d.id);
    expect(ids).toContain('deco_bench');
    expect(ids).toContain('deco_zen_garden');
  });

  it('returns an empty array when given an empty achievement list', () => {
    const decorations = getUnlockedDecorations([]);
    expect(decorations).toEqual([]);
  });

  it('returns an empty array when all achievements are unmapped', () => {
    const decorations = getUnlockedDecorations([
      'unknown_a' as AchievementId,
      'unknown_b' as AchievementId,
    ]);
    expect(decorations).toEqual([]);
  });

  it('returns a single decoration for a single mapped achievement', () => {
    const decorations = getUnlockedDecorations(['habit_master']);
    expect(decorations).toHaveLength(1);
    expect(decorations[0].id).toBe('deco_training_area');
  });

  it('returns all eleven mapped decorations when all achievement ids are provided', () => {
    const all: AchievementId[] = [
      'first_mood',
      'first_habit',
      'first_focus',
      'first_gratitude',
      'streak_7',
      'streak_30',
      'habit_master',
      'zen_master',
      'focus_warrior',
      'consistency_king',
      'wellness_warrior',
    ];
    const decorations = getUnlockedDecorations(all);
    expect(decorations).toHaveLength(11);
  });

  it('returns GardenDecoration objects with all expected fields', () => {
    const [decoration] = getUnlockedDecorations(['first_mood']);
    expect(decoration).toHaveProperty('id');
    expect(decoration).toHaveProperty('type');
    expect(decoration).toHaveProperty('name');
    expect(decoration).toHaveProperty('icon');
    expect(decoration).toHaveProperty('description');
    expect(decoration).toHaveProperty('rarity');
  });
});

describe('computeGardenDecorationIds', () => {
  it('returns an array of string IDs for mapped achievements', () => {
    const ids = computeGardenDecorationIds(['first_mood', 'zen_master']);
    expect(ids).toEqual(['deco_bench', 'deco_zen_garden']);
  });

  it('returns only string IDs, filtering out unmapped achievements', () => {
    const ids = computeGardenDecorationIds([
      'first_mood',
      'no_such_achievement' as AchievementId,
    ]);
    expect(ids).toEqual(['deco_bench']);
  });

  it('returns an empty array for empty input', () => {
    const ids = computeGardenDecorationIds([]);
    expect(ids).toEqual([]);
  });

  it('returns an empty array when all achievements are unmapped', () => {
    const ids = computeGardenDecorationIds(['ghost' as AchievementId]);
    expect(ids).toEqual([]);
  });

  it('returns IDs in the same order as the input achievements', () => {
    const ids = computeGardenDecorationIds(['streak_7', 'first_focus', 'first_habit']);
    expect(ids).toEqual(['deco_stone_path', 'deco_fountain', 'deco_lantern']);
  });

  it('returns all eleven decoration IDs when all mapped achievements are provided', () => {
    const all: AchievementId[] = [
      'first_mood',
      'first_habit',
      'first_focus',
      'first_gratitude',
      'streak_7',
      'streak_30',
      'habit_master',
      'zen_master',
      'focus_warrior',
      'consistency_king',
      'wellness_warrior',
    ];
    const ids = computeGardenDecorationIds(all);
    expect(ids).toHaveLength(11);
    expect(ids.every(id => typeof id === 'string')).toBe(true);
  });
});
