/**
 * useGamification Hook Tests
 * Tests XP tracking, achievements, and level calculation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGamification } from '../useGamification';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useIndexedDB
const mockSetGamificationState = vi.fn();
let mockGamificationState = {
  totalXp: 0,
  unlockedAchievements: [] as string[],
  achievementProgress: {},
  shownAchievementToasts: [],
};

vi.mock('../useIndexedDB', () => ({
  useIndexedDB: vi.fn(() => [
    mockGamificationState,
    (updater: any) => {
      if (typeof updater === 'function') {
        mockGamificationState = updater(mockGamificationState);
      } else {
        mockGamificationState = updater;
      }
      mockSetGamificationState(mockGamificationState);
    },
    false, // isLoading
  ]),
  triggerDataRefresh: vi.fn(),
}));

// Mock db
vi.mock('@/storage/db', () => ({
  db: {
    settings: {},
    moods: {
      toArray: vi.fn(() => Promise.resolve([])),
    },
    habits: {
      toArray: vi.fn(() => Promise.resolve([])),
    },
    focusSessions: {
      toArray: vi.fn(() => Promise.resolve([])),
    },
    gratitudeEntries: {
      toArray: vi.fn(() => Promise.resolve([])),
    },
  },
}));

// Mock gamification utilities
vi.mock('@/lib/gamification', () => ({
  checkAchievements: vi.fn(() => ({
    newAchievements: [],
    updatedProgress: {},
  })),
  calculateLevel: vi.fn((xp: number) => ({
    level: Math.floor(xp / 100) + 1,
    currentXp: xp % 100,
    xpForNextLevel: 100,
    progress: (xp % 100) / 100,
  })),
  getXpForAction: vi.fn((action: string) => {
    const xpMap: Record<string, number> = {
      mood: 10,
      habit: 15,
      focus: 20,
      gratitude: 10,
      streak: 25,
    };
    return xpMap[action] || 0;
  }),
}));

describe('useGamification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGamificationState = {
      totalXp: 0,
      unlockedAchievements: [],
      achievementProgress: {},
      shownAchievementToasts: [],
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('returns initial gamification state', () => {
      const { result } = renderHook(() => useGamification());

      expect(result.current.gamificationState).toEqual({
        totalXp: 0,
        unlockedAchievements: [],
        achievementProgress: {},
        shownAchievementToasts: [],
      });
    });

    it('returns stats object', () => {
      const { result } = renderHook(() => useGamification());

      expect(result.current.stats).toHaveProperty('moods');
      expect(result.current.stats).toHaveProperty('habits');
      expect(result.current.stats).toHaveProperty('focusSessions');
      expect(result.current.stats).toHaveProperty('gratitudeEntries');
      expect(result.current.stats).toHaveProperty('totalXp');
    });

    it('calculates user level from XP', () => {
      mockGamificationState.totalXp = 250;

      const { result } = renderHook(() => useGamification());

      expect(result.current.userLevel.level).toBe(3);
    });
  });

  describe('awardXp', () => {
    it('awards XP for mood action', async () => {
      const { result } = renderHook(() => useGamification());

      act(() => {
        result.current.awardXp('mood');
      });

      await waitFor(() => {
        expect(mockSetGamificationState).toHaveBeenCalled();
      });

      expect(mockGamificationState.totalXp).toBe(10);
    });

    it('awards XP for habit action', async () => {
      const { result } = renderHook(() => useGamification());

      act(() => {
        result.current.awardXp('habit');
      });

      await waitFor(() => {
        expect(mockGamificationState.totalXp).toBe(15);
      });
    });

    it('awards XP for focus action', async () => {
      const { result } = renderHook(() => useGamification());

      act(() => {
        result.current.awardXp('focus');
      });

      await waitFor(() => {
        expect(mockGamificationState.totalXp).toBe(20);
      });
    });

    it('awards XP for gratitude action', async () => {
      const { result } = renderHook(() => useGamification());

      act(() => {
        result.current.awardXp('gratitude');
      });

      await waitFor(() => {
        expect(mockGamificationState.totalXp).toBe(10);
      });
    });

    it('awards XP for streak action', async () => {
      const { result } = renderHook(() => useGamification());

      act(() => {
        result.current.awardXp('streak');
      });

      await waitFor(() => {
        expect(mockGamificationState.totalXp).toBe(25);
      });
    });

    it('accumulates XP from multiple actions', async () => {
      const { result } = renderHook(() => useGamification());

      act(() => {
        result.current.awardXp('mood');
      });

      await waitFor(() => {
        expect(mockGamificationState.totalXp).toBe(10);
      });

      act(() => {
        result.current.awardXp('habit');
      });

      await waitFor(() => {
        expect(mockGamificationState.totalXp).toBe(25);
      });
    });
  });

  describe('level calculation', () => {
    it('starts at level 1 with 0 XP', () => {
      mockGamificationState.totalXp = 0;

      const { result } = renderHook(() => useGamification());

      expect(result.current.userLevel.level).toBe(1);
    });

    it('levels up at XP thresholds', () => {
      mockGamificationState.totalXp = 100;

      const { result } = renderHook(() => useGamification());

      expect(result.current.userLevel.level).toBe(2);
    });

    it('calculates progress towards next level', () => {
      mockGamificationState.totalXp = 50;

      const { result } = renderHook(() => useGamification());

      expect(result.current.userLevel.progress).toBe(0.5);
    });
  });

  describe('persistence', () => {
    it('uses useIndexedDB for state persistence', async () => {
      const { useIndexedDB } = await import('../useIndexedDB');

      renderHook(() => useGamification());

      expect(useIndexedDB).toHaveBeenCalledWith(
        expect.objectContaining({
          localStorageKey: 'gamification',
          idField: 'key',
        })
      );
    });
  });
});
