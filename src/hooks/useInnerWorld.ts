/**
 * useInnerWorld - Garden state management hook
 * Manages the growth of plants, creatures, and companion in the Inner World
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useIndexedDB } from './useIndexedDB';
import { db } from '@/storage/db';
import { generateId, getToday } from '@/lib/utils';
import {
  InnerWorld,
  GardenPlant,
  GardenCreature,
  Companion,
  PlantType,
  PlantStage,
  CreatureType,
  CreatureStage,
  CompanionMood,
  CompanionType,
  GardenStage,
  GardenWeather,
  Season,
  MoodType,
} from '@/types';
import {
  GROWTH_THRESHOLDS,
  CREATURE_THRESHOLDS,
  GARDEN_STAGE_THRESHOLDS,
  MOOD_COLORS,
  PLANT_EMOJIS,
  CREATURE_EMOJIS,
  COMPANION_EMOJIS,
} from '@/lib/innerWorldConstants';

// Re-export constants for backward compatibility
export { COMPANION_EMOJIS, PLANT_EMOJIS, CREATURE_EMOJIS } from '@/lib/innerWorldConstants';

// ============================================
// DEFAULT STATE
// ============================================

const createDefaultCompanion = (): Companion => ({
  type: 'fox',
  name: 'Луна',
  mood: 'calm',
  level: 1,
  experience: 0,
  unlockedOutfits: ['default'],
  lastInteraction: Date.now(),
  personality: {
    energy: 50,
    wisdom: 50,
    warmth: 70,
  },
});

const createDefaultInnerWorld = (): InnerWorld => ({
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
});

// ============================================
// HELPERS
// ============================================

function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

function getPlantStage(growthPoints: number): PlantStage {
  if (growthPoints >= GROWTH_THRESHOLDS.magnificent) return 'magnificent';
  if (growthPoints >= GROWTH_THRESHOLDS.blooming) return 'blooming';
  if (growthPoints >= GROWTH_THRESHOLDS.growing) return 'growing';
  if (growthPoints >= GROWTH_THRESHOLDS.sprout) return 'sprout';
  return 'seed';
}

function getCreatureStage(happiness: number): CreatureStage {
  if (happiness >= CREATURE_THRESHOLDS.legendary) return 'legendary';
  if (happiness >= CREATURE_THRESHOLDS.adult) return 'adult';
  if (happiness >= CREATURE_THRESHOLDS.young) return 'young';
  if (happiness >= CREATURE_THRESHOLDS.baby) return 'baby';
  return 'egg';
}

function getGardenStage(totalPlants: number): GardenStage {
  if (totalPlants >= GARDEN_STAGE_THRESHOLDS.legendary) return 'legendary';
  if (totalPlants >= GARDEN_STAGE_THRESHOLDS.magical) return 'magical';
  if (totalPlants >= GARDEN_STAGE_THRESHOLDS.flourishing) return 'flourishing';
  if (totalPlants >= GARDEN_STAGE_THRESHOLDS.growing) return 'growing';
  if (totalPlants >= GARDEN_STAGE_THRESHOLDS.sprouting) return 'sprouting';
  return 'empty';
}

function getRandomPosition(existingPositions: Array<{ x: number; y: number }>): { x: number; y: number } {
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

function getCompanionMood(world: InnerWorld): CompanionMood {
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

// ============================================
// HOOK
// ============================================

export function useInnerWorld() {
  const [world, setWorld, isLoading] = useIndexedDB<InnerWorld>({
    table: db.settings,
    localStorageKey: 'zenflow-inner-world',
    initialValue: createDefaultInnerWorld(),
    idField: 'key',
  });

  // Update season if needed
  useEffect(() => {
    const currentSeason = getCurrentSeason();
    if (world.season !== currentSeason) {
      setWorld({ ...world, season: currentSeason });
    }
  }, [world.season]);

  // Check for welcome back state
  useEffect(() => {
    if (isLoading) return;

    const today = getToday();
    if (world.lastActiveDate && world.lastActiveDate !== today) {
      const lastDate = new Date(world.lastActiveDate);
      const todayDate = new Date(today);
      const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 1) {
        // User was away - set supportive mode
        setWorld({
          ...world,
          companion: {
            ...world.companion,
            mood: 'supportive',
          },
          pendingGrowth: {
            ...world.pendingGrowth,
            companionMissedYou: true,
          },
        });
      }
    }
  }, [isLoading, world.lastActiveDate]);

  // Plant a new plant from an activity
  const plantSeed = useCallback((
    sourceActivity: 'mood' | 'habit' | 'focus' | 'gratitude',
    mood?: MoodType
  ) => {
    const plantType: PlantType =
      sourceActivity === 'mood' ? 'flower' :
      sourceActivity === 'habit' ? 'tree' :
      sourceActivity === 'focus' ? 'crystal' : 'mushroom';

    const color = mood ? MOOD_COLORS[mood] : '#22c55e';
    const existingPositions = world.plants.map(p => p.position);

    const newPlant: GardenPlant = {
      id: generateId(),
      type: plantType,
      stage: 'seed',
      color,
      plantedAt: Date.now(),
      lastWateredAt: Date.now(),
      growthPoints: 0,
      position: getRandomPosition(existingPositions),
      sourceActivity,
      isSpecial: Math.random() < 0.05, // 5% chance of special
    };

    const today = getToday();
    const isNewDay = world.lastActiveDate !== today;
    const newStreak = isNewDay
      ? (world.lastActiveDate && new Date(today).getTime() - new Date(world.lastActiveDate).getTime() < 2 * 24 * 60 * 60 * 1000
          ? world.currentActiveStreak + 1
          : 1)
      : world.currentActiveStreak;

    const updatedWorld: InnerWorld = {
      ...world,
      plants: [...world.plants, newPlant],
      totalPlantsGrown: world.totalPlantsGrown + 1,
      gardenStage: getGardenStage(world.totalPlantsGrown + 1),
      lastActiveDate: today,
      daysActive: isNewDay ? world.daysActive + 1 : world.daysActive,
      currentActiveStreak: newStreak,
      longestActiveStreak: Math.max(world.longestActiveStreak, newStreak),
      companion: {
        ...world.companion,
        mood: getCompanionMood({ ...world, currentActiveStreak: newStreak, lastActiveDate: today }),
        experience: world.companion.experience + 10,
      },
      pendingGrowth: {
        plantsToGrow: 0,
        creaturesArrived: 0,
        companionMissedYou: false,
      },
    };

    // Level up companion if enough XP
    const xpNeeded = updatedWorld.companion.level * 100;
    if (updatedWorld.companion.experience >= xpNeeded) {
      updatedWorld.companion.level += 1;
      updatedWorld.companion.experience -= xpNeeded;
    }

    setWorld(updatedWorld);
    return newPlant;
  }, [world, setWorld]);

  // Water plants (called when doing activities)
  const waterPlants = useCallback((sourceActivity: 'mood' | 'habit' | 'focus' | 'gratitude') => {
    const updatedPlants = world.plants.map(plant => {
      if (plant.sourceActivity === sourceActivity) {
        const newGrowthPoints = plant.growthPoints + 5;
        return {
          ...plant,
          growthPoints: newGrowthPoints,
          stage: getPlantStage(newGrowthPoints),
          lastWateredAt: Date.now(),
        };
      }
      return plant;
    });

    setWorld({
      ...world,
      plants: updatedPlants,
    });
  }, [world, setWorld]);

  // Attract a creature (from gratitude)
  const attractCreature = useCallback(() => {
    const creatureTypes: CreatureType[] = ['butterfly', 'bird', 'firefly', 'spirit'];
    const type = creatureTypes[Math.floor(Math.random() * creatureTypes.length)];
    const existingPositions = [
      ...world.plants.map(p => p.position),
      ...world.creatures.map(c => c.position),
    ];

    const newCreature: GardenCreature = {
      id: generateId(),
      type,
      stage: 'egg',
      color: '#fbbf24',
      arrivedAt: Date.now(),
      happiness: 0,
      position: getRandomPosition(existingPositions),
      isSpecial: Math.random() < 0.1, // 10% chance
    };

    setWorld({
      ...world,
      creatures: [...world.creatures, newCreature],
      totalCreaturesAttracted: world.totalCreaturesAttracted + 1,
    });

    return newCreature;
  }, [world, setWorld]);

  // Feed creatures (increases happiness)
  const feedCreatures = useCallback(() => {
    const updatedCreatures = world.creatures.map(creature => {
      const newHappiness = Math.min(100, creature.happiness + 10);
      return {
        ...creature,
        happiness: newHappiness,
        stage: getCreatureStage(newHappiness),
      };
    });

    setWorld({
      ...world,
      creatures: updatedCreatures,
    });
  }, [world, setWorld]);

  // Change companion
  const setCompanionType = useCallback((type: CompanionType) => {
    setWorld({
      ...world,
      companion: {
        ...world.companion,
        type,
      },
    });
  }, [world, setWorld]);

  // Rename companion
  const renameCompanion = useCallback((name: string) => {
    setWorld({
      ...world,
      companion: {
        ...world.companion,
        name,
      },
    });
  }, [world, setWorld]);

  // Clear welcome back state
  const clearWelcomeBack = useCallback(() => {
    setWorld({
      ...world,
      pendingGrowth: {
        plantsToGrow: 0,
        creaturesArrived: 0,
        companionMissedYou: false,
      },
    });
  }, [world, setWorld]);

  // Computed values
  const gardenStats = useMemo(() => ({
    totalPlants: world.plants.length,
    bloomingPlants: world.plants.filter(p => p.stage === 'blooming' || p.stage === 'magnificent').length,
    totalCreatures: world.creatures.length,
    happyCreatures: world.creatures.filter(c => c.happiness >= 50).length,
    companionLevel: world.companion.level,
    daysActive: world.daysActive,
    currentStreak: world.currentActiveStreak,
  }), [world]);

  return {
    world,
    isLoading,

    // Actions
    plantSeed,
    waterPlants,
    attractCreature,
    feedCreatures,
    setCompanionType,
    renameCompanion,
    clearWelcomeBack,

    // Stats
    gardenStats,

    // Helpers
    getPlantEmoji: (plant: GardenPlant) => PLANT_EMOJIS[plant.type][plant.stage],
    getCreatureEmoji: (creature: GardenCreature) => CREATURE_EMOJIS[creature.type][creature.stage],
    getCompanionEmoji: () => COMPANION_EMOJIS[world.companion.type],
  };
}
