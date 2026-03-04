/**
 * useChallenges Hook Tests
 * Tests challenge and badge management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Challenge, Badge } from '@/types';

// Mock challengeStorage module
const mockChallenges: Challenge[] = [
  {
    id: '1',
    title: { en: 'First Steps' },
    description: { en: 'Complete 5 habits' },
    type: 'total',
    target: 5,
    progress: 2,
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    completed: false,
    icon: '🎯',
  },
];

const mockBadges: Badge[] = [
  {
    id: 'badge1',
    category: 'special',
    title: { en: 'Starter' },
    description: { en: 'Complete your first challenge' },
    icon: 'star',
    requirement: 1,
    unlocked: true,
    unlockedDate: '2024-01-10',
    rarity: 'common',
  },
];

const mockGetChallenges = vi.fn(() => mockChallenges);
const mockGetBadges = vi.fn(() => mockBadges);
const mockAddChallenge = vi.fn();
const mockUpdateChallenge = vi.fn();
const mockSyncChallengeProgress = vi.fn();
const mockCheckSpecialBadges = vi.fn();
const mockUnlockBadge = vi.fn();

vi.mock('@/lib/challengeStorage', () => ({
  getChallenges: () => mockGetChallenges(),
  getBadges: () => mockGetBadges(),
  addChallenge: (challenge: Challenge) => mockAddChallenge(challenge),
  updateChallenge: (id: string, data: any) => mockUpdateChallenge(id, data),
  syncChallengeProgress: (stats: any, focusMinutes: number, gratitudeCount: number) => mockSyncChallengeProgress(stats, focusMinutes, gratitudeCount),
  checkSpecialBadges: (stats: any, habits: any) => mockCheckSpecialBadges(stats, habits),
  unlockBadge: (badgeId: string) => mockUnlockBadge(badgeId),
}));

describe('useChallenges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('returns challenges from storage', async () => {
      const { useChallenges } = await import('../useChallenges');
      const { result } = renderHook(() => useChallenges());

      expect(result.current.challenges).toEqual(mockChallenges);
    });

    it('returns badges from storage', async () => {
      const { useChallenges } = await import('../useChallenges');
      const { result } = renderHook(() => useChallenges());

      expect(result.current.badges).toEqual(mockBadges);
    });

    it('loads data on mount', async () => {
      const { useChallenges } = await import('../useChallenges');
      renderHook(() => useChallenges());

      // getChallenges is called twice: once in useEffect, once in return
      expect(mockGetChallenges).toHaveBeenCalled();
      expect(mockGetBadges).toHaveBeenCalled();
    });
  });

  describe('addChallenge', () => {
    it('exposes addChallenge function', async () => {
      const { useChallenges } = await import('../useChallenges');
      const { result } = renderHook(() => useChallenges());

      expect(typeof result.current.addChallenge).toBe('function');
    });

    it('calls storage addChallenge', async () => {
      const { useChallenges } = await import('../useChallenges');
      const { result } = renderHook(() => useChallenges());

      const newChallenge: Challenge = {
        id: '2',
        title: { en: 'New Challenge' },
        description: { en: 'Test' },
        type: 'focus',
        target: 10,
        progress: 0,
        startDate: '2024-01-15',
        endDate: '2024-02-15',
        completed: false,
        icon: '🔥',
      };

      act(() => {
        result.current.addChallenge(newChallenge);
      });

      expect(mockAddChallenge).toHaveBeenCalledWith(newChallenge);
    });
  });

  describe('syncChallengeProgress', () => {
    it('exposes syncChallengeProgress function', async () => {
      const { useChallenges } = await import('../useChallenges');
      const { result } = renderHook(() => useChallenges());

      expect(typeof result.current.syncChallengeProgress).toBe('function');
    });

    it('calls storage syncChallengeProgress', async () => {
      const { useChallenges } = await import('../useChallenges');
      const { result } = renderHook(() => useChallenges());

      const stats = { habitsCompleted: 5, focusMinutes: 30 } as any;

      act(() => {
        result.current.syncChallengeProgress(stats, 30, 5);
      });

      expect(mockSyncChallengeProgress).toHaveBeenCalledWith(stats, 30, 5);
    });
  });

  describe('checkSpecialBadges', () => {
    it('exposes checkSpecialBadges function', async () => {
      const { useChallenges } = await import('../useChallenges');
      const { result } = renderHook(() => useChallenges());

      expect(typeof result.current.checkSpecialBadges).toBe('function');
    });

    it('calls storage checkSpecialBadges', async () => {
      const { useChallenges } = await import('../useChallenges');
      const { result } = renderHook(() => useChallenges());

      const stats = { streak: 7, totalXp: 1000 } as any;
      const habits: any[] = [];

      act(() => {
        result.current.checkSpecialBadges(stats, habits);
      });

      expect(mockCheckSpecialBadges).toHaveBeenCalledWith(stats, habits);
    });
  });

  describe('unlockBadge', () => {
    it('exposes unlockBadge function', async () => {
      const { useChallenges } = await import('../useChallenges');
      const { result } = renderHook(() => useChallenges());

      expect(typeof result.current.unlockBadge).toBe('function');
    });

    it('calls storage unlockBadge', async () => {
      const { useChallenges } = await import('../useChallenges');
      const { result } = renderHook(() => useChallenges());

      const badgeId = 'new-badge';

      act(() => {
        result.current.unlockBadge(badgeId);
      });

      expect(mockUnlockBadge).toHaveBeenCalledWith(badgeId);
    });
  });

  describe('empty state', () => {
    it('handles empty challenges', async () => {
      mockGetChallenges.mockReturnValue([]);
      mockGetBadges.mockReturnValue([]);

      const { useChallenges } = await import('../useChallenges');
      const { result } = renderHook(() => useChallenges());

      expect(result.current.challenges).toEqual([]);
      expect(result.current.badges).toEqual([]);
    });
  });
});
