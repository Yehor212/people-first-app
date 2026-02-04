/**
 * useInnerWorld Hook Tests
 * Tests garden state management (plants, creatures, companion, treats, tree)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock generateId and getToday
let mockToday = '2026-02-03';
vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'mock-id-' + Math.random().toString(36).substring(7)),
  getToday: vi.fn(() => mockToday),
}));

// Mock db
vi.mock('@/storage/db', () => ({
  db: {
    settings: { name: 'settings' },
  },
}));

// Mock cloud sync
vi.mock('@/storage/innerWorldCloudSync', () => ({
  pushInnerWorldToCloud: vi.fn(() => Promise.resolve()),
}));

// Mock season helper
vi.mock('@/lib/seasonHelper', () => ({
  getTreeStageFromXP: vi.fn((xp: number) => {
    if (xp >= 500) return 5;
    if (xp >= 200) return 4;
    if (xp >= 100) return 3;
    if (xp >= 50) return 2;
    return 1;
  }),
  TREE_STAGE_XP: {
    1: 0,
    2: 50,
    3: 100,
    4: 200,
    5: 500,
  },
}));

// Mock inner world constants
vi.mock('@/lib/innerWorldConstants', () => ({
  GROWTH_THRESHOLDS: {
    seed: 0,
    sprout: 10,
    growing: 25,
    blooming: 50,
    magnificent: 100,
  },
  CREATURE_THRESHOLDS: {
    egg: 0,
    baby: 10,
    young: 30,
    adult: 60,
    legendary: 90,
  },
  GARDEN_STAGE_THRESHOLDS: {
    empty: 0,
    sprouting: 5,
    growing: 15,
    flourishing: 30,
    magical: 50,
    legendary: 100,
  },
  MOOD_COLORS: {
    great: '#22c55e',
    good: '#84cc16',
    okay: '#facc15',
    bad: '#f97316',
    terrible: '#ef4444',
  },
  PLANT_EMOJIS: {
    flower: { seed: '🌱', sprout: '🌿', growing: '🌷', blooming: '🌸', magnificent: '🌺' },
    tree: { seed: '🌱', sprout: '🌿', growing: '🌲', blooming: '🌳', magnificent: '🌴' },
    crystal: { seed: '💎', sprout: '✨', growing: '🔮', blooming: '💠', magnificent: '🌟' },
    mushroom: { seed: '🍄', sprout: '🍄', growing: '🍄', blooming: '🍄', magnificent: '🍄' },
  },
  CREATURE_EMOJIS: {
    butterfly: { egg: '🥚', baby: '🐛', young: '🦋', adult: '🦋', legendary: '🦋' },
    bird: { egg: '🥚', baby: '🐣', young: '🐥', adult: '🐦', legendary: '🦅' },
    firefly: { egg: '🥚', baby: '✨', young: '💫', adult: '🌟', legendary: '⭐' },
    spirit: { egg: '🥚', baby: '👻', young: '💨', adult: '🌬️', legendary: '🌪️' },
  },
  COMPANION_EMOJIS: {
    fox: '🦊',
    cat: '🐱',
    owl: '🦉',
    rabbit: '🐰',
  },
}));

// Mock treat constants
vi.mock('@/lib/treatConstants', () => ({
  TREAT_REWARDS: {
    mood: 5,
    habit: 10,
    focus: 15,
    gratitude: 8,
  },
  COMPANION_COSTS: {
    pet: {
      xpGain: 10,
      cooldownMs: 60000,
    },
    feed: {
      treatCost: 15,
      fullnessGain: 25,
      xpGain: 20,
    },
  },
  COMPANION_LEVELING: {
    xpPerLevel: vi.fn((level: number) => level * 100),
  },
  FULLNESS_DECAY: {
    ratePerHour: 2,
  },
  calculateTreatsEarned: vi.fn((base: number, streak: number) => ({
    total: base + (streak > 0 ? Math.floor(base * 0.1 * streak) : 0),
    bonus: streak > 0 ? Math.floor(base * 0.1 * streak) : 0,
    multiplier: 1 + (streak > 0 ? 0.1 * streak : 0),
  })),
}));

// Mock useIndexedDB state
let mockWorldState: any = null;
let mockSetWorld: any = vi.fn();
let mockIsLoading = false;

vi.mock('../useIndexedDB', () => ({
  useIndexedDB: vi.fn(() => [mockWorldState, mockSetWorld, mockIsLoading]),
}));

describe('useInnerWorld', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToday = '2026-02-03';
    mockIsLoading = false;

    // Initialize mock state
    mockWorldState = {
      treats: {
        balance: 50,
        lifetimeEarned: 50,
        lifetimeSpent: 0,
        lastEarnedAt: Date.now(),
        transactions: [],
      },
      gardenStage: 'empty',
      plants: [],
      creatures: [],
      weather: 'sunny',
      season: 'winter',
      companion: {
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
        fullness: 70,
        happiness: 50,
        hunger: 30,
        personality: {
          energy: 50,
          wisdom: 50,
          warmth: 70,
        },
        treeStage: 1,
        waterLevel: 70,
        lastWateredAt: Date.now(),
        lastTouchTime: undefined,
        treeXP: 0,
      },
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
    };

    // Reset setWorld to actually update mockWorldState for functional updates
    mockSetWorld = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        mockWorldState = updater(mockWorldState);
      } else {
        mockWorldState = updater;
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('returns world state', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      expect(result.current.world).toBeDefined();
      expect(result.current.world.companion).toBeDefined();
      expect(result.current.world.plants).toEqual([]);
    });

    it('returns loading state', async () => {
      mockIsLoading = true;

      vi.resetModules();
      vi.doMock('../useIndexedDB', () => ({
        useIndexedDB: vi.fn(() => [mockWorldState, mockSetWorld, true]),
      }));

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      expect(result.current.isLoading).toBe(true);
    });

    it('returns treats balance', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      expect(result.current.treatsBalance).toBe(50);
    });
  });

  describe('plantSeed', () => {
    it('plants a flower for mood activity', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.plantSeed('mood', 'good');
      });

      expect(mockSetWorld).toHaveBeenCalled();
      // The functional update should have been called
      expect(mockWorldState.plants.length).toBe(1);
      expect(mockWorldState.plants[0].type).toBe('flower');
      expect(mockWorldState.plants[0].sourceActivity).toBe('mood');
    });

    it('plants a tree for habit activity', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.plantSeed('habit');
      });

      expect(mockWorldState.plants[0].type).toBe('tree');
    });

    it('plants a crystal for focus activity', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.plantSeed('focus');
      });

      expect(mockWorldState.plants[0].type).toBe('crystal');
    });

    it('plants a mushroom for gratitude activity', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.plantSeed('gratitude');
      });

      expect(mockWorldState.plants[0].type).toBe('mushroom');
    });

    it('increments totalPlantsGrown', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.plantSeed('mood');
      });

      expect(mockWorldState.totalPlantsGrown).toBe(1);
    });

    it('updates companion experience', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.plantSeed('mood');
      });

      // Planting adds 10 XP
      expect(mockWorldState.companion.experience).toBe(10);
    });
  });

  describe('waterPlants', () => {
    it('waters plants of matching activity type', async () => {
      mockWorldState.plants = [
        { id: '1', sourceActivity: 'mood', growthPoints: 5, stage: 'seed' },
        { id: '2', sourceActivity: 'habit', growthPoints: 10, stage: 'sprout' },
      ];

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.waterPlants('mood');
      });

      expect(mockWorldState.plants[0].growthPoints).toBe(10); // +5
      expect(mockWorldState.plants[1].growthPoints).toBe(10); // unchanged
    });

    it('updates plant stage when growth threshold reached', async () => {
      mockWorldState.plants = [
        { id: '1', sourceActivity: 'mood', growthPoints: 8, stage: 'seed' },
      ];

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.waterPlants('mood');
      });

      // 8 + 5 = 13, should be sprout (threshold 10)
      expect(mockWorldState.plants[0].growthPoints).toBe(13);
      expect(mockWorldState.plants[0].stage).toBe('sprout');
    });
  });

  describe('attractCreature', () => {
    it('adds a new creature', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.attractCreature();
      });

      expect(mockWorldState.creatures.length).toBe(1);
      expect(mockWorldState.totalCreaturesAttracted).toBe(1);
    });

    it('creates creature with egg stage', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.attractCreature();
      });

      expect(mockWorldState.creatures[0].stage).toBe('egg');
      expect(mockWorldState.creatures[0].happiness).toBe(0);
    });
  });

  describe('feedCreatures', () => {
    it('increases creature happiness', async () => {
      mockWorldState.creatures = [
        { id: '1', happiness: 20, stage: 'baby' },
        { id: '2', happiness: 55, stage: 'young' },
      ];

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.feedCreatures();
      });

      expect(mockWorldState.creatures[0].happiness).toBe(30); // +10
      expect(mockWorldState.creatures[1].happiness).toBe(65); // +10
    });

    it('caps happiness at 100', async () => {
      mockWorldState.creatures = [
        { id: '1', happiness: 95, stage: 'legendary' },
      ];

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.feedCreatures();
      });

      expect(mockWorldState.creatures[0].happiness).toBe(100);
    });
  });

  describe('companion management', () => {
    it('changes companion type', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.setCompanionType('owl');
      });

      expect(mockWorldState.companion.type).toBe('owl');
    });

    it('renames companion', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.renameCompanion('Whiskers');
      });

      expect(mockWorldState.companion.name).toBe('Whiskers');
    });
  });

  describe('petCompanion', () => {
    it('gains XP when petting', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let petResult: any;
      act(() => {
        petResult = result.current.petCompanion();
      });

      expect(petResult.xpGain).toBe(10); // Full XP when no cooldown
      expect(mockWorldState.companion.experience).toBe(10);
    });

    it('gains less XP on cooldown', async () => {
      mockWorldState.companion.lastPetTime = Date.now(); // Just petted

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let petResult: any;
      act(() => {
        petResult = result.current.petCompanion();
      });

      expect(petResult.xpGain).toBe(2); // Reduced XP on cooldown
      expect(petResult.canPetAgain).toBe(false);
    });

    it('increments interaction count', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.petCompanion();
      });

      expect(mockWorldState.companion.interactionCount).toBe(1);
    });
  });

  describe('feedCompanion', () => {
    it('feeds companion when has enough treats', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let feedResult: any;
      act(() => {
        feedResult = result.current.feedCompanion();
      });

      expect(feedResult.success).toBe(true);
      expect(feedResult.treatCost).toBe(15);
      expect(mockWorldState.treats.balance).toBe(35); // 50 - 15
      expect(mockWorldState.companion.fullness).toBe(95); // 70 + 25
    });

    it('fails when not enough treats', async () => {
      mockWorldState.treats.balance = 5; // Less than cost (15)

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let feedResult: any;
      act(() => {
        feedResult = result.current.feedCompanion();
      });

      expect(feedResult.success).toBe(false);
      expect(feedResult.reason).toBe('not_enough_treats');
      expect(feedResult.needed).toBe(15);
      expect(feedResult.have).toBe(5);
    });

    it('caps fullness at 100', async () => {
      mockWorldState.companion.fullness = 90;

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.feedCompanion();
      });

      expect(mockWorldState.companion.fullness).toBe(100);
    });

    it('updates mood based on happiness', async () => {
      mockWorldState.companion.fullness = 60; // Will become 85 (excited threshold)

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.feedCompanion();
      });

      expect(mockWorldState.companion.mood).toBe('excited');
    });
  });

  describe('talkToCompanion', () => {
    it('increases wisdom', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      const talkResult = result.current.talkToCompanion();

      expect(talkResult.wisdomGain).toBe(2);
      expect(talkResult.xpGain).toBe(3);
    });
  });

  describe('treats system', () => {
    it('earns treats', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let earnResult: any;
      act(() => {
        earnResult = result.current.earnTreats('mood', 10, 'Daily mood');
      });

      expect(earnResult.earned).toBe(10);
      expect(mockWorldState.treats.balance).toBe(60); // 50 + 10
      expect(mockWorldState.treats.lifetimeEarned).toBe(60);
    });

    it('earns bonus treats with streak', async () => {
      mockWorldState.currentActiveStreak = 5;

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let earnResult: any;
      act(() => {
        earnResult = result.current.earnTreats('habit', 10);
      });

      // With 5 day streak, bonus = 10 * 0.1 * 5 = 5
      expect(earnResult.earned).toBe(15);
      expect(earnResult.bonus).toBe(5);
    });

    it('spends treats successfully', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let success: boolean;
      act(() => {
        success = result.current.spendTreats(20, 'Buy decoration');
      });

      expect(success!).toBe(true);
      expect(mockWorldState.treats.balance).toBe(30); // 50 - 20
      expect(mockWorldState.treats.lifetimeSpent).toBe(20);
    });

    it('fails to spend when insufficient balance', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let success: boolean;
      act(() => {
        success = result.current.spendTreats(100, 'Too expensive');
      });

      expect(success!).toBe(false);
      expect(mockWorldState.treats.balance).toBe(50); // unchanged
    });
  });

  describe('seasonal tree', () => {
    it('waters tree when has enough treats', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let waterResult: any;
      act(() => {
        waterResult = result.current.waterTree();
      });

      expect(waterResult.success).toBe(true);
      expect(waterResult.waterGain).toBe(30);
      expect(waterResult.xpGain).toBe(50);
      expect(mockWorldState.treats.balance).toBe(40); // 50 - 10
      expect(mockWorldState.companion.waterLevel).toBe(100); // 70 + 30
      expect(mockWorldState.companion.treeXP).toBe(50);
    });

    it('fails to water when not enough treats', async () => {
      mockWorldState.treats.balance = 5;

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let waterResult: any;
      act(() => {
        waterResult = result.current.waterTree();
      });

      expect(waterResult.success).toBe(false);
      expect(waterResult.reason).toBe('not_enough_treats');
    });

    it('advances tree stage when XP threshold reached', async () => {
      mockWorldState.companion.treeXP = 45; // Will become 95 after watering

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let waterResult: any;
      act(() => {
        waterResult = result.current.waterTree();
      });

      // 45 + 50 = 95, stage 2 threshold is 50, stage 3 is 100
      expect(waterResult.newTreeXP).toBe(95);
      expect(waterResult.newStage).toBe(2);
    });

    it('touches tree for free XP', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let touchResult: any;
      act(() => {
        touchResult = result.current.touchTree();
      });

      expect(touchResult.xpGain).toBe(10);
      expect(mockWorldState.companion.treeXP).toBe(10);
    });

    it('gives less XP when touching on cooldown', async () => {
      mockWorldState.companion.lastTouchTime = Date.now();

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let touchResult: any;
      act(() => {
        touchResult = result.current.touchTree();
      });

      expect(touchResult.xpGain).toBe(2); // Cooldown XP
      expect(touchResult.canTouchAgain).toBe(false);
    });
  });

  describe('rest mode', () => {
    it('checks if rest mode is active', async () => {
      mockWorldState.restDays = ['2026-02-03'];

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      expect(result.current.isRestMode).toBe(true);
    });

    it('activates rest mode', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let activateResult: any;
      act(() => {
        activateResult = result.current.activateRestMode();
      });

      expect(activateResult.success).toBe(true);
      expect(mockWorldState.restDays).toContain('2026-02-03');
      expect(mockWorldState.lastActiveDate).toBe('2026-02-03'); // Preserves streak
    });

    it('fails if already resting today', async () => {
      mockWorldState.restDays = ['2026-02-03'];

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let activateResult: any;
      act(() => {
        activateResult = result.current.activateRestMode();
      });

      expect(activateResult.success).toBe(false);
      expect(activateResult.reason).toBe('already_resting');
    });

    it('fails if on cooldown', async () => {
      mockWorldState.restDays = ['2026-02-02']; // Yesterday (within 7 days)

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      let activateResult: any;
      act(() => {
        activateResult = result.current.activateRestMode();
      });

      expect(activateResult.success).toBe(false);
      expect(activateResult.reason).toBe('cooldown');
    });

    it('deactivates rest mode', async () => {
      mockWorldState.restDays = ['2026-02-03'];

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.deactivateRestMode();
      });

      expect(mockWorldState.restDays).not.toContain('2026-02-03');
    });
  });

  describe('gardenStats', () => {
    it('calculates garden statistics', async () => {
      mockWorldState.plants = [
        { id: '1', stage: 'blooming' },
        { id: '2', stage: 'seed' },
        { id: '3', stage: 'magnificent' },
      ];
      mockWorldState.creatures = [
        { id: '1', happiness: 60 },
        { id: '2', happiness: 30 },
      ];
      mockWorldState.companion.level = 5;
      mockWorldState.daysActive = 10;
      mockWorldState.currentActiveStreak = 3;

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      expect(result.current.gardenStats.totalPlants).toBe(3);
      expect(result.current.gardenStats.bloomingPlants).toBe(2); // blooming + magnificent
      expect(result.current.gardenStats.totalCreatures).toBe(2);
      expect(result.current.gardenStats.happyCreatures).toBe(1); // happiness >= 50
      expect(result.current.gardenStats.companionLevel).toBe(5);
      expect(result.current.gardenStats.daysActive).toBe(10);
      expect(result.current.gardenStats.currentStreak).toBe(3);
    });
  });

  describe('emoji helpers', () => {
    it('returns plant emoji', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      const emoji = result.current.getPlantEmoji({ type: 'flower', stage: 'blooming' } as any);
      expect(emoji).toBe('🌸');
    });

    it('returns creature emoji', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      const emoji = result.current.getCreatureEmoji({ type: 'butterfly', stage: 'adult' } as any);
      expect(emoji).toBe('🦋');
    });

    it('returns companion emoji', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      const emoji = result.current.getCompanionEmoji();
      expect(emoji).toBe('🦊');
    });
  });

  describe('clearWelcomeBack', () => {
    it('clears pending growth state', async () => {
      mockWorldState.pendingGrowth = {
        plantsToGrow: 5,
        creaturesArrived: 2,
        companionMissedYou: true,
      };

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.clearWelcomeBack();
      });

      expect(mockWorldState.pendingGrowth.plantsToGrow).toBe(0);
      expect(mockWorldState.pendingGrowth.creaturesArrived).toBe(0);
      expect(mockWorldState.pendingGrowth.companionMissedYou).toBe(false);
    });
  });

  describe('updateCompanionFromActivity', () => {
    it('updates companion from mood activity', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.updateCompanionFromActivity('mood', 'great');
      });

      expect(mockWorldState.companion.happiness).toBe(60); // +10 for positive mood
      expect(mockWorldState.companion.personality.warmth).toBe(73); // +3 for positive mood
    });

    it('increases warmth when user feels bad (empathy)', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.updateCompanionFromActivity('mood', 'terrible');
      });

      expect(mockWorldState.companion.personality.warmth).toBe(75); // +5 for empathy
    });

    it('updates companion from habit activity', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.updateCompanionFromActivity('habit');
      });

      expect(mockWorldState.companion.personality.energy).toBe(53); // +3
    });

    it('updates companion from focus activity', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.updateCompanionFromActivity('focus');
      });

      expect(mockWorldState.companion.personality.wisdom).toBe(53); // +3
      expect(mockWorldState.companion.personality.energy).toBe(52); // +2
    });

    it('updates companion from gratitude activity', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      act(() => {
        result.current.updateCompanionFromActivity('gratitude');
      });

      expect(mockWorldState.companion.personality.warmth).toBe(75); // +5
      expect(mockWorldState.companion.happiness).toBe(62); // +12
    });
  });

  describe('constants', () => {
    it('exposes feed cost constant', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      expect(result.current.FEED_COST).toBe(15);
    });

    it('exposes water cost constant', async () => {
      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      expect(result.current.WATER_COST).toBe(10);
    });

    it('exposes tree data', async () => {
      mockWorldState.companion.treeStage = 3;
      mockWorldState.companion.waterLevel = 85;
      mockWorldState.companion.treeXP = 150;

      const { useInnerWorld } = await import('../useInnerWorld');
      const { result } = renderHook(() => useInnerWorld());

      expect(result.current.treeStage).toBe(3);
      expect(result.current.treeWaterLevel).toBe(85);
      expect(result.current.treeXP).toBe(150);
    });
  });
});
