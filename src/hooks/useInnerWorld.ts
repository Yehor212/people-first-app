/**
 * useInnerWorld - Garden state management hook
 * Manages the growth of plants, creatures, and companion in the Inner World
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { useIndexedDB } from './useIndexedDB';
import { db } from '@/storage/db';
import { generateId, getToday } from '@/lib/utils';
import { pushInnerWorldToCloud } from '@/storage/innerWorldCloudSync';
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
  TreatsWallet,
  TreatSource,
  TreatTransaction,
  TreeStage,
} from '@/types';
import { getTreeStageFromXP, TREE_STAGE_XP } from '@/lib/seasonHelper';
import {
  GROWTH_THRESHOLDS,
  CREATURE_THRESHOLDS,
  GARDEN_STAGE_THRESHOLDS,
  MOOD_COLORS,
  PLANT_EMOJIS,
  CREATURE_EMOJIS,
  COMPANION_EMOJIS,
} from '@/lib/innerWorldConstants';
import {
  TREAT_REWARDS,
  COMPANION_COSTS,
  COMPANION_LEVELING,
  FULLNESS_DECAY,
  calculateTreatsEarned,
} from '@/lib/treatConstants';

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
  // NEW: Seasonal Tree System
  treeStage: 1 as TreeStage,    // Start as seed
  waterLevel: 70,               // Start with some water
  lastWateredAt: Date.now(),    // Just watered
  lastTouchTime: undefined,     // P1 Fix: Separate cooldown for tree touch
  treeXP: 0,                    // No XP yet
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
  // P1 Fix: Use functional update to prevent stale closure
  useEffect(() => {
    const currentSeason = getCurrentSeason();
    if (world.season !== currentSeason) {
      setWorld(prev => ({ ...prev, season: currentSeason }));
    }
  }, [world.season, setWorld]);

  // Check for welcome back state
  // P1 Fix: Use functional update to prevent stale closure
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

  // Water decay effect - reduces water level over time
  // P1 Fix: Use functional update to prevent stale closure
  useEffect(() => {
    if (isLoading) return;

    const DECAY_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
    const DECAY_RATE = 2; // -2% per hour

    const checkWaterDecay = () => {
      setWorld(prev => {
        const lastWateredAt = prev.companion.lastWateredAt || Date.now();
        const hoursSinceWatered = (Date.now() - lastWateredAt) / (1000 * 60 * 60);
        const expectedDecay = Math.floor(hoursSinceWatered) * DECAY_RATE;
        const expectedWaterLevel = Math.max(0, 100 - expectedDecay);

        // Only update if water level needs adjustment
        if (prev.companion.waterLevel > expectedWaterLevel) {
          return {
            ...prev,
            companion: {
              ...prev.companion,
              waterLevel: expectedWaterLevel,
            },
          };
        }
        return prev; // No change needed
      });
    };

    // Check immediately on load
    checkWaterDecay();

    // Set up interval for periodic checks
    const interval = setInterval(checkWaterDecay, DECAY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isLoading, setWorld]);

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
  // P0 Fix: Use functional update to prevent race conditions with stale world state
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
  // P0 Fix: Use functional update to prevent race conditions
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
  // P0 Fix: Use functional update to prevent race conditions
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
  // P0 Fix: Use functional update to prevent race conditions
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

  // Change companion
  // P0 Fix: Use functional update to prevent race conditions
  const setCompanionType = useCallback((type: CompanionType) => {
    setWorld(prev => ({
      ...prev,
      companion: {
        ...prev.companion,
        type,
      },
    }));
  }, [setWorld]);

  // Rename companion
  // P0 Fix: Use functional update to prevent race conditions
  const renameCompanion = useCallback((name: string) => {
    setWorld(prev => ({
      ...prev,
      companion: {
        ...prev.companion,
        name,
      },
    }));
  }, [setWorld]);

  // Clear welcome back state
  // P0 Fix: Use functional update to prevent race conditions
  const clearWelcomeBack = useCallback(() => {
    setWorld(prev => ({
      ...prev,
      pendingGrowth: {
        plantsToGrow: 0,
        creaturesArrived: 0,
        companionMissedYou: false,
      },
    }));
  }, [setWorld]);

  // ============================================
  // TREATS SYSTEM
  // ============================================

  // Earn treats from activities
  // P0 Fix: Use functional update to prevent race conditions
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

  // Spend treats (e.g., to feed companion)
  // P0 Fix: Use functional update to prevent race conditions
  // P1 Fix: Removed world.treats?.balance from deps - functional update handles this
  const spendTreats = useCallback((amount: number, purpose: string): boolean => {
    let success = false;
    const transactionId = generateId();
    const now = Date.now();

    setWorld(prev => {
      const currentBalance = prev.treats?.balance || 0;
      if (currentBalance < amount) {
        success = false;
        return prev; // Not enough treats - don't update
      }

      success = true;
      const transaction: TreatTransaction = {
        id: transactionId,
        amount: -amount,
        source: 'mood',
        timestamp: now,
        description: purpose,
      };

      const transactions = [transaction, ...(prev.treats?.transactions || [])].slice(0, 50);

      return {
        ...prev,
        treats: {
          ...prev.treats!,
          balance: currentBalance - amount,
          lifetimeSpent: (prev.treats?.lifetimeSpent || 0) + amount,
          transactions,
        },
      };
    });

    return success;
  }, [setWorld]);

  // ============================================
  // COMPANION INTERACTIONS
  // ============================================

  // Pet the companion - FREE action, small XP gain, shows love
  // P1 Fix: Use functional update to prevent stale closure race conditions
  const petCompanion = useCallback(() => {
    const now = Date.now();
    let result = { xpGain: 0, canPetAgain: false, leveledUp: false, newLevel: 0 };

    setWorld(prev => {
      const timeSinceLastPet = prev.companion.lastPetTime
        ? now - prev.companion.lastPetTime
        : Infinity;

      // Cooldown for full effect (1 minute)
      const canPetAgain = timeSinceLastPet > COMPANION_COSTS.pet.cooldownMs;
      const xpGain = canPetAgain ? COMPANION_COSTS.pet.xpGain : 2;

      // Calculate level up
      let newExperience = prev.companion.experience + xpGain;
      let newLevel = prev.companion.level;
      const xpNeeded = COMPANION_LEVELING.xpPerLevel(newLevel);

      if (newExperience >= xpNeeded) {
        newLevel += 1;
        newExperience -= xpNeeded;
      }

      result = {
        xpGain,
        canPetAgain,
        leveledUp: newLevel > prev.companion.level,
        newLevel,
      };

      return {
        ...prev,
        companion: {
          ...prev.companion,
          lastPetTime: now,
          lastInteraction: now,
          interactionCount: (prev.companion.interactionCount || 0) + 1,
          experience: newExperience,
          level: newLevel,
        },
      };
    });

    return result;
  }, [setWorld]);

  // Feed the companion - COSTS TREATS, increases fullness and XP
  // P1 Fix: Use functional update to prevent stale closure race conditions
  const feedCompanion = useCallback(() => {
    const now = Date.now();
    const treatCost = COMPANION_COSTS.feed.treatCost;
    let result: {
      success: boolean;
      reason?: string;
      needed?: number;
      have?: number;
      fullnessGain: number;
      xpGain: number;
      treatCost?: number;
      newBalance?: number;
      leveledUp?: boolean;
      newLevel?: number;
    } = { success: false, fullnessGain: 0, xpGain: 0 };

    setWorld(prev => {
      const currentBalance = prev.treats?.balance || 0;

      // Check if enough treats
      if (currentBalance < treatCost) {
        result = {
          success: false,
          reason: 'not_enough_treats',
          needed: treatCost,
          have: currentBalance,
          fullnessGain: 0,
          xpGain: 0,
        };
        return prev; // No state change
      }

      const fullnessGain = COMPANION_COSTS.feed.fullnessGain;
      const xpGain = COMPANION_COSTS.feed.xpGain;

      // Update fullness and derive hunger from it
      const newFullness = Math.min(100, (prev.companion.fullness || 50) + fullnessGain);
      const newHunger = 100 - newFullness; // Inverse relationship
      const newHappiness = Math.min(100, Math.max(30, newFullness)); // Happiness linked to fullness

      // Deduct treats
      const transaction: TreatTransaction = {
        id: generateId(),
        amount: -treatCost,
        source: 'mood',
        timestamp: now,
        description: 'Feed companion',
      };
      const transactions = [transaction, ...(prev.treats?.transactions || [])].slice(0, 50);

      // Calculate level up
      let newExperience = prev.companion.experience + xpGain;
      let newLevel = prev.companion.level;
      const xpNeeded = COMPANION_LEVELING.xpPerLevel(newLevel);

      if (newExperience >= xpNeeded) {
        newLevel += 1;
        newExperience -= xpNeeded;
      }

      result = {
        success: true,
        fullnessGain,
        xpGain,
        treatCost,
        newBalance: currentBalance - treatCost,
        leveledUp: newLevel > prev.companion.level,
        newLevel,
      };

      return {
        ...prev,
        treats: {
          ...prev.treats!,
          balance: currentBalance - treatCost,
          lifetimeSpent: (prev.treats?.lifetimeSpent || 0) + treatCost,
          transactions,
        },
        companion: {
          ...prev.companion,
          fullness: newFullness,
          hunger: newHunger,
          happiness: newHappiness,
          lastFeedTime: now,
          lastInteraction: now,
          interactionCount: (prev.companion.interactionCount || 0) + 1,
          experience: newExperience,
          level: newLevel,
          mood: newHappiness >= 80 ? 'excited' : newHappiness >= 50 ? 'happy' : 'calm',
        },
      };
    });

    return result;
  }, [setWorld]);

  // ============================================
  // SEASONAL TREE INTERACTIONS
  // ============================================

  // Tree costs
  const TREE_COSTS = {
    water: {
      treatCost: 10,      // 10 treats to water
      waterGain: 30,      // +30 water level
      xpGain: 50,         // +50 XP towards tree growth
    },
    touch: {
      xpGain: 10,         // Free +10 XP
      cooldownMs: 60000,  // 1 minute cooldown for full effect
    },
  };

  // Water the tree - COSTS TREATS, increases water level and XP
  // P1 Fix: Use functional update to prevent stale closure race conditions
  const waterTree = useCallback(() => {
    const now = Date.now();
    const treatCost = TREE_COSTS.water.treatCost;
    let result: {
      success: boolean;
      reason?: string;
      needed?: number;
      have?: number;
      waterGain: number;
      xpGain: number;
      treatCost?: number;
      newBalance?: number;
      newWaterLevel?: number;
      newTreeXP?: number;
      stageUp?: boolean;
      newStage?: number;
    } = { success: false, waterGain: 0, xpGain: 0 };

    setWorld(prev => {
      const currentBalance = prev.treats?.balance || 0;

      // Check if enough treats
      if (currentBalance < treatCost) {
        result = {
          success: false,
          reason: 'not_enough_treats',
          needed: treatCost,
          have: currentBalance,
          waterGain: 0,
          xpGain: 0,
        };
        return prev; // No state change
      }

      const waterGain = TREE_COSTS.water.waterGain;
      const xpGain = TREE_COSTS.water.xpGain;

      // Update water level and XP
      const newWaterLevel = Math.min(100, (prev.companion.waterLevel || 0) + waterGain);
      const newTreeXP = (prev.companion.treeXP || 0) + xpGain;
      const newTreeStage = getTreeStageFromXP(newTreeXP);

      // Deduct treats
      const transaction: TreatTransaction = {
        id: generateId(),
        amount: -treatCost,
        source: 'mood',
        timestamp: now,
        description: 'Water tree',
      };
      const transactions = [transaction, ...(prev.treats?.transactions || [])].slice(0, 50);

      const stageUp = newTreeStage > (prev.companion.treeStage || 1);

      result = {
        success: true,
        waterGain,
        xpGain,
        treatCost,
        newBalance: currentBalance - treatCost,
        newWaterLevel,
        newTreeXP,
        stageUp,
        newStage: newTreeStage,
      };

      return {
        ...prev,
        treats: {
          ...prev.treats!,
          balance: currentBalance - treatCost,
          lifetimeSpent: (prev.treats?.lifetimeSpent || 0) + treatCost,
          transactions,
        },
        companion: {
          ...prev.companion,
          waterLevel: newWaterLevel,
          treeXP: newTreeXP,
          treeStage: newTreeStage,
          lastWateredAt: now,
          lastInteraction: now,
          interactionCount: (prev.companion.interactionCount || 0) + 1,
        },
      };
    });

    return result;
  }, [setWorld]);

  // Touch the tree - FREE action, small XP gain
  // P1 Fix: Use functional update to prevent stale closure race conditions
  const touchTree = useCallback(() => {
    const now = Date.now();
    let result = { xpGain: 0, canTouchAgain: false, stageUp: false, newStage: 1, newTreeXP: 0 };

    setWorld(prev => {
      const timeSinceLastTouch = prev.companion.lastTouchTime
        ? now - prev.companion.lastTouchTime
        : Infinity;

      // Cooldown for full effect (1 minute)
      const canTouchAgain = timeSinceLastTouch > TREE_COSTS.touch.cooldownMs;
      const xpGain = canTouchAgain ? TREE_COSTS.touch.xpGain : 2;

      const newTreeXP = (prev.companion.treeXP || 0) + xpGain;
      const newTreeStage = getTreeStageFromXP(newTreeXP);
      const stageUp = newTreeStage > (prev.companion.treeStage || 1);

      result = {
        xpGain,
        canTouchAgain,
        stageUp,
        newStage: newTreeStage,
        newTreeXP,
      };

      return {
        ...prev,
        companion: {
          ...prev.companion,
          treeXP: newTreeXP,
          treeStage: newTreeStage,
          lastTouchTime: now,
          lastInteraction: now,
          interactionCount: (prev.companion.interactionCount || 0) + 1,
        },
      };
    });

    return result;
  }, [setWorld]);

  // Talk to companion - get advice and increase wisdom
  // P1 Fix: Use functional update to prevent stale closure race conditions
  const talkToCompanion = useCallback(() => {
    const now = Date.now();
    const wisdomGain = 2;
    const xpGain = 3;

    setWorld(prev => {
      const newWisdom = Math.min(100, prev.companion.personality.wisdom + wisdomGain);

      return {
        ...prev,
        companion: {
          ...prev.companion,
          lastInteraction: now,
          interactionCount: (prev.companion.interactionCount || 0) + 1,
          experience: prev.companion.experience + xpGain,
          personality: {
            ...prev.companion.personality,
            wisdom: newWisdom,
          },
        },
      };
    });

    return { wisdomGain, xpGain };
  }, [setWorld]);

  // Update companion stats based on user activity (call this from Index.tsx)
  // P1 Fix: Use functional update to prevent stale closure race conditions
  const updateCompanionFromActivity = useCallback((
    activityType: 'mood' | 'habit' | 'focus' | 'gratitude',
    moodValue?: MoodType
  ) => {
    const now = Date.now();
    let happinessChange = 5;
    let hungerIncrease = 3; // Activities make companion hungry
    let personalityChanges = { energy: 0, wisdom: 0, warmth: 0 };

    switch (activityType) {
      case 'mood':
        // Positive moods increase warmth more
        if (moodValue === 'great' || moodValue === 'good') {
          personalityChanges.warmth = 3;
          happinessChange = 10;
        } else if (moodValue === 'bad' || moodValue === 'terrible') {
          // Companion becomes supportive when user is sad
          happinessChange = 2;
          personalityChanges.warmth = 5; // Empathy increases warmth
        }
        break;
      case 'habit':
        personalityChanges.energy = 3;
        happinessChange = 8;
        break;
      case 'focus':
        personalityChanges.wisdom = 3;
        personalityChanges.energy = 2;
        happinessChange = 10;
        break;
      case 'gratitude':
        personalityChanges.warmth = 5;
        happinessChange = 12;
        break;
    }

    setWorld(prev => {
      const newHappiness = Math.min(100, (prev.companion.happiness || 50) + happinessChange);
      const newHunger = Math.min(100, (prev.companion.hunger || 50) + hungerIncrease);

      return {
        ...prev,
        companion: {
          ...prev.companion,
          happiness: newHappiness,
          hunger: newHunger,
          lastInteraction: now,
          mood: newHappiness >= 80 ? 'excited' : newHappiness >= 50 ? 'happy' : 'calm',
          personality: {
            energy: Math.min(100, prev.companion.personality.energy + personalityChanges.energy),
            wisdom: Math.min(100, prev.companion.personality.wisdom + personalityChanges.wisdom),
            warmth: Math.min(100, prev.companion.personality.warmth + personalityChanges.warmth),
          },
        },
      };
    });
  }, [setWorld]);

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
    setWorld({
      ...world,
      restDays: [...restDays, today],
      lastActiveDate: today, // Important: mark today as "active" to preserve streak
    });

    return { success: true };
  }, [world, setWorld, today, restModeStatus]);

  // Deactivate rest mode for today
  const deactivateRestMode = useCallback(() => {
    const restDays = world.restDays || [];
    setWorld({
      ...world,
      restDays: restDays.filter(d => d !== today),
    });
  }, [world, setWorld, today]);

  return {
    world,
    isLoading,

    // Treats system
    earnTreats,
    spendTreats,
    treatsBalance: world.treats?.balance || 0,

    // Actions
    plantSeed,
    waterPlants,
    attractCreature,
    feedCreatures,
    setCompanionType,
    renameCompanion,
    clearWelcomeBack,

    // Companion interactions (simplified: feed costs treats, pet is free)
    petCompanion,
    feedCompanion,
    talkToCompanion,
    updateCompanionFromActivity,

    // Seasonal Tree interactions
    waterTree,
    touchTree,

    // Stats
    gardenStats,

    // Helpers
    getPlantEmoji: (plant: GardenPlant) => PLANT_EMOJIS[plant.type][plant.stage],
    getCreatureEmoji: (creature: GardenCreature) => CREATURE_EMOJIS[creature.type][creature.stage],
    getCompanionEmoji: () => COMPANION_EMOJIS[world.companion.type],

    // Constants for UI
    FEED_COST: COMPANION_COSTS.feed.treatCost,
    WATER_COST: 10, // Cost to water tree

    // Tree data helpers
    treeStage: world.companion.treeStage || 1,
    treeWaterLevel: world.companion.waterLevel || 0,
    treeXP: world.companion.treeXP || 0,

    // Rest mode
    isRestMode,
    activateRestMode,
    deactivateRestMode,
    canActivateRestMode: restModeStatus.canActivate,
    daysUntilRestAvailable: restModeStatus.daysUntilAvailable,
  };
}
