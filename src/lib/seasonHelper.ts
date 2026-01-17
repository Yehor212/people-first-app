/**
 * Season Helper - Utilities for seasonal theming
 *
 * Determines current season based on date and provides
 * color palettes for the Seasonal Tree component.
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Get current season based on the month
 * Northern hemisphere seasons:
 * - Spring: March-May (3-5)
 * - Summer: June-August (6-8)
 * - Autumn: September-November (9-11)
 * - Winter: December-February (12, 1, 2)
 */
export function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1; // 1-12

  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/**
 * Get emoji representation of season
 */
export function getSeasonEmoji(season: Season): string {
  const emojis: Record<Season, string> = {
    spring: '🌸',
    summer: '☀️',
    autumn: '🍂',
    winter: '❄️',
  };
  return emojis[season];
}

/**
 * Get localized season name
 */
export function getSeasonName(season: Season, language: string): string {
  const names: Record<Season, Record<string, string>> = {
    spring: {
      en: 'Spring',
      ru: 'Весна',
      uk: 'Весна',
      es: 'Primavera',
      de: 'Frühling',
      fr: 'Printemps',
    },
    summer: {
      en: 'Summer',
      ru: 'Лето',
      uk: 'Літо',
      es: 'Verano',
      de: 'Sommer',
      fr: 'Été',
    },
    autumn: {
      en: 'Autumn',
      ru: 'Осень',
      uk: 'Осінь',
      es: 'Otoño',
      de: 'Herbst',
      fr: 'Automne',
    },
    winter: {
      en: 'Winter',
      ru: 'Зима',
      uk: 'Зима',
      es: 'Invierno',
      de: 'Winter',
      fr: 'Hiver',
    },
  };
  return names[season][language] || names[season].en;
}

/**
 * Season color palette for UI theming
 */
export interface SeasonColors {
  primary: string;      // Main color (leaves/flowers)
  secondary: string;    // Secondary color
  accent: string;       // Accent/highlight color
  background: string;   // Background gradient start
  backgroundEnd: string; // Background gradient end
  particle: string;     // Falling particle color
}

export function getSeasonColors(season: Season): SeasonColors {
  const colors: Record<Season, SeasonColors> = {
    spring: {
      primary: '#FFB7C5',      // Sakura pink
      secondary: '#98D982',    // Light green
      accent: '#FFF0F5',       // Lavender blush
      background: '#FFF5F8',   // Light pink
      backgroundEnd: '#F0FFF0', // Honeydew
      particle: '#FFB7C5',     // Pink petals
    },
    summer: {
      primary: '#228B22',      // Forest green
      secondary: '#90EE90',    // Light green
      accent: '#FFD700',       // Gold (sun)
      background: '#F0FFF0',   // Honeydew
      backgroundEnd: '#E0FFFF', // Light cyan
      particle: '#90EE90',     // Light green leaves
    },
    autumn: {
      primary: '#FF6B35',      // Orange
      secondary: '#8B4513',    // Saddle brown
      accent: '#FFD93D',       // Yellow
      background: '#FFF8DC',   // Cornsilk
      backgroundEnd: '#FAEBD7', // Antique white
      particle: '#FF6B35',     // Orange leaves
    },
    winter: {
      primary: '#E8E8E8',      // Silver
      secondary: '#87CEEB',    // Sky blue
      accent: '#FFFFFF',       // White
      background: '#F0F8FF',   // Alice blue
      backgroundEnd: '#E6E6FA', // Lavender
      particle: '#FFFFFF',     // White snowflakes
    },
  };
  return colors[season];
}

/**
 * Tree stage names (1-5)
 */
export type TreeStage = 1 | 2 | 3 | 4 | 5;

export function getTreeStageName(stage: TreeStage, language: string): string {
  const names: Record<TreeStage, Record<string, string>> = {
    1: {
      en: 'Seed',
      ru: 'Семечко',
      uk: 'Насіння',
      es: 'Semilla',
      de: 'Samen',
      fr: 'Graine',
    },
    2: {
      en: 'Sprout',
      ru: 'Росток',
      uk: 'Паросток',
      es: 'Brote',
      de: 'Spross',
      fr: 'Pousse',
    },
    3: {
      en: 'Sapling',
      ru: 'Саженец',
      uk: 'Саджанець',
      es: 'Plantón',
      de: 'Schössling',
      fr: 'Jeune arbre',
    },
    4: {
      en: 'Tree',
      ru: 'Дерево',
      uk: 'Дерево',
      es: 'Árbol',
      de: 'Baum',
      fr: 'Arbre',
    },
    5: {
      en: 'Great Tree',
      ru: 'Великое дерево',
      uk: 'Велике дерево',
      es: 'Gran Árbol',
      de: 'Großer Baum',
      fr: 'Grand Arbre',
    },
  };
  return names[stage][language] || names[stage].en;
}

/**
 * XP required for each tree stage
 */
export const TREE_STAGE_XP: Record<TreeStage, number> = {
  1: 0,      // Start
  2: 100,    // Sprout
  3: 300,    // Sapling
  4: 700,    // Tree
  5: 1500,   // Great Tree
};

/**
 * Get tree stage from XP
 */
export function getTreeStageFromXP(xp: number): TreeStage {
  if (xp >= TREE_STAGE_XP[5]) return 5;
  if (xp >= TREE_STAGE_XP[4]) return 4;
  if (xp >= TREE_STAGE_XP[3]) return 3;
  if (xp >= TREE_STAGE_XP[2]) return 2;
  return 1;
}

/**
 * Get XP progress to next stage (0-100%)
 */
export function getXPProgressToNextStage(xp: number, currentStage: TreeStage): number {
  if (currentStage === 5) return 100; // Max stage

  const currentThreshold = TREE_STAGE_XP[currentStage];
  const nextThreshold = TREE_STAGE_XP[(currentStage + 1) as TreeStage];
  const xpInStage = xp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;

  return Math.min(100, Math.round((xpInStage / xpNeeded) * 100));
}
