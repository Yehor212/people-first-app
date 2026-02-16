import { useEffect } from 'react';
import { useUIStore, useUserDataStore } from '@/stores';
import {
  initializeOnboarding,
  shouldShowWelcome,
  updateOnboardingProgress,
} from '@/lib/onboardingFlow';
import {
  shouldShowWelcomeBack,
  markWelcomeBackShown,
  getDaysSinceLastActive,
  calculateHabitSuccessRates,
  wasStreakBroken,
  updateLastActiveDate,
} from '@/lib/reEngagement';

interface UseOnboardingEffectsParams {
  isLoading: boolean;
  innerWorldStreak: number;
  innerWorldRestDays: string[];
}

/**
 * Progressive onboarding initialization and re-engagement detection.
 */
export function useOnboardingEffects({
  isLoading,
  innerWorldStreak,
  innerWorldRestDays,
}: UseOnboardingEffectsParams): void {
  const onboardingComplete = useUserDataStore(s => s.onboardingComplete);
  const moods = useUserDataStore(s => s.moods);
  const habits = useUserDataStore(s => s.habits);
  const focusSessions = useUserDataStore(s => s.focusSessions);
  const setWelcomeBackData = useUIStore(s => s.setWelcomeBackData);

  const safeMoodsLength = Array.isArray(moods) ? moods.length : 0;
  const safeHabitsLength = Array.isArray(habits) ? habits.length : 0;
  const safeFocusLength = Array.isArray(focusSessions) ? focusSessions.length : 0;

  // Initialize Progressive Onboarding
  useEffect(() => {
    if (isLoading || !onboardingComplete) return;

    // Detect existing users (skip onboarding)
    const hasExistingData = safeMoodsLength > 0 || safeHabitsLength > 0 || safeFocusLength > 0;

    // Initialize onboarding state
    initializeOnboarding({ hasExistingData });

    // Update progress (check for day change)
    updateOnboardingProgress();

    // Show welcome overlay for new users
    if (shouldShowWelcome()) {
      useUIStore.getState().openModal('showWelcomeOverlay');
    }
  }, [isLoading, onboardingComplete, safeMoodsLength, safeHabitsLength, safeFocusLength]);

  // Re-engagement detection (Welcome Back for 3+ day absence)
  useEffect(() => {
    if (isLoading || !onboardingComplete) return;

    // Update last active date
    updateLastActiveDate();

    // Check if we should show welcome back modal
    if (shouldShowWelcomeBack()) {
      const daysAway = getDaysSinceLastActive();
      const safeHabits = Array.isArray(habits) ? habits : [];
      const topHabits = calculateHabitSuccessRates(safeHabits);
      const streakBroken = wasStreakBroken(innerWorldStreak, daysAway, innerWorldRestDays);

      setWelcomeBackData({
        daysAway,
        streakBroken,
        currentStreak: innerWorldStreak,
        topHabits,
      });
      useUIStore.getState().openModal('showWelcomeBack');
      markWelcomeBackShown();
    }
  }, [isLoading, onboardingComplete, habits, innerWorldStreak, innerWorldRestDays, setWelcomeBackData]);
}
