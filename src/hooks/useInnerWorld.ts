/**
 * useInnerWorld - Garden state management hook
 * Manages the growth of plants, creatures, and companion in the Inner World
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { useIndexedDB } from './useIndexedDB';
import { db } from '@/storage/db';
import { generateId, getToday } from '@/lib/utils';
import { pushInnerWorldToCloud } from '@/storage/innerWorldCloudSync';
import { updateMyStreak } from '@/storage/friendsSync';
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
  GardenStage,
  Season,
  MoodType,
  TreatsWallet,
  TreatSource,
  TreatTransaction,
} from '@/types';
import {
  GROWTH_THRESHOLDS,
  CREATURE_THRESHOLDS,
  GARDEN_STAGE_THRESHOLDS,
  MOOD_COLORS,
} from '@/lib/innerWorldConstants';
import { calculateTreatsEarned } from '@/lib/treatConstants';

// ============================================
// DEFAULT STATE
// ============================================

const createDefaultCompanion = (): Companion => ({
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

const createDefaultTreatsWallet = (): TreatsWallet => ({
  balance: 20,              // Start with some treats to try feeding
  lifetimeEarned: 20,
  lifetimeSpent: 0,
  lastEarnedAt: Date.now(),
  transactions: [],
});

const createDefaultInnerWorld = (): InnerWorld => ({
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

  // ============================================
  // REST MODE (with cooldown: max 1 day per 7 days)
  // ============================================

  const today = getToday();
  const REST_COOLDOWN_DAYS = 7; // 1 rest day allowed per 7 days

  // Check if today is a rest day
  const isRestMode = useMemo(() => {
    return (world.restDays || []).includes(today);
  }, [world.restDays, today]);

  // Calculate rest mode availability
  const restModeStatus = useMemo(() => {
    const restDays = world.restDays || [];
    const todayDate = new Date(today);

    // Find rest days in the last 7 days (excluding today)
    const recentRestDays = restDays.filter(d => {
      if (d === today) return false;
      const dayDate = new Date(d);
      const diffMs = todayDate.getTime() - dayDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays < REST_COOLDOWN_DAYS;
    });

    const canActivate = recentRestDays.length === 0;

    // Calculate days until rest is available again
    let daysUntilAvailable = 0;
    if (!canActivate && recentRestDays.length > 0) {
      const mostRecentRest = recentRestDays.sort().reverse()[0];
      const restDate = new Date(mostRecentRest);
      const availableDate = new Date(restDate.getTime() + REST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      daysUntilAvailable = Math.ceil((availableDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      canActivate,
      daysUntilAvailable,
      usedThisWeek: recentRestDays.length,
    };
  }, [world.restDays, today]);

  // Activate rest mode for today - preserves streak
  const activateRestMode = useCallback(() => {
    const restDays = world.restDays || [];
    if (restDays.includes(today)) return { success: false, reason: 'already_resting' };
    if (!restModeStatus.canActivate) return { success: false, reason: 'cooldown', daysUntilAvailable: restModeStatus.daysUntilAvailable };

    // Update lastActiveDate to today to prevent streak from breaking
    setWorld(prev => ({
      ...prev,
      restDays: [...(prev.restDays || []), today],
      lastActiveDate: today, // Important: mark today as "active" to preserve streak
    }));

    return { success: true };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setWorld, today, restModeStatus]);

  // Deactivate rest mode for today
  const deactivateRestMode = useCallback(() => {
    setWorld(prev => ({
      ...prev,
      restDays: (prev.restDays || []).filter(d => d !== today),
    }));
  }, [setWorld, today]);

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
