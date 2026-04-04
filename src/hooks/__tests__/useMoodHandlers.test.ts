/**
 * useMoodHandlers Hook Tests
 * Tests mood entry creation, quick mood, and update handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- mocks ---

const mockSetMoods = vi.fn();
const mockRewardUser = vi.fn();
const mockUpdateChallengeProgress = vi.fn();
const mockTriggerSync = vi.fn();

vi.mock('@/stores', () => ({
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ setMoods: mockSetMoods }),
  ),
  useGamificationStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ rewardUser: mockRewardUser }),
  ),
}));

vi.mock('@/lib/utils', () => ({
  getToday: vi.fn(() => '2026-02-19'),
  generateId: vi.fn(() => 'test-id'),
}));

vi.mock('@/storage/cloudSync', () => ({
  triggerSync: (...args: unknown[]) => mockTriggerSync(...args),
}));

vi.mock('@/lib/haptics', () => ({
  haptics: { moodSaved: 'moodSaved' },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn() },
}));

// --- import under test after mocks ---

import { useMoodHandlers } from '../useMoodHandlers';

describe('useMoodHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderMoodHandlers = () =>
    renderHook(() =>
      useMoodHandlers({ updateChallengeProgress: mockUpdateChallengeProgress }),
    );

  it('handleAddMood calls setMoods with new entry appended', () => {
    const { result } = renderMoodHandlers();

    const entry = { id: '1', mood: 'good' as const, date: '2026-02-19', timestamp: 1000 };
    act(() => {
      result.current.handleAddMood(entry);
    });

    expect(mockSetMoods).toHaveBeenCalledTimes(1);
    // The updater function should append the entry
    const updater = mockSetMoods.mock.calls[0][0];
    expect(updater([])).toEqual([expect.objectContaining(entry)]);
  });

  it('handleAddMood calls rewardUser with mood treats', () => {
    const { result } = renderMoodHandlers();

    const entry = { id: '2', mood: 'great' as const, date: '2026-02-19', timestamp: 2000 };
    act(() => {
      result.current.handleAddMood(entry);
    });

    expect(mockRewardUser).toHaveBeenCalledWith('mood', {
      treats: 5,
      treatReason: 'Logged mood',
      haptic: 'moodSaved',
      seedExtra: 'great',
    });
  });

  it('handleAddMood calls updateChallengeProgress', () => {
    const { result } = renderMoodHandlers();

    const entry = { id: '3', mood: 'okay' as const, date: '2026-02-19', timestamp: 3000 };
    act(() => {
      result.current.handleAddMood(entry);
    });

    expect(mockUpdateChallengeProgress).toHaveBeenCalledTimes(1);
  });

  it('handleQuickMood creates entry with generated id and today date', () => {
    const { result } = renderMoodHandlers();

    act(() => {
      result.current.handleQuickMood('bad');
    });

    expect(mockSetMoods).toHaveBeenCalledTimes(1);
    const updater = mockSetMoods.mock.calls[0][0];
    const created = updater([])[0];
    expect(created).toMatchObject({
      id: 'test-id',
      mood: 'bad',
      date: '2026-02-19',
    });
    expect(created.timestamp).toEqual(expect.any(Number));
  });

  it('handleUpdateMood updates specific entry mood and triggers sync', () => {
    const { result } = renderMoodHandlers();

    act(() => {
      result.current.handleUpdateMood('entry-1', 'great', 'feeling better');
    });

    expect(mockSetMoods).toHaveBeenCalledTimes(1);
    // Verify the updater correctly maps entries
    const updater = mockSetMoods.mock.calls[0][0];
    const existing = [
      { id: 'entry-1', mood: 'bad', date: '2026-02-19', timestamp: 100, note: 'old' },
      { id: 'entry-2', mood: 'okay', date: '2026-02-19', timestamp: 200 },
    ];
    const updated = updater(existing);
    expect(updated[0].mood).toBe('great');
    expect(updated[0].note).toBe('feeling better');
    expect(updated[1].mood).toBe('okay');

    expect(mockTriggerSync).toHaveBeenCalledTimes(1);
  });
});
