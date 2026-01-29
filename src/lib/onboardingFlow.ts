/**
 * Progressive Onboarding Flow
 *
 * Reduces cognitive overload by unlocking features gradually over 4 days.
 * Existing users (with data) skip onboarding entirely.
 *
 * Day 1: Mood tracker + Habits (core functionality)
 * Day 2: Focus timer (after completing 1 habit)
 * Day 3: XP/Quests/Companion (after 2 focus sessions)
 * Day 4+: Tasks/Challenges (full access)
 */

import { logger } from '@/lib/logger';
import { safeJsonParse } from '@/lib/safeJson';

const ONBOARDING_STORAGE_KEY = 'zenflow_onboarding_state';

export interface OnboardingState {
  isNewUser: boolean; // false for existing users (skip onboarding)
  firstLoginDate: number; // timestamp
  daysActive: number; // 1-4+
  unlockedFeatures: FeatureId[];
  completedSteps: TutorialStep[];
  hasSeenWelcome: boolean;
}

// Features that can be locked/unlocked
export type FeatureId =
  | 'mood' // Always unlocked
  | 'habits' // Always unlocked
  | 'focusTimer' // Day 2
  | 'xp' // Day 3
  | 'quests' // Day 3
  | 'companion' // Day 3
  | 'tasks' // Day 4
  | 'challenges'; // Day 4

// Tutorial steps
export type TutorialStep =
  | 'welcome' // Welcome message
  | 'mood-first' // First mood entry
  | 'habit-created' // First habit created
  | 'habit-completed' // First habit completed
  | 'focus-first' // First focus session
  | 'xp-explanation' // XP system explained
  | 'quest-first'; // First quest shown

// Unlock conditions
interface UnlockCondition {
  feature: FeatureId;
  day: number; // Minimum day
  requires?: {
    type: 'habit-completed' | 'focus-sessions' | 'mood-entries';
    count: number;
  };
  description: string;
}

const UNLOCK_CONDITIONS: UnlockCondition[] = [
  { feature: 'mood', day: 1, description: 'Always available' },
  { feature: 'habits', day: 1, description: 'Always available' },
  {
    feature: 'focusTimer',
    day: 2,
    requires: { type: 'habit-completed', count: 1 },
    description: 'Complete 1 habit to unlock',
  },
  {
    feature: 'xp',
    day: 3,
    requires: { type: 'focus-sessions', count: 2 },
    description: 'Complete 2 focus sessions to unlock',
  },
  {
    feature: 'quests',
    day: 3,
    requires: { type: 'focus-sessions', count: 2 },
    description: 'Complete 2 focus sessions to unlock',
  },
  {
    feature: 'companion',
    day: 3,
    requires: { type: 'focus-sessions', count: 2 },
    description: 'Complete 2 focus sessions to unlock',
  },
  {
    feature: 'tasks',
    day: 4,
    description: 'Available from Day 4',
  },
  {
    feature: 'challenges',
    day: 4,
    description: 'Available from Day 4',
  },
];

/**
 * Get onboarding state from localStorage
 */
export function getOnboardingState(): OnboardingState {
  const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
  if (stored) {
    const parsed = safeJsonParse<OnboardingState | null>(stored, null);
    if (parsed) {
      return parsed;
    }
  }

  // Default state for new users
  return {
    isNewUser: true,
    firstLoginDate: Date.now(),
    daysActive: 1,
    unlockedFeatures: ['mood', 'habits'],
    completedSteps: [],
    hasSeenWelcome: false,
  };
}

/**
 * Save onboarding state to localStorage
 */
export function saveOnboardingState(state: OnboardingState): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    logger.error('[Onboarding] Failed to save state:', error);
  }
}

/**
 * Initialize onboarding for a user
 * Detects existing users (skip onboarding) vs new users
 */
export function initializeOnboarding(options: {
  hasExistingData: boolean; // User has moods/habits/etc
}): OnboardingState {
  const state = getOnboardingState();

  // Existing users skip onboarding entirely
  if (options.hasExistingData && state.isNewUser) {
    logger.log('[Onboarding] Existing user detected - skipping onboarding');
    const allFeatures: FeatureId[] = [
      'mood',
      'habits',
      'focusTimer',
      'xp',
      'quests',
      'companion',
      'tasks',
      'challenges',
    ];

    const updatedState: OnboardingState = {
      ...state,
      isNewUser: false,
      daysActive: 99, // Mark as veteran user
      unlockedFeatures: allFeatures,
      hasSeenWelcome: true,
    };

    saveOnboardingState(updatedState);
    return updatedState;
  }

  return state;
}

/**
 * Calculate which day the user is on (1-4+)
 */
export function calculateDaysActive(firstLoginDate: number): number {
  const daysSinceFirst = Math.floor(
    (Date.now() - firstLoginDate) / (1000 * 60 * 60 * 24)
  );
  return Math.min(daysSinceFirst + 1, 4); // Cap at day 4
}

/**
 * Update onboarding state (call daily or on app open)
 */
