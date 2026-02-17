/**
 * innerWorldHelpers - Default state factories and helper functions
 * for the Inner World garden system.
 *
 * Extracted from useInnerWorld.ts to keep each module under 400 LOC.
 */

import { getToday } from '@/lib/utils';
import {
  InnerWorld,
  Companion,
  PlantStage,
  CreatureStage,
  CompanionMood,
  GardenStage,
  Season,
  TreatsWallet,
} from '@/types';
import {
  GROWTH_THRESHOLDS,
  CREATURE_THRESHOLDS,
  GARDEN_STAGE_THRESHOLDS,
} from '@/lib/innerWorldConstants';

// ============================================
// DEFAULT STATE
// ============================================

export const createDefaultCompanion = (): Companion => ({
  type: 'fox',
  name: 'Luna',
  mood: 'calm',
  level: 1,
  experience: 0,
  unlockedOutfits: ['default'],
  lastInteraction: Date.now(),
  lastPetTime: undefined,
  lastFeedTime: undefined,
  interactionCount: 0,
  fullness: 70,           // New simplified stat (0-100)
  happiness: 50,          // Legacy - derived from fullness
  hunger: 30,             // Legacy - derived from fullness (100 - fullness)
  personality: {
    energy: 50,
    wisdom: 50,
    warmth: 70,
  },
});

export const createDefaultTreatsWallet = (): TreatsWallet => ({
  balance: 20,              // Start with some treats to try feeding
  lifetimeEarned: 20,
  lifetimeSpent: 0,
  lastEarnedAt: Date.now(),
  transactions: [],
});

export const createDefaultInnerWorld = (): InnerWorld => ({
  treats: createDefaultTreatsWallet(),
  gardenStage: 'empty',
  plants: [],
  creatures: [],
  weather: 'sunny',
  season: getCurrentSeason(),
  companion: createDefaultCompanion(),
  totalPlantsGrown: 0,
  totalCreaturesAttracted: 0,
  daysActive: 0,
  longestActiveStreak: 0,
  currentActiveStreak: 0,
  lastActiveDate: '',
  unlockedBackgrounds: ['meadow'],
  unlockedDecorations: [],
  currentBackground: 'meadow',
  decorations: [],
  seasonalItemsCollected: [],
  pendingGrowth: {
    plantsToGrow: 0,
    creaturesArrived: 0,
    companionMissedYou: false,
  },
  restDays: [],
});

// ============================================
// HELPERS
// ============================================

export function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

export function getPlantStage(growthPoints: number): PlantStage {
  if (growthPoints >= GROWTH_THRESHOLDS.magnificent) return 'magnificent';
  if (growthPoints >= GROWTH_THRESHOLDS.blooming) return 'blooming';
  if (growthPoints >= GROWTH_THRESHOLDS.growing) return 'growing';
  if (growthPoints >= GROWTH_THRESHOLDS.sprout) return 'sprout';
  return 'seed';
}

export function getCreatureStage(happiness: number): CreatureStage {
  if (happiness >= CREATURE_THRESHOLDS.legendary) return 'legendary';
  if (happiness >= CREATURE_THRESHOLDS.adult) return 'adult';
  if (happiness >= CREATURE_THRESHOLDS.young) return 'young';
  if (happiness >= CREATURE_THRESHOLDS.baby) return 'baby';
  return 'egg';
}

export function getGardenStage(totalPlants: number): GardenStage {
  if (totalPlants >= GARDEN_STAGE_THRESHOLDS.legendary) return 'legendary';
  if (totalPlants >= GARDEN_STAGE_THRESHOLDS.magical) return 'magical';
  if (totalPlants >= GARDEN_STAGE_THRESHOLDS.flourishing) return 'flourishing';
  if (totalPlants >= GARDEN_STAGE_THRESHOLDS.growing) return 'growing';
  if (totalPlants >= GARDEN_STAGE_THRESHOLDS.sprouting) return 'sprouting';
  return 'empty';
}

export function getRandomPosition(existingPositions: Array<{ x: number; y: number }>): { x: number; y: number } {
  let attempts = 0;
  while (attempts < 50) {
    const x = Math.random() * 80 + 10; // 10-90
    const y = Math.random() * 60 + 20; // 20-80

    // Check if too close to existing
    const tooClose = existingPositions.some(
      pos => Math.abs(pos.x - x) < 10 && Math.abs(pos.y - y) < 10
    );

    if (!tooClose) return { x, y };
    attempts++;
  }
  return { x: Math.random() * 80 + 10, y: Math.random() * 60 + 20 };
}

export function getCompanionMood(world: InnerWorld): CompanionMood {
  const today = getToday();
  const isActive = world.lastActiveDate === today;
  const streak = world.currentActiveStreak;

  if (!isActive && world.lastActiveDate) {
    // Check if missed days
    const lastDate = new Date(world.lastActiveDate);
    const todayDate = new Date(today);
    const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 1) return 'supportive'; // Welcome back mode
  }

  if (streak >= 7) return 'celebrating';
  if (streak >= 3) return 'excited';
  if (isActive) return 'happy';

  const hour = new Date().getHours();
  if (hour >= 22 || hour < 6) return 'sleeping';

  return 'calm';
}
