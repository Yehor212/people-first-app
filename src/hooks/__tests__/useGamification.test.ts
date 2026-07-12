/**
 * useGamification Hook Tests
 * Tests XP tracking, achievements, and level calculation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGamification } from '../useGamification';
import { playSound } from '@/lib/audioManager';
import { useAppStore } from '@/stores/appStore';
import { useUserDataStore } from '@/stores/userDataStore';
import { checkAchievements } from '@/lib/gamification';

const ownerMocks = vi.hoisted(() => ({
  getCurrentSessionUserId: vi.fn(),
  getLocalDataOwnerId: vi.fn(),
  updateMyLevel: vi.fn(),
  addFriendActivity: vi.fn(),
  loadMyProfile: vi.fn(),
}));

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/audioManager', () => ({
  playSound: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  getCurrentSessionUserId: ownerMocks.getCurrentSessionUserId,
}));

vi.mock('@/storage/friendsSync', () => ({
  addFriendActivity: ownerMocks.addFriendActivity,
  loadMyProfile: ownerMocks.loadMyProfile,
  updateMyLevel: ownerMocks.updateMyLevel,
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
  getLocalDataOwnerId: ownerMocks.getLocalDataOwnerId,
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
    xp: xp % 100,
    nextLevelXp: 100,
    title: `Level ${Math.floor(xp / 100) + 1}`,
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
    ownerMocks.getCurrentSessionUserId.mockResolvedValue('user-a');
    ownerMocks.getLocalDataOwnerId.mockResolvedValue('user-a');
    ownerMocks.loadMyProfile.mockReturnValue(null);
    useAppStore.setState({ isAccountBoundaryInProgress: false });
    useUserDataStore.setState({
      moods: [],
      habits: [],
      focusSessions: [],
      gratitudeEntries: [],
    });
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

    it('does not award XP when disabled for V2', () => {
      const { result } = renderHook(() => useGamification({ enabled: false }));

      act(() => {
        result.current.awardXp('mood');
      });

      expect(mockSetGamificationState).not.toHaveBeenCalled();
      expect(mockGamificationState.totalXp).toBe(0);
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

    it('does not play level-up feedback from raw XP bookkeeping', async () => {
      mockGamificationState.totalXp = 90;
      const { result } = renderHook(() => useGamification());

      act(() => {
        result.current.awardXp('habit');
      });

      await waitFor(() => {
        expect(mockGamificationState.totalXp).toBe(105);
      });
      expect(playSound).not.toHaveBeenCalledWith('levelUp');
    });

    it('does not play level-up feedback for XP inside the same level', async () => {
      mockGamificationState.totalXp = 10;
      const { result } = renderHook(() => useGamification());

      act(() => {
        result.current.awardXp('mood');
      });

      await waitFor(() => {
        expect(mockGamificationState.totalXp).toBe(20);
      });
      expect(playSound).not.toHaveBeenCalledWith('levelUp');
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
    it('stamps the originating account on level sync', async () => {
      renderHook(() => useGamification());

      await act(async () => {
        await Promise.resolve();
      });

      expect(ownerMocks.updateMyLevel).toHaveBeenCalledWith(1, 'user-a');
    });

    it('cancels a delayed account-A level sync when an account boundary starts', async () => {
      let resolveOwner!: (ownerUserId: string | null) => void;
      ownerMocks.getCurrentSessionUserId.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOwner = resolve;
        })
      );

      renderHook(() => useGamification());

      act(() => {
        useAppStore.getState().setAccountBoundaryInProgress(true);
      });
      await act(async () => {
        resolveOwner('user-b');
        await Promise.resolve();
      });

      expect(ownerMocks.updateMyLevel).not.toHaveBeenCalled();
    });

    it('does not apply account-A local level to an already active account-B session', async () => {
      ownerMocks.getCurrentSessionUserId.mockResolvedValue('user-b');
      ownerMocks.getLocalDataOwnerId.mockResolvedValue('user-a');

      renderHook(() => useGamification());

      await act(async () => {
        await Promise.resolve();
      });

      expect(ownerMocks.updateMyLevel).not.toHaveBeenCalled();
    });

    it('does not write account-A level-up activity when the active session is B', async () => {
      ownerMocks.loadMyProfile.mockReturnValue({
        friendCode: 'ZF-ACCOUNT-A',
        displayName: 'Account A',
      });
      const { rerender } = renderHook(() => useGamification());
      await act(async () => {
        await Promise.resolve();
      });
      ownerMocks.addFriendActivity.mockClear();
      ownerMocks.updateMyLevel.mockClear();

      ownerMocks.getCurrentSessionUserId.mockResolvedValue('user-b');
      ownerMocks.getLocalDataOwnerId.mockResolvedValue('user-a');
      mockGamificationState.totalXp = 100;
      rerender();
      await act(async () => {
        await Promise.resolve();
      });

      expect(ownerMocks.addFriendActivity).not.toHaveBeenCalled();
      expect(ownerMocks.updateMyLevel).not.toHaveBeenCalled();
    });

    it('keeps legitimate level-up activity for the verified local owner', async () => {
      ownerMocks.loadMyProfile.mockReturnValue({
        friendCode: 'ZF-ACCOUNT-A',
        displayName: 'Account A',
      });
      const { rerender } = renderHook(() => useGamification());
      await act(async () => {
        await Promise.resolve();
      });
      ownerMocks.addFriendActivity.mockClear();

      mockGamificationState.totalXp = 100;
      rerender();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(ownerMocks.addFriendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          friendId: 'ZF-ACCOUNT-A',
          activityType: 'level_up',
          description: 'Level 2 (2)',
        })
      );
    });

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

      // xp=50, nextLevelXp=100 → 50% progress
      expect(result.current.userLevel.xp).toBe(50);
      expect(result.current.userLevel.nextLevelXp).toBe(100);
    });
  });

  describe('account-bound side effects', () => {
    it('drops queued account-A achievement activity after an account boundary starts', () => {
      const queuedMicrotasks: VoidFunction[] = [];
      vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
        queuedMicrotasks.push(callback);
      });
      ownerMocks.loadMyProfile.mockReturnValue({
        friendCode: 'ZF-ACCOUNT-A',
        displayName: 'Account A',
      });
      useUserDataStore.setState({ moods: [{ id: 'mood-a-1' }] as never[] });

      renderHook(() => useGamification());

      vi.mocked(checkAchievements).mockReturnValueOnce({
        newAchievements: [
          {
            id: 'first_mood',
            name: 'First mood',
            description: 'Recorded a mood',
            icon: 'mood',
            rarity: 'common',
            points: 10,
          },
        ],
        updatedProgress: { first_mood: 1 } as never,
      });
      act(() => {
        useUserDataStore.setState({
          moods: [{ id: 'mood-a-1' }, { id: 'mood-a-2' }] as never[],
        });
      });

      expect(queuedMicrotasks).toHaveLength(1);
      act(() => {
        useAppStore.getState().setAccountBoundaryInProgress(true);
        queuedMicrotasks[0]();
      });

      expect(ownerMocks.addFriendActivity).not.toHaveBeenCalled();
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