export function updateOnboardingProgress(): OnboardingState {
  const state = getOnboardingState();

  // Skip for existing users
  if (!state.isNewUser) {
    return state;
  }

  const newDaysActive = calculateDaysActive(state.firstLoginDate);

  // Day changed - unlock time-based features
  if (newDaysActive > state.daysActive) {
    logger.log(`[Onboarding] Day ${newDaysActive} - checking for new unlocks`);

    const newUnlocks = UNLOCK_CONDITIONS.filter(
      (condition) =>
        condition.day <= newDaysActive &&
        !state.unlockedFeatures.includes(condition.feature) &&
        !condition.requires // Only time-based unlocks here
    ).map((c) => c.feature);

    if (newUnlocks.length > 0) {
      const updatedState: OnboardingState = {
        ...state,
        daysActive: newDaysActive,
        unlockedFeatures: [...state.unlockedFeatures, ...newUnlocks],
      };

      saveOnboardingState(updatedState);
      return updatedState;
    }
  }

  return state;
}

/**
 * Check if a feature should be unlocked based on user progress
 */
export function checkFeatureUnlock(options: {
  feature: FeatureId;
  stats: {
    habitsCompleted: number;
    focusSessionsCompleted: number;
    moodEntriesCount: number;
  };
}): { shouldUnlock: boolean; reason?: string } {
  const state = getOnboardingState();

  // Already unlocked
  if (state.unlockedFeatures.includes(options.feature)) {
    return { shouldUnlock: false };
  }

  // Skip for existing users
  if (!state.isNewUser) {
    return { shouldUnlock: false };
  }

  const condition = UNLOCK_CONDITIONS.find((c) => c.feature === options.feature);
  if (!condition) {
    return { shouldUnlock: false };
  }

  // Check day requirement
  const currentDay = calculateDaysActive(state.firstLoginDate);
  if (currentDay < condition.day) {
    return { shouldUnlock: false };
  }

  // Check progress requirements
  if (condition.requires) {
    const { type, count } = condition.requires;

    switch (type) {
      case 'habit-completed':
        if (options.stats.habitsCompleted >= count) {
          return { shouldUnlock: true, reason: condition.description };
        }
        break;
      case 'focus-sessions':
        if (options.stats.focusSessionsCompleted >= count) {
          return { shouldUnlock: true, reason: condition.description };
        }
        break;
      case 'mood-entries':
        if (options.stats.moodEntriesCount >= count) {
          return { shouldUnlock: true, reason: condition.description };
        }
        break;
    }

    return { shouldUnlock: false };
  }

  // No requirements - unlock based on day only
  return { shouldUnlock: true, reason: condition.description };
}

/**
 * Unlock a feature and save state
 */
export function unlockFeature(feature: FeatureId): OnboardingState {
  const state = getOnboardingState();

  if (!state.unlockedFeatures.includes(feature)) {
    logger.log(`[Onboarding] Unlocking feature: ${feature}`);

    const updatedState: OnboardingState = {
      ...state,
      unlockedFeatures: [...state.unlockedFeatures, feature],
    };

    saveOnboardingState(updatedState);
    return updatedState;
  }

  return state;
}

/**
 * Mark a tutorial step as completed
 */
export function completeTutorialStep(step: TutorialStep): void {
  const state = getOnboardingState();

  if (!state.completedSteps.includes(step)) {
    const updatedState: OnboardingState = {
      ...state,
      completedSteps: [...state.completedSteps, step],
    };

    saveOnboardingState(updatedState);
  }
}

/**
 * Check if feature is unlocked
 */
export function isFeatureUnlocked(feature: FeatureId): boolean {
  const state = getOnboardingState();
  return !state.isNewUser || state.unlockedFeatures.includes(feature);
}

/**
 * Get unlock progress for UI
 */
export function getUnlockProgress(): {
  day: number;
  maxDay: number;
  unlockedCount: number;
  totalCount: number;
  nextUnlock?: {
    feature: FeatureId;
    requirement: string;
  };
} {
  const state = getOnboardingState();
  const currentDay = calculateDaysActive(state.firstLoginDate);

  // Find next locked feature
  const nextLocked = UNLOCK_CONDITIONS.find(
    (c) => !state.unlockedFeatures.includes(c.feature)
  );

  return {
    day: currentDay,
    maxDay: 4,
    unlockedCount: state.unlockedFeatures.length,
    totalCount: UNLOCK_CONDITIONS.length,
    nextUnlock: nextLocked
      ? {
          feature: nextLocked.feature,
          requirement: nextLocked.description,
        }
      : undefined,
  };
}

/**
 * Reset onboarding (for testing or user request)
 */
export function resetOnboarding(): void {
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  logger.log('[Onboarding] State reset');
}

/**
 * Should show welcome overlay
 */
export function shouldShowWelcome(): boolean {
  const state = getOnboardingState();
  return state.isNewUser && !state.hasSeenWelcome;
}

/**
 * Mark welcome as seen
 */
export function markWelcomeSeen(): void {
  const state = getOnboardingState();
  const updatedState: OnboardingState = {
    ...state,
    hasSeenWelcome: true,
  };
  saveOnboardingState(updatedState);
}
