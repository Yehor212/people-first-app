/**
 * useOnboardingEffects Hook Tests
 * Tests progressive onboarding initialization and re-engagement detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// --- mocks ---

const mockOpenModal = vi.fn();
const mockSetWelcomeBackData = vi.fn();

vi.mock('@/stores', () => ({
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      onboardingComplete: true,
      moods: [{ id: 'm1', date: '2026-02-19' }],
      habits: [{ id: 'h1', entries: { '2026-02-19': { value: 2 } } }],
      focusSessions: [{ id: 'f1', date: '2026-02-19' }],
    }),
  ),
  useUIStore: Object.assign(
    vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
      sel({ setWelcomeBackData: mockSetWelcomeBackData }),
    ),
    { getState: () => ({ openModal: mockOpenModal }) },
  ),
}));

const mockInitializeOnboarding = vi.fn();
const mockShouldShowWelcome = vi.fn(() => false);
const mockUpdateOnboardingProgress = vi.fn();

vi.mock('@/lib/onboardingFlow', () => ({
  initializeOnboarding: (...args: unknown[]) => mockInitializeOnboarding(...args),
  shouldShowWelcome: () => mockShouldShowWelcome(),
  updateOnboardingProgress: () => mockUpdateOnboardingProgress(),
}));

const mockShouldShowWelcomeBack = vi.fn(() => false);
const mockMarkWelcomeBackShown = vi.fn();
const mockGetDaysSinceLastActive = vi.fn(() => 0);
const mockCalculateHabitSuccessRates = vi.fn((_habits: unknown) => [] as any[]);
const mockWasStreakBroken = vi.fn((_streak: unknown, _days: unknown, _restDays: unknown) => false);
const mockUpdateLastActiveDate = vi.fn();

vi.mock('@/lib/reEngagement', () => ({
  shouldShowWelcomeBack: () => mockShouldShowWelcomeBack(),
  markWelcomeBackShown: () => mockMarkWelcomeBackShown(),
  getDaysSinceLastActive: () => mockGetDaysSinceLastActive(),
  calculateHabitSuccessRates: (habits: unknown) => mockCalculateHabitSuccessRates(habits),
  wasStreakBroken: (streak: unknown, days: unknown, restDays: unknown) => mockWasStreakBroken(streak, days, restDays),
  updateLastActiveDate: () => mockUpdateLastActiveDate(),
}));

// --- import under test after mocks ---

import { useOnboardingEffects } from '../useOnboardingEffects';
import { useUserDataStore, useUIStore } from '@/stores';

describe('useOnboardingEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultParams = {
    isLoading: false,
    innerWorldStreak: 5,
    innerWorldRestDays: [] as string[],
  };

  it('skips when isLoading is true', () => {
    renderHook(() => useOnboardingEffects({ ...defaultParams, isLoading: true }));

    expect(mockInitializeOnboarding).not.toHaveBeenCalled();
    expect(mockUpdateLastActiveDate).not.toHaveBeenCalled();
  });

  it('skips when onboardingComplete is false', () => {
    (useUserDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (sel: (s: Record<string, unknown>) => unknown) =>
        sel({
          onboardingComplete: false,
          moods: [],
          habits: [],
          focusSessions: [],
        }),
    );

    renderHook(() => useOnboardingEffects(defaultParams));

    expect(mockInitializeOnboarding).not.toHaveBeenCalled();
    expect(mockUpdateLastActiveDate).not.toHaveBeenCalled();
  });

  it('calls initializeOnboarding and updateOnboardingProgress when loaded', () => {
    // Reset to default mock (onboardingComplete: true)
    (useUserDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (sel: (s: Record<string, unknown>) => unknown) =>
        sel({
          onboardingComplete: true,
          moods: [{ id: 'm1' }],
          habits: [],
          focusSessions: [],
        }),
    );

    renderHook(() => useOnboardingEffects(defaultParams));

    expect(mockInitializeOnboarding).toHaveBeenCalledWith({ hasExistingData: true });
    expect(mockUpdateOnboardingProgress).toHaveBeenCalled();
  });

  it('opens showWelcomeOverlay when shouldShowWelcome returns true', () => {
    mockShouldShowWelcome.mockReturnValue(true);

    (useUserDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (sel: (s: Record<string, unknown>) => unknown) =>
        sel({
          onboardingComplete: true,
          moods: [],
          habits: [],
          focusSessions: [],
        }),
    );

    renderHook(() => useOnboardingEffects(defaultParams));

    expect(mockOpenModal).toHaveBeenCalledWith('showWelcomeOverlay');
  });

  it('calls updateLastActiveDate when loaded', () => {
    (useUserDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (sel: (s: Record<string, unknown>) => unknown) =>
        sel({
          onboardingComplete: true,
          moods: [],
          habits: [],
          focusSessions: [],
        }),
    );

    renderHook(() => useOnboardingEffects(defaultParams));

    expect(mockUpdateLastActiveDate).toHaveBeenCalled();
  });

  it('shows welcome back when shouldShowWelcomeBack returns true', () => {
    mockShouldShowWelcomeBack.mockReturnValue(true);
    mockGetDaysSinceLastActive.mockReturnValue(5);
    mockCalculateHabitSuccessRates.mockReturnValue([{ name: 'Meditate', rate: 80 }]);
    mockWasStreakBroken.mockReturnValue(true);

    (useUserDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (sel: (s: Record<string, unknown>) => unknown) =>
        sel({
          onboardingComplete: true,
          moods: [],
          habits: [{ id: 'h1', entries: {} }],
          focusSessions: [],
        }),
    );

    (useUIStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (sel: (s: Record<string, unknown>) => unknown) =>
        sel({ setWelcomeBackData: mockSetWelcomeBackData }),
    );

    renderHook(() => useOnboardingEffects({ ...defaultParams, innerWorldStreak: 10 }));

    expect(mockSetWelcomeBackData).toHaveBeenCalledWith({
      daysAway: 5,
      streakBroken: true,
      currentStreak: 10,
      topHabits: [{ name: 'Meditate', rate: 80 }],
    });
    expect(mockOpenModal).toHaveBeenCalledWith('showWelcomeBack');
    expect(mockMarkWelcomeBackShown).toHaveBeenCalled();
  });
});
