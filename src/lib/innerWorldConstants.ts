/**
 * Inner World Constants - Emojis and thresholds for the garden system
 * Separated to avoid circular dependencies
 */

import {
  PlantType,
  PlantStage,
  CreatureType,
  CreatureStage,
  CompanionType,
  GardenStage,
  MoodType,
} from '@/types';

// ============================================
// GROWTH THRESHOLDS
// ============================================

export const GROWTH_THRESHOLDS: Record<PlantStage, number> = {
  seed: 0,
  sprout: 10,
  growing: 30,
  blooming: 70,
  magnificent: 150,
};

export const CREATURE_THRESHOLDS: Record<CreatureStage, number> = {
  egg: 0,
  baby: 5,
  young: 15,
  adult: 40,
  legendary: 100,
};

export const GARDEN_STAGE_THRESHOLDS: Record<GardenStage, number> = {
  empty: 0,
  sprouting: 3,
  growing: 10,
  flourishing: 30,
  magical: 75,
  legendary: 200,
};

// ============================================
// MOOD COLORS
// ============================================

export const MOOD_COLORS: Record<MoodType, string> = {
  great: '#a855f7',
  good: '#22c55e',
  okay: '#3b82f6',
  bad: '#6366f1',
  terrible: '#8b5cf6',
};

// ============================================
// EMOJIS
// ============================================

export const PLANT_EMOJIS: Record<PlantType, Record<PlantStage, string>> = {
  flower: {
    seed: '🌱',
    sprout: '🌿',
    growing: '🌷',
    blooming: '🌸',
    magnificent: '🌺',
  },
  tree: {
    seed: '🌰',
    sprout: '🌱',
    growing: '🪴',
    blooming: '🌳',
    magnificent: '🌲',
  },
  crystal: {
    seed: '✨',
    sprout: '💎',
    growing: '💠',
    blooming: '🔮',
    magnificent: '🌟',
  },
  mushroom: {
    seed: '🟤',
    sprout: '🍄',
    growing: '🍄',
    blooming: '🪷',
    magnificent: '✨',
  },
};

export const CREATURE_EMOJIS: Record<CreatureType, Record<CreatureStage, string>> = {
  butterfly: {
    egg: '🥚',
    baby: '🐛',
    young: '🦋',
    adult: '🦋',
    legendary: '✨🦋✨',
  },
  bird: {
    egg: '🥚',
    baby: '🐣',
    young: '🐤',
    adult: '🐦',
    legendary: '🦜',
  },
  firefly: {
    egg: '✨',
    baby: '💫',
    young: '⭐',
    adult: '🌟',
    legendary: '💫🌟💫',
  },
  spirit: {
    egg: '👻',
    baby: '🫧',
    young: '💨',
    adult: '🌀',
    legendary: '🌌',
  },
};

export const COMPANION_EMOJIS: Record<CompanionType, string> = {
  fox: '🦊',
  cat: '🐱',
  owl: '🦉',
  rabbit: '🐰',
  dragon: '🐲',
};
