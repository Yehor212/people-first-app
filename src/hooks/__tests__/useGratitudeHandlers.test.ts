/**
 * useGratitudeHandlers Hook Tests
 * Tests gratitude entry creation, creature interactions, and gamification rewards.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- mocks ---

const mockSetGratitudeEntries = vi.fn();
const mockRewardUser = vi.fn();
const mockEarnTreats = vi.fn(() => ({ earned: 5 }));
const mockAttractCreature = vi.fn();
const mockFeedCreatures = vi.fn();
const mockUpdateChallengeProgress = vi.fn();

vi.mock('@/stores', () => ({
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ setGratitudeEntries: mockSetGratitudeEntries }),
  ),
  useGamificationStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ rewardUser: mockRewardUser }),
  ),
  useUIStore: vi.fn(),
}));

vi.mock('@/components/XpPopup', () => ({
  triggerXpPopup: vi.fn(),
}));

vi.mock('@/lib/haptics', () => ({
  haptics: { gratitudeSaved: 'gratitudeSaved' },
}));

vi.mock('@/lib/randomQuests', () => ({
  updateAllQuestsProgress: vi.fn(() => []),
}));

// --- import under test after mocks ---

import { useGratitudeHandlers } from '../useGratitudeHandlers';

describe('useGratitudeHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderGratitudeHandlers = () =>
    renderHook(() =>
      useGratitudeHandlers({
        earnTreats: mockEarnTreats,
        attractCreature: mockAttractCreature,
        feedCreatures: mockFeedCreatures,
        updateChallengeProgress: mockUpdateChallengeProgress,
      }),
    );

  const makeEntry = () => ({
    id: 'grat-1',
    text: 'Thankful for sunshine',
    date: '2026-02-19',
    timestamp: Date.now(),
  });

  it('handleAddGratitude adds entry to store', () => {
    const { result } = renderGratitudeHandlers();
    const entry = makeEntry();

    act(() => {
      result.current.handleAddGratitude(entry);
    });

    expect(mockSetGratitudeEntries).toHaveBeenCalledTimes(1);
    const updater = mockSetGratitudeEntries.mock.calls[0][0];
    expect(updater([])).toEqual([entry]);
  });

  it('handleAddGratitude rewards user with treats', () => {
    const { result } = renderGratitudeHandlers();
    const entry = makeEntry();

    act(() => {
      result.current.handleAddGratitude(entry);
    });

    expect(mockRewardUser).toHaveBeenCalledWith('gratitude', {
      treats: 8,
      treatReason: 'Gratitude entry',
      haptic: 'gratitudeSaved',
    });
  });

  it('handleAddGratitude calls feedCreatures', () => {
    const { result } = renderGratitudeHandlers();
    const entry = makeEntry();

    act(() => {
      result.current.handleAddGratitude(entry);
    });

    expect(mockFeedCreatures).toHaveBeenCalledTimes(1);
  });

  it('handleAddGratitude calls updateChallengeProgress', () => {
    const { result } = renderGratitudeHandlers();
    const entry = makeEntry();

    act(() => {
      result.current.handleAddGratitude(entry);
    });

    expect(mockUpdateChallengeProgress).toHaveBeenCalledTimes(1);
  });

});
