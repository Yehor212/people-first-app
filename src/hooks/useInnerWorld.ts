/**
 * useInnerWorld - Garden state management hook
 * Manages the growth of plants, creatures, and companion in the Inner World
 */

import { useCallback, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { useIndexedDB } from './useIndexedDB';
import { db } from '@/storage/db';
import { innerWorldSchema } from '@/lib/schemas';
import { generateId, getToday } from '@/lib/utils';
import { pushInnerWorldToCloud } from '@/storage/innerWorldCloudSync';
import { updateMyStreak } from '@/storage/friendsSync';
import {
  InnerWorld,
  GardenPlant,
  GardenCreature,
  PlantType,
  CreatureType,
  MoodType,
  TreatSource,
  TreatTransaction,
} from '@/types';
import { MOOD_COLORS } from '@/lib/innerWorldConstants';
import { calculateTreatsEarned } from '@/lib/treatConstants';
import {
  createDefaultInnerWorld,
  getCurrentSeason,
  getPlantStage,
  getCreatureStage,
  getGardenStage,
  getRandomPosition,
  getCompanionMood,
} from './innerWorldHelpers';
import { useRestMode } from './useRestMode';

// ============================================
// HOOK
// ============================================

export function useInnerWorld() {
  const [world, setWorld, isLoading] = useIndexedDB<InnerWorld>({
    table: db.settings,
    localStorageKey: 'zenflow-inner-world',
    initialValue: createDefaultInnerWorld(),
    idField: 'key',
    objectSchema: innerWorldSchema,
  });

  // Rest mode (extracted hook)
  const { isRestMode, restModeStatus, activateRestMode, deactivateRestMode } = useRestMode(world.restDays, setWorld);

  // Update season if needed
  // Use functional update to prevent stale closure
  useEffect(() => {
    const currentSeason = getCurrentSeason();
    if (world.season !== currentSeason) {
      setWorld(prev => ({ ...prev, season: currentSeason }));
    }
  }, [world.season, setWorld]);

  // Check for welcome back state
  // Use functional update to prevent stale closure
  useEffect(() => {
    if (isLoading) return;

    const today = getToday();
    if (world.lastActiveDate && world.lastActiveDate !== today) {
      const lastDate = new Date(world.lastActiveDate);
      const todayDate = new Date(today);
      const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 1) {
        // User was away - set supportive mode
        setWorld(prev => ({
          ...prev,
          companion: {
            ...prev.companion,
            mood: 'supportive',
          },
          pendingGrowth: {
            ...prev.pendingGrowth,
            companionMissedYou: true,
          },
        }));
      }
    }
  }, [isLoading, world.lastActiveDate, setWorld]);

  // Sync streak to friends profile when it changes
  useEffect(() => {
    if (isLoading || !world.currentActiveStreak) return;
    updateMyStreak(world.currentActiveStreak);
  }, [isLoading, world.currentActiveStreak]);

  // Cloud sync - push to Supabase when world changes (debounced)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (isLoading) return;

    // Debounce sync to avoid too many requests
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      pushInnerWorldToCloud(world).catch(err => logger.error('Failed to push inner world to cloud:', err));
    }, 5000); // Sync 5 seconds after last change

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [isLoading, world]);

  // Plant a new plant from an activity
  // Use functional update to prevent race conditions with stale world state
  const plantSeed = useCallback((
    sourceActivity: 'mood' | 'habit' | 'focus' | 'gratitude',
    mood?: MoodType
  ) => {
    const plantType: PlantType =
      sourceActivity === 'mood' ? 'flower' :
      sourceActivity === 'habit' ? 'tree' :
      sourceActivity === 'focus' ? 'crystal' : 'mushroom';

    const color = mood ? MOOD_COLORS[mood] : '#22c55e';
    const plantId = generateId();
    const plantedAt = Date.now();
    const today = getToday();
    const isSpecial = Math.random() < 0.05; // 5% chance of special

    let newPlantRef: GardenPlant | null = null;

    setWorld(prev => {
      const existingPositions = prev.plants.map(p => p.position);

      const newPlant: GardenPlant = {
        id: plantId,
        type: plantType,
        stage: 'seed',
        color,
        plantedAt,
        lastWateredAt: plantedAt,
        growthPoints: 0,
        position: getRandomPosition(existingPositions),
        sourceActivity,
        isSpecial,
      };
      newPlantRef = newPlant;

      const isNewDay = prev.lastActiveDate !== today;
      const newStreak = isNewDay
        ? (prev.lastActiveDate && new Date(today).getTime() - new Date(prev.lastActiveDate).getTime() < 2 * 24 * 60 * 60 * 1000
            ? prev.currentActiveStreak + 1
            : 1)
        : prev.currentActiveStreak;

      let newExperience = prev.companion.experience + 10;
      let newLevel = prev.companion.level;
      const xpNeeded = newLevel * 100;
      if (newExperience >= xpNeeded) {
        newLevel += 1;
        newExperience -= xpNeeded;
      }

      return {
        ...prev,
        plants: [...prev.plants, newPlant],
        totalPlantsGrown: prev.totalPlantsGrown + 1,
        gardenStage: getGardenStage(prev.totalPlantsGrown + 1),
        lastActiveDate: today,
        daysActive: isNewDay ? prev.daysActive + 1 : prev.daysActive,
        currentActiveStreak: newStreak,
        longestActiveStreak: Math.max(prev.longestActiveStreak, newStreak),
        companion: {
          ...prev.companion,
          mood: getCompanionMood({ ...prev, currentActiveStreak: newStreak, lastActiveDate: today }),
          experience: newExperience,
          level: newLevel,
        },
        pendingGrowth: {
          plantsToGrow: 0,
          creaturesArrived: 0,
          companionMissedYou: false,
        },
      };
    });

    return newPlantRef;
  }, [setWorld]);

  // Water plants (called when doing activities)
  // Use functional update to prevent race conditions
  const waterPlants = useCallback((sourceActivity: 'mood' | 'habit' | 'focus' | 'gratitude') => {
    const now = Date.now();
    setWorld(prev => ({
      ...prev,
      plants: prev.plants.map(plant => {
        if (plant.sourceActivity === sourceActivity) {
          const newGrowthPoints = plant.growthPoints + 5;
          return {
            ...plant,
            growthPoints: newGrowthPoints,
            stage: getPlantStage(newGrowthPoints),
            lastWateredAt: now,
          };
        }
        return plant;
      }),
    }));
  }, [setWorld]);

  // Attract a creature (from gratitude)
  // Use functional update to prevent race conditions
  const attractCreature = useCallback(() => {
    const creatureTypes: CreatureType[] = ['butterfly', 'bird', 'firefly', 'spirit'];
    const type = creatureTypes[Math.floor(Math.random() * creatureTypes.length)];
    const creatureId = generateId();
    const arrivedAt = Date.now();
    const isSpecial = Math.random() < 0.1; // 10% chance

    let newCreatureRef: GardenCreature | null = null;

    setWorld(prev => {
      const existingPositions = [
        ...prev.plants.map(p => p.position),
        ...prev.creatures.map(c => c.position),
      ];

      const newCreature: GardenCreature = {
        id: creatureId,
        type,
        stage: 'egg',
        color: '#fbbf24',
        arrivedAt,
        happiness: 0,
        position: getRandomPosition(existingPositions),
        isSpecial,
      };
      newCreatureRef = newCreature;

      return {
        ...prev,
        creatures: [...prev.creatures, newCreature],
        totalCreaturesAttracted: prev.totalCreaturesAttracted + 1,
      };
    });

    return newCreatureRef;
  }, [setWorld]);

  // Feed creatures (increases happiness)
  // Use functional update to prevent race conditions
  const feedCreatures = useCallback(() => {
    setWorld(prev => ({
      ...prev,
      creatures: prev.creatures.map(creature => {
        const newHappiness = Math.min(100, creature.happiness + 10);
        return {
          ...creature,
          happiness: newHappiness,
          stage: getCreatureStage(newHappiness),
        };
      }),
    }));
  }, [setWorld]);

  // ============================================
  // TREATS SYSTEM
  // ============================================

  // Earn treats from activities
  // Use functional update to prevent race conditions
  const earnTreats = useCallback((
    source: TreatSource,
    baseAmount: number,
    description?: string
  ) => {
    const transactionId = generateId();
    const now = Date.now();
    let result = { earned: 0, bonus: 0, multiplier: 1, newBalance: 0 };

    setWorld(prev => {
      const streakDays = prev.currentActiveStreak;
      const { total, bonus, multiplier } = calculateTreatsEarned(baseAmount, streakDays);

      const transaction: TreatTransaction = {
        id: transactionId,
        amount: total,
        source,
        timestamp: now,
        description: description || `${source} +${total}`,
      };

      // Keep only last 50 transactions
      const transactions = [transaction, ...(prev.treats?.transactions || [])].slice(0, 50);

      const newBalance = (prev.treats?.balance || 0) + total;
      result = { earned: total, bonus, multiplier, newBalance };

      return {
        ...prev,
        treats: {
          balance: newBalance,
          lifetimeEarned: (prev.treats?.lifetimeEarned || 0) + total,
          lifetimeSpent: prev.treats?.lifetimeSpent || 0,
          lastEarnedAt: now,
          transactions,
        },
      };
    });

    return result;
  }, [setWorld]);

  return {
    world,
    isLoading,

    // Treats system
    earnTreats,

    // Actions
    plantSeed,
    waterPlants,
    attractCreature,
    feedCreatures,

    // Rest mode
    isRestMode,
    activateRestMode,
    deactivateRestMode,
    canActivateRestMode: restModeStatus.canActivate,
    daysUntilRestAvailable: restModeStatus.daysUntilAvailable,
  };
}
