/**
 * Feature Flags Context
 *
 * Allows users to enable/disable app modules through Settings.
 * Works alongside the progressive unlock system from onboardingFlow.ts
 * AND the behavioral Garden Gate system (IA Blueprint Phase 5).
 *
 * Core features (mood, habits) are always enabled.
 * Other features can be toggled by the user after being unlocked.
 */

import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { isFeatureUnlocked, FeatureId, computeGardenGateStage, getFeaturesForGardenStage } from '@/lib/onboardingFlow';
import { SK } from '@/lib/storageKeys';
import { useUserDataStore } from '@/stores';
import { getToday } from '@/lib/utils';

// All toggleable features
export type ToggleableFeature =
  | 'focusTimer'
  | 'breathingExercise'
  | 'gratitudeJournal'
  | 'quests'
  | 'tasks'
  | 'challenges'
  | 'aiCoach'
  | 'innerWorld';

// Feature flags state
export interface FeatureFlags {
  focusTimer: boolean;
  breathingExercise: boolean;
  gratitudeJournal: boolean;
  quests: boolean;
  tasks: boolean;
  challenges: boolean;
  aiCoach: boolean;
  innerWorld: boolean;
}

// Default: all features enabled (except AI Coach - temporarily hidden)
const DEFAULT_FLAGS: FeatureFlags = {
  focusTimer: true,
  breathingExercise: true,
  gratitudeJournal: true,
  quests: true,
  tasks: true,
  challenges: true,
  aiCoach: false, // Hidden until AI is working
  innerWorld: true,
};

interface FeatureFlagsContextType {
  flags: FeatureFlags;
  setFlag: (feature: ToggleableFeature, enabled: boolean) => void;
  isFeatureEnabled: (feature: ToggleableFeature) => boolean;
  isFeatureVisible: (feature: ToggleableFeature) => boolean;
  resetFlags: () => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

// Map toggleable features to onboarding feature IDs
const FEATURE_TO_ONBOARDING: Partial<Record<ToggleableFeature, FeatureId>> = {
  focusTimer: 'focusTimer',
  quests: 'quests',
  tasks: 'tasks',
  challenges: 'challenges',
};

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useLocalStorage<FeatureFlags>(SK.FEATURE_FLAGS, DEFAULT_FLAGS);

  // Garden Gate stats from user data (IA Blueprint Phase 5)
  const habits = useUserDataStore(s => s.habits);
  const focusSessions = useUserDataStore(s => s.focusSessions);
  const moods = useUserDataStore(s => s.moods);

  // Compute garden gate features from behavioral stats
  const gardenGateFeatures = useMemo(() => {
    const today = getToday();
    const habitsCompleted = habits.reduce((sum, h) => sum + (h.completedDates?.length || 0), 0);
    const focusSessionsCompleted = focusSessions.length;
    // Approximate daysActive from unique mood dates
    const uniqueDates = new Set(moods.map(m => m.date || today));
    const daysActive = uniqueDates.size;

    const stage = computeGardenGateStage({
      habitsCompleted,
      focusSessionsCompleted,
      journalEntries: 0, // Journal entries not in store — blooming requires calendar-based unlock
      daysActive,
    });

    return getFeaturesForGardenStage(stage);
  }, [habits, focusSessions, moods]);

  // Set a single feature flag
  const setFlag = useCallback((feature: ToggleableFeature, enabled: boolean) => {
    setFlags(prev => ({
      ...prev,
      [feature]: enabled,
    }));
  }, [setFlags]);

  // Check if feature is enabled by user
  const isFeatureEnabled = useCallback((feature: ToggleableFeature): boolean => {
    return flags[feature] ?? true;
  }, [flags]);

  // Check if feature should be visible (unlocked by onboarding OR garden gate, AND enabled by user)
  const isFeatureVisible = useCallback((feature: ToggleableFeature): boolean => {
    // Check user toggle first
    if (!isFeatureEnabled(feature)) {
      return false;
    }

    // Check if feature has onboarding unlock requirement
    const onboardingFeature = FEATURE_TO_ONBOARDING[feature];
    if (onboardingFeature) {
      // Calendar-based unlock OR behavioral garden gate unlock
      if (isFeatureUnlocked(onboardingFeature)) return true;
      if (gardenGateFeatures.includes(onboardingFeature)) return true;
      return false;
    }

    // Features without onboarding requirements are always unlocked
    return true;
  }, [isFeatureEnabled, gardenGateFeatures]);

  // Reset all flags to defaults
  const resetFlags = useCallback(() => {
    setFlags(DEFAULT_FLAGS);
  }, [setFlags]);

  const value = useMemo(() => ({
    flags,
    setFlag,
    isFeatureEnabled,
    isFeatureVisible,
    resetFlags,
  }), [flags, setFlag, isFeatureEnabled, isFeatureVisible, resetFlags]);

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
}

// Convenience hook for checking a single feature
export function useFeatureVisible(feature: ToggleableFeature): boolean {
  const { isFeatureVisible } = useFeatureFlags();
  return isFeatureVisible(feature);
}
