/**
 * useFocusHandlers Hook Tests
 * Tests focus session completion, treat rewards, and mindful moment trigger.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- mocks ---

const mockSetFocusSessions = vi.fn();
const mockRewardUser = vi.fn();
const mockEarnTreats = vi.fn(() => ({ earned: 10 }));
const mockUpdateChallengeProgress = vi.fn();
const mockCheckForFeatureUnlocks = vi.fn();
const mockOpenModal = vi.fn();

vi.mock('@/stores', () => ({
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ setFocusSessions: mockSetFocusSessions }),
  ),
  useGamificationStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ rewardUser: mockRewardUser }),
  ),
  useUIStore: Object.assign(
    vi.fn(() => ({})),
    { getState: () => ({ openModal: mockOpenModal }) },
  ),
}));

vi.mock('@/components/XpPopup', () => ({
  triggerXpPopup: vi.fn(),
}));

vi.mock('@/lib/haptics', () => ({
  haptics: { focusCompleted: 'focusCompleted' },
}));

vi.mock('@/lib/offlineQueueHandlers', () => ({
  queueFocusSessionSync: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/randomQuests', () => ({
  updateAllQuestsProgress: vi.fn(() => []),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn() },
}));

// --- import under test after mocks ---

import { useFocusHandlers } from '../useFocusHandlers';

describe('useFocusHandlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderFocusHandlers = () =>
    renderHook(() =>
      useFocusHandlers({
        earnTreats: mockEarnTreats,
        updateChallengeProgress: mockUpdateChallengeProgress,
        checkForFeatureUnlocks: mockCheckForFeatureUnlocks,
      }),
    );

  const makeSession = (duration: number) => ({
    id: 'focus-1',
    duration,
    completedAt: Date.now(),
    date: '2026-02-19',
  });

  it('handleCompleteFocusSession adds session to store', () => {
    const { result } = renderFocusHandlers();
    const session = makeSession(10);

    act(() => {
      result.current.handleCompleteFocusSession(session);
    });

    expect(mockSetFocusSessions).toHaveBeenCalledTimes(1);
    const updater = mockSetFocusSessions.mock.calls[0][0];
    expect(updater([])).toEqual([expect.objectContaining(session)]);
  });

  it('handleCompleteFocusSession rewards treats based on duration', () => {
    const { result } = renderFocusHandlers();
    const session = makeSession(20);

    act(() => {
      result.current.handleCompleteFocusSession(session);
    });

    // Math.round(20 * 0.5) = 10
    expect(mockRewardUser).toHaveBeenCalledWith('focus', {
      treats: 10,
      treatReason: 'Focus 20min',
      haptic: 'focusCompleted',
    });
  });

  it('handleCompleteFocusSession shows mindful moment for sessions >= 5min', () => {
    const { result } = renderFocusHandlers();
    const session = makeSession(5);

    act(() => {
      result.current.handleCompleteFocusSession(session);
    });

    // Advance past the 500ms timeout for the mindful moment modal
    vi.advanceTimersByTime(600);

    expect(mockOpenModal).toHaveBeenCalledWith('showMindfulMoment');
  });

  it('handleCompleteFocusSession skips mindful moment for sessions < 5min', () => {
    const { result } = renderFocusHandlers();
    const session = makeSession(4);

    act(() => {
      result.current.handleCompleteFocusSession(session);
    });

    vi.advanceTimersByTime(600);

    expect(mockOpenModal).not.toHaveBeenCalled();
  });

  it('handleMindfulMomentComplete calls earnTreats', () => {
    const { result } = renderFocusHandlers();

    act(() => {
      result.current.handleMindfulMomentComplete();
    });

    expect(mockEarnTreats).toHaveBeenCalledWith('mindful', 1, 'Mindful Moment');
  });
});
