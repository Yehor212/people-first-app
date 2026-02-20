/**
 * Achievement → Garden Decoration mapping (IA Blueprint Phase 4.3)
 *
 * Unlocking achievements adds permanent decorations to the garden.
 * Pure functions — no React dependency.
 */

import type { AchievementId } from './gamification';

export interface GardenDecoration {
  id: string;
  type: DecorationCategory;
  name: string;
  icon: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export type DecorationCategory =
  | 'furniture'  // bench, table
  | 'path'       // stone path, flower path
  | 'area'       // zen garden, training area
  | 'biome'      // crystal cave, cherry blossom grove
  | 'accessory'; // companion outfits

/**
 * Maps achievement IDs to garden decorations.
 * Returns null if achievement has no decoration.
 */
const DECORATION_MAP: Partial<Record<AchievementId, GardenDecoration>> = {
  first_mood: {
    id: 'deco_bench',
    type: 'furniture',
    name: 'Garden Bench',
    icon: '🪑',
    description: 'A cozy bench appeared in your garden',
    rarity: 'common',
  },
  first_habit: {
    id: 'deco_lantern',
    type: 'furniture',
    name: 'Garden Lantern',
    icon: '🏮',
    description: 'A warm lantern lights your path',
    rarity: 'common',
  },
  first_focus: {
    id: 'deco_fountain',
    type: 'furniture',
    name: 'Focus Fountain',
    icon: '⛲',
    description: 'A gentle fountain brings clarity',
    rarity: 'common',
  },
  first_gratitude: {
    id: 'deco_birdhouse',
    type: 'furniture',
    name: 'Birdhouse',
    icon: '🏠',
    description: 'Grateful hearts attract birds',
    rarity: 'common',
  },
  streak_7: {
    id: 'deco_stone_path',
    type: 'path',
    name: 'Stone Path',
    icon: '🪨',
    description: 'A stone path grows through your garden',
    rarity: 'rare',
  },
  streak_30: {
    id: 'deco_flower_arch',
    type: 'path',
    name: 'Flower Arch',
    icon: '🌸',
    description: 'A beautiful flower arch marks your dedication',
    rarity: 'epic',
  },
  habit_master: {
    id: 'deco_training_area',
    type: 'area',
    name: 'Training Area',
    icon: '🎯',
    description: 'A training area for you and your companion',
    rarity: 'epic',
  },
  zen_master: {
    id: 'deco_zen_garden',
    type: 'area',
    name: 'Zen Garden',
    icon: '🪷',
    description: 'A peaceful zen garden area unlocks',
    rarity: 'legendary',
  },
  focus_warrior: {
    id: 'deco_crystal_cave',
    type: 'biome',
    name: 'Crystal Cave',
    icon: '💎',
    description: 'A shimmering crystal cave appears',
    rarity: 'epic',
  },
  consistency_king: {
    id: 'deco_cherry_grove',
    type: 'biome',
    name: 'Cherry Blossom Grove',
    icon: '🌸',
    description: 'An eternal cherry blossom grove blooms',
    rarity: 'legendary',
  },
  wellness_warrior: {
    id: 'deco_rainbow_bridge',
    type: 'biome',
    name: 'Rainbow Bridge',
    icon: '🌈',
    description: 'A rainbow bridge connects all areas of your garden',
    rarity: 'legendary',
  },
};

/**
 * Returns the decoration unlocked by a given achievement, or null.
 */
export function getDecorationForAchievement(achievementId: AchievementId): GardenDecoration | null {
  return DECORATION_MAP[achievementId] ?? null;
}

/**
 * Returns all decorations unlocked by the given achievement IDs.
 */
export function getUnlockedDecorations(achievementIds: AchievementId[]): GardenDecoration[] {
  return achievementIds
    .map(id => DECORATION_MAP[id])
    .filter((d): d is GardenDecoration => d != null);
}

/**
 * Returns decoration IDs that should be in the garden
 * based on unlocked achievements.
 */
export function computeGardenDecorationIds(achievementIds: AchievementId[]): string[] {
  return getUnlockedDecorations(achievementIds).map(d => d.id);
}
