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

  // Water decay effect - reduces water level over time
  useEffect(() => {
    if (isLoading) return;

    const DECAY_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
    const DECAY_RATE = 2; // -2% per hour

    const checkWaterDecay = () => {
      const lastWateredAt = world.companion.lastWateredAt || Date.now();
      const hoursSinceWatered = (Date.now() - lastWateredAt) / (1000 * 60 * 60);
      const expectedDecay = Math.floor(hoursSinceWatered) * DECAY_RATE;
      const expectedWaterLevel = Math.max(0, 100 - expectedDecay);

      // Only update if water level needs adjustment
      if (world.companion.waterLevel > expectedWaterLevel) {
        setWorld({
          ...world,
          companion: {
            ...world.companion,
            waterLevel: expectedWaterLevel,
          },
        });
      }
    };

    // Check immediately on load
    checkWaterDecay();

    // Set up interval for periodic checks
    const interval = setInterval(checkWaterDecay, DECAY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isLoading, world.companion.lastWateredAt]);

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

  // ============================================
  // TREATS SYSTEM
  // ============================================

  // Earn treats from activities
  const earnTreats = useCallback((
    source: TreatSource,
    baseAmount: number,
    description?: string
  ) => {
    const streakDays = world.currentActiveStreak;
    const { total, bonus, multiplier } = calculateTreatsEarned(baseAmount, streakDays);

    const transaction: TreatTransaction = {
      id: generateId(),
      amount: total,
      source,
      timestamp: Date.now(),
      description: description || `${source} +${total}`,
    };

    // Keep only last 50 transactions
    const transactions = [transaction, ...(world.treats?.transactions || [])].slice(0, 50);

    const updatedTreats: TreatsWallet = {
      balance: (world.treats?.balance || 0) + total,
      lifetimeEarned: (world.treats?.lifetimeEarned || 0) + total,
      lifetimeSpent: world.treats?.lifetimeSpent || 0,
      lastEarnedAt: Date.now(),
      transactions,
    };

    setWorld({
      ...world,
      treats: updatedTreats,
    });

    return { earned: total, bonus, multiplier, newBalance: updatedTreats.balance };
  }, [world, setWorld]);

  // Spend treats (e.g., to feed companion)
  const spendTreats = useCallback((amount: number, purpose: string): boolean => {
    const currentBalance = world.treats?.balance || 0;
    if (currentBalance < amount) {
      return false; // Not enough treats
    }

    const transaction: TreatTransaction = {
      id: generateId(),
      amount: -amount,
      source: 'mood', // Will be overwritten based on purpose
      timestamp: Date.now(),
      description: purpose,
    };

    const transactions = [transaction, ...(world.treats?.transactions || [])].slice(0, 50);

    const updatedTreats: TreatsWallet = {
      ...world.treats!,
      balance: currentBalance - amount,
      lifetimeSpent: (world.treats?.lifetimeSpent || 0) + amount,
      transactions,
    };

    setWorld({
      ...world,
      treats: updatedTreats,
    });

    return true;
  }, [world, setWorld]);

  // ============================================
  // COMPANION INTERACTIONS
  // ============================================

  // Pet the companion - FREE action, small XP gain, shows love
  const petCompanion = useCallback(() => {
    const now = Date.now();
    const timeSinceLastPet = world.companion.lastPetTime
      ? now - world.companion.lastPetTime
      : Infinity;

    // Cooldown for full effect (1 minute)
    const canPetAgain = timeSinceLastPet > COMPANION_COSTS.pet.cooldownMs;
    const xpGain = canPetAgain ? COMPANION_COSTS.pet.xpGain : 2;

    // Calculate level up
    let newExperience = world.companion.experience + xpGain;
    let newLevel = world.companion.level;
    const xpNeeded = COMPANION_LEVELING.xpPerLevel(newLevel);

    if (newExperience >= xpNeeded) {
      newLevel += 1;
      newExperience -= xpNeeded;
    }

    setWorld({
      ...world,
      companion: {
        ...world.companion,
        lastPetTime: now,
        lastInteraction: now,
        interactionCount: (world.companion.interactionCount || 0) + 1,
        experience: newExperience,
        level: newLevel,
      },
    });

    return {
      xpGain,
      canPetAgain,
      leveledUp: newLevel > world.companion.level,
      newLevel,
    };
  }, [world, setWorld]);

  // Feed the companion - COSTS TREATS, increases fullness and XP
  const feedCompanion = useCallback(() => {
    const now = Date.now();
    const treatCost = COMPANION_COSTS.feed.treatCost;
    const currentBalance = world.treats?.balance || 0;

    // Check if enough treats
    if (currentBalance < treatCost) {
      return {
        success: false,
        reason: 'not_enough_treats',
        needed: treatCost,
        have: currentBalance,
        fullnessGain: 0,
        xpGain: 0,
      };
    }

    const fullnessGain = COMPANION_COSTS.feed.fullnessGain;
    const xpGain = COMPANION_COSTS.feed.xpGain;

    // Update fullness and derive hunger from it
    const newFullness = Math.min(100, (world.companion.fullness || 50) + fullnessGain);
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
    const transactions = [transaction, ...(world.treats?.transactions || [])].slice(0, 50);

    // Calculate level up
    let newExperience = world.companion.experience + xpGain;
    let newLevel = world.companion.level;
    const xpNeeded = COMPANION_LEVELING.xpPerLevel(newLevel);

    if (newExperience >= xpNeeded) {
      newLevel += 1;
      newExperience -= xpNeeded;
    }

    setWorld({
      ...world,
      treats: {
        ...world.treats!,
        balance: currentBalance - treatCost,
        lifetimeSpent: (world.treats?.lifetimeSpent || 0) + treatCost,
        transactions,
      },
      companion: {
        ...world.companion,
        fullness: newFullness,
        hunger: newHunger,
        happiness: newHappiness,
        lastFeedTime: now,
        lastInteraction: now,
        interactionCount: (world.companion.interactionCount || 0) + 1,
        experience: newExperience,
        level: newLevel,
        mood: newHappiness >= 80 ? 'excited' : newHappiness >= 50 ? 'happy' : 'calm',
      },
    });

    return {
      success: true,
      fullnessGain,
      xpGain,
      treatCost,
      newBalance: currentBalance - treatCost,
      leveledUp: newLevel > world.companion.level,
      newLevel,
    };
  }, [world, setWorld]);

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
  const waterTree = useCallback(() => {
    const now = Date.now();
    const treatCost = TREE_COSTS.water.treatCost;
    const currentBalance = world.treats?.balance || 0;

    // Check if enough treats
    if (currentBalance < treatCost) {
      return {
        success: false,
        reason: 'not_enough_treats',
        needed: treatCost,
        have: currentBalance,
        waterGain: 0,
        xpGain: 0,
      };
    }

    const waterGain = TREE_COSTS.water.waterGain;
    const xpGain = TREE_COSTS.water.xpGain;

    // Update water level and XP
    const newWaterLevel = Math.min(100, (world.companion.waterLevel || 0) + waterGain);
    const newTreeXP = (world.companion.treeXP || 0) + xpGain;
    const newTreeStage = getTreeStageFromXP(newTreeXP);

    // Deduct treats
    const transaction: TreatTransaction = {
      id: generateId(),
      amount: -treatCost,
      source: 'mood',
      timestamp: now,
      description: 'Water tree',
    };
    const transactions = [transaction, ...(world.treats?.transactions || [])].slice(0, 50);

    const stageUp = newTreeStage > (world.companion.treeStage || 1);

    setWorld({
      ...world,
      treats: {
        ...world.treats!,
        balance: currentBalance - treatCost,
        lifetimeSpent: (world.treats?.lifetimeSpent || 0) + treatCost,
        transactions,
      },
      companion: {
        ...world.companion,
        waterLevel: newWaterLevel,
        treeXP: newTreeXP,
        treeStage: newTreeStage,
        lastWateredAt: now,
        lastInteraction: now,
        interactionCount: (world.companion.interactionCount || 0) + 1,
      },
    });

    return {
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
  }, [world, setWorld]);

  // Touch the tree - FREE action, small XP gain
  const touchTree = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTouch = world.companion.lastPetTime
      ? now - world.companion.lastPetTime
      : Infinity;

    // Cooldown for full effect (1 minute)
    const canTouchAgain = timeSinceLastTouch > TREE_COSTS.touch.cooldownMs;
    const xpGain = canTouchAgain ? TREE_COSTS.touch.xpGain : 2;

    const newTreeXP = (world.companion.treeXP || 0) + xpGain;
    const newTreeStage = getTreeStageFromXP(newTreeXP);
    const stageUp = newTreeStage > (world.companion.treeStage || 1);

    setWorld({
      ...world,
      companion: {
        ...world.companion,
        treeXP: newTreeXP,
        treeStage: newTreeStage,
        lastPetTime: now,
        lastInteraction: now,
        interactionCount: (world.companion.interactionCount || 0) + 1,
      },
    });

    return {
      xpGain,
      canTouchAgain,
      stageUp,
      newStage: newTreeStage,
      newTreeXP,
    };
  }, [world, setWorld]);

  // Talk to companion - get advice and increase wisdom
  const talkToCompanion = useCallback(() => {
    const now = Date.now();
    const wisdomGain = 2;
    const xpGain = 3;

    const newWisdom = Math.min(100, world.companion.personality.wisdom + wisdomGain);

    setWorld({
      ...world,
      companion: {
        ...world.companion,
        lastInteraction: now,
        interactionCount: (world.companion.interactionCount || 0) + 1,
        experience: world.companion.experience + xpGain,
        personality: {
          ...world.companion.personality,
          wisdom: newWisdom,
        },
      },
    });

    return { wisdomGain, xpGain };
  }, [world, setWorld]);

  // Update companion stats based on user activity (call this from Index.tsx)
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

    const newHappiness = Math.min(100, (world.companion.happiness || 50) + happinessChange);
    const newHunger = Math.min(100, (world.companion.hunger || 50) + hungerIncrease);

    setWorld({
      ...world,
      companion: {
        ...world.companion,
        happiness: newHappiness,
        hunger: newHunger,
        lastInteraction: now,
        mood: newHappiness >= 80 ? 'excited' : newHappiness >= 50 ? 'happy' : 'calm',
        personality: {
          energy: Math.min(100, world.companion.personality.energy + personalityChanges.energy),
          wisdom: Math.min(100, world.companion.personality.wisdom + personalityChanges.wisdom),
          warmth: Math.min(100, world.companion.personality.warmth + personalityChanges.warmth),
        },
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
  };
}
