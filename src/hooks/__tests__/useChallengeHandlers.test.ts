/**
 * useChallengeHandlers Hook Tests
 * Tests feature unlock detection, challenge progress, badge sync, and modal opening.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { makeTestHabit, datesToEntries } from '@/test/habitFixtures';

// --- mocks ---

const mockSetFeatureToUnlock = vi.fn();
const mockSetChallengeHabit = vi.fn();
const mockOpenModal = vi.fn();

vi.mock('@/stores', () => ({
  useUIStore: Object.assign(
    vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
      sel({
        setFeatureToUnlock: mockSetFeatureToUnlock,
        setChallengeHabit: mockSetChallengeHabit,
      }),
    ),
    { getState: () => ({ openModal: mockOpenModal }) },
  ),
}));

const mockGetChallenges = vi.fn(() => []);
const mockGetBadges = vi.fn(() => []);
const mockSyncChallengeProgress = vi.fn(() => []);

vi.mock('@/lib/challengeStorage', () => ({
  getChallenges: () => mockGetChallenges(),
  getBadges: () => mockGetBadges(),
  syncChallengeProgress: (...args: unknown[]) => mockSyncChallengeProgress(...args),
}));

const mockCheckFeatureUnlock = vi.fn(() => ({ shouldUnlock: false }));
const mockUnlockFeature = vi.fn();

vi.mock('@/lib/onboardingFlow', () => ({
  checkFeatureUnlock: (...args: unknown[]) => mockCheckFeatureUnlock(...args),
  unlockFeature: (...args: unknown[]) => mockUnlockFeature(...args),
}));

vi.mock('@/lib/safeJson', () => ({
  safeLocalStorageGet: vi.fn(() => ({})),
}));

// --- import under test after mocks ---

import { useChallengeHandlers } from '../useChallengeHandlers';
import type { Habit, MoodEntry, FocusSession, GratitudeEntry } from '@/types';

describe('useChallengeHandlers', () => {
  const mockSetChallenges = vi.fn();
  const mockSetBadges = vi.fn();

  const defaultParams = {
    safeMoods: [] as MoodEntry[],
    safeHabits: [] as Habit[],
    safeFocusSessions: [] as FocusSession[],
    safeGratitudeEntries: [] as GratitudeEntry[],
    currentActiveStreak: 5,
    setChallenges: mockSetChallenges,
    setBadges: mockSetBadges,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checkForFeatureUnlocks calls checkFeatureUnlock for each feature', () => {
    const { result } = renderHook(() => useChallengeHandlers(defaultParams));

    act(() => {
      result.current.checkForFeatureUnlocks();
    });

    // Should check 5 features: focusTimer, xp, quests, tasks, challenges
    expect(mockCheckFeatureUnlock).toHaveBeenCalledTimes(5);
    expect(mockCheckFeatureUnlock).toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'focusTimer' }),
    );
    expect(mockCheckFeatureUnlock).toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'challenges' }),
    );
  });

  it('unlocks feature when shouldUnlock is true and breaks loop', () => {
    mockCheckFeatureUnlock
      .mockReturnValueOnce({ shouldUnlock: false }) // focusTimer
      .mockReturnValueOnce({ shouldUnlock: true }); // xp

    const { result } = renderHook(() => useChallengeHandlers(defaultParams));

    act(() => {
      result.current.checkForFeatureUnlocks();
    });

    expect(mockUnlockFeature).toHaveBeenCalledWith('xp');
    expect(mockSetFeatureToUnlock).toHaveBeenCalledWith('xp');
    // Should stop after first unlock (break)
    expect(mockCheckFeatureUnlock).toHaveBeenCalledTimes(2);
  });

  it('updateChallengeProgress computes stats and calls syncChallengeProgress', () => {
    const params = {
      ...defaultParams,
      safeMoods: [{ id: 'm1', mood: 'good' as const, date: '2026-02-19', timestamp: 1 }],
      safeFocusSessions: [{ id: 'f1', duration: 30, completedAt: 1, date: '2026-02-19' }],
      safeGratitudeEntries: [{ id: 'g1', text: 'grateful', date: '2026-02-19', timestamp: 1 }],
      safeHabits: [makeTestHabit({
        id: 'h1', name: 'Meditate', icon: '🧘',
        entries: datesToEntries(['2026-02-19']),
      })],
    };

    const { result } = renderHook(() => useChallengeHandlers(params));

    act(() => {
      result.current.updateChallengeProgress();
    });

    expect(mockSyncChallengeProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        totalFocusMinutes: 30,
        habitsCompleted: 1,
        moodEntries: 1,
        gratitudeEntries: 1,
        currentStreak: 5,
      }),
      30, // totalFocusMinutes
      1,  // totalGratitude
    );
    expect(mockSetChallenges).toHaveBeenCalled();
  });

  it('updateChallengeProgress updates badges when new badges found', () => {
    mockSyncChallengeProgress.mockReturnValueOnce([{ id: 'badge1' }]);

    const { result } = renderHook(() => useChallengeHandlers(defaultParams));

    act(() => {
      result.current.updateChallengeProgress();
    });

    expect(mockSetBadges).toHaveBeenCalled();
  });

  it('handleOpenChallenge opens modal with optional habit', () => {
    const { result } = renderHook(() => useChallengeHandlers(defaultParams));
    const testHabit = makeTestHabit({
      id: 'h1', name: 'Meditate', icon: '🧘',
      entries: {},
    });

    act(() => {
      result.current.handleOpenChallenge(testHabit);
    });

    expect(mockSetChallengeHabit).toHaveBeenCalledWith(testHabit);
    expect(mockOpenModal).toHaveBeenCalledWith('showChallengeModal');
  });

  it('perfect days calculation counts days where ALL habits are completed', () => {
    const params = {
      ...defaultParams,
      safeHabits: [
        makeTestHabit({
          id: 'h1', name: 'A', icon: '🧘',
          entries: datesToEntries(['2026-02-18', '2026-02-19']),
        }),
        makeTestHabit({
          id: 'h2', name: 'B', icon: '📚',
          entries: datesToEntries(['2026-02-19']),
        }),
      ],
    };

    const { result } = renderHook(() => useChallengeHandlers(params));

    act(() => {
      result.current.updateChallengeProgress();
    });

    // Only 2026-02-19 has both habits completed → perfectDaysCount = 1
    const userStats = mockSyncChallengeProgress.mock.calls[0][0] as Record<string, unknown>;
    expect(userStats.perfectDaysCount).toBe(1);
  });

  it('zen master days counts days with mood + all habits + focus + gratitude', () => {
    const params = {
      ...defaultParams,
      safeMoods: [
        { id: 'm1', mood: 'good' as const, date: '2026-02-19', timestamp: 1 },
      ],
      safeFocusSessions: [
        { id: 'f1', duration: 25, completedAt: 1, date: '2026-02-19' },
      ],
      safeGratitudeEntries: [
        { id: 'g1', text: 'test', date: '2026-02-19', timestamp: 1 },
      ],
      safeHabits: [makeTestHabit({
        id: 'h1', name: 'Meditate', icon: '🧘',
        entries: datesToEntries(['2026-02-19']),
      })],
    };

    const { result } = renderHook(() => useChallengeHandlers(params));

    act(() => {
      result.current.updateChallengeProgress();
    });

    const userStats = mockSyncChallengeProgress.mock.calls[0][0] as Record<string, unknown>;
    expect(userStats.zenMasterDays).toBe(1);
  });
});
