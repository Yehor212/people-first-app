import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── In-memory storage mock ─────────────────────────────────────
let mockStorage: Record<string, unknown> = {};

vi.mock('@/lib/safeJson', () => ({
  safeLocalStorageGet: vi.fn(<T>(key: string, defaultValue: T): T => {
    return key in mockStorage ? (mockStorage[key] as T) : defaultValue;
  }),
  safeLocalStorageSet: vi.fn((key: string, value: unknown): boolean => {
    mockStorage[key] = value;
    return true;
  }),
  storageRemove: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  getOnboardingState,
  saveOnboardingState,
  initializeOnboarding,
  calculateDaysActive,
  updateOnboardingProgress,
  checkFeatureUnlock,
  unlockFeature,
  completeTutorialStep,
  isFeatureUnlocked,
  getUnlockProgress,
  resetOnboarding,
  shouldShowWelcome,
  markWelcomeSeen,
} from '@/lib/onboardingFlow';
import type { OnboardingState, FeatureId } from '@/lib/onboardingFlow';
import { safeLocalStorageSet, storageRemove } from '@/lib/safeJson';
import { logger } from '@/lib/logger';
import { SK } from '@/lib/storageKeys';

const ALL_FEATURES: FeatureId[] = [
  'mood', 'habits', 'focusTimer', 'xp', 'quests', 'companion', 'tasks', 'challenges',
];

beforeEach(() => {
  mockStorage = {};
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── getOnboardingState ─────────────────────────────────────────

describe('getOnboardingState', () => {
  it('returns default state when storage is empty', () => {
    const state = getOnboardingState();
    expect(state.isNewUser).toBe(true);
    expect(state.daysActive).toBe(1);
    expect(state.completedSteps).toEqual([]);
    expect(state.hasSeenWelcome).toBe(false);
  });

  it('default state has all features unlocked', () => {
    const state = getOnboardingState();
    expect(state.unlockedFeatures).toEqual(ALL_FEATURES);
  });

  it('returns stored state when present', () => {
    const stored: OnboardingState = {
      isNewUser: false,
      firstLoginDate: 1000,
      daysActive: 3,
      unlockedFeatures: ['mood', 'habits'],
      completedSteps: ['welcome'],
      hasSeenWelcome: true,
    };
    mockStorage[SK.ONBOARDING_STATE] = stored;
    const state = getOnboardingState();
    expect(state).toEqual(stored);
  });

  it('default state firstLoginDate is near Date.now()', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    const state = getOnboardingState();
    expect(state.firstLoginDate).toBe(Date.now());
  });
});

// ─── saveOnboardingState ────────────────────────────────────────

describe('saveOnboardingState', () => {
  it('saves state to storage via safeLocalStorageSet', () => {
    const state: OnboardingState = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: ['mood'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    saveOnboardingState(state);
    expect(safeLocalStorageSet).toHaveBeenCalledWith(SK.ONBOARDING_STATE, state);
    expect(mockStorage[SK.ONBOARDING_STATE]).toEqual(state);
  });

  it('logs error when safeLocalStorageSet returns false', () => {
    vi.mocked(safeLocalStorageSet).mockReturnValueOnce(false);
    const state: OnboardingState = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: [],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    saveOnboardingState(state);
    expect(logger.error).toHaveBeenCalledWith('[Onboarding] Failed to save state');
  });
});

// ─── initializeOnboarding ───────────────────────────────────────

describe('initializeOnboarding', () => {
  it('marks existing user as non-new with all features and daysActive=99', () => {
    const state = initializeOnboarding({ hasExistingData: true });
    expect(state.isNewUser).toBe(false);
    expect(state.daysActive).toBe(99);
    expect(state.unlockedFeatures).toEqual(ALL_FEATURES);
    expect(state.hasSeenWelcome).toBe(true);
  });

  it('saves state for existing user', () => {
    initializeOnboarding({ hasExistingData: true });
    expect(safeLocalStorageSet).toHaveBeenCalled();
    expect(mockStorage[SK.ONBOARDING_STATE]).toBeDefined();
  });

  it('returns default state for new user (no existing data)', () => {
    const state = initializeOnboarding({ hasExistingData: false });
    expect(state.isNewUser).toBe(true);
    expect(state.daysActive).toBe(1);
  });

  it('does not overwrite if user already marked as non-new', () => {
    const stored: OnboardingState = {
      isNewUser: false,
      firstLoginDate: 1000,
      daysActive: 99,
      unlockedFeatures: ALL_FEATURES,
      completedSteps: ['welcome'],
      hasSeenWelcome: true,
    };
    mockStorage[SK.ONBOARDING_STATE] = stored;
    const state = initializeOnboarding({ hasExistingData: true });
    // Should return stored state since isNewUser is already false
    expect(state).toEqual(stored);
  });
});

// ─── calculateDaysActive ───────────────────────────────────────

describe('calculateDaysActive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns 1 on the same day as first login', () => {
    const now = new Date('2025-06-15T12:00:00Z').getTime();
    vi.setSystemTime(now);
    expect(calculateDaysActive(now)).toBe(1);
  });

  it('returns 2 after one full day', () => {
    const firstLogin = new Date('2025-06-15T12:00:00Z').getTime();
    const oneDayLater = firstLogin + 24 * 60 * 60 * 1000;
    vi.setSystemTime(oneDayLater);
    expect(calculateDaysActive(firstLogin)).toBe(2);
  });

  it('returns 3 after two full days', () => {
    const firstLogin = new Date('2025-06-15T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin + 2 * 24 * 60 * 60 * 1000);
    expect(calculateDaysActive(firstLogin)).toBe(3);
  });

  it('caps at day 4 even after many days', () => {
    const firstLogin = new Date('2025-06-15T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin + 100 * 24 * 60 * 60 * 1000);
    expect(calculateDaysActive(firstLogin)).toBe(4);
  });

  it('returns 1 for partial day (less than 24 hours)', () => {
    const firstLogin = new Date('2025-06-15T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin + 23 * 60 * 60 * 1000); // 23 hours
    expect(calculateDaysActive(firstLogin)).toBe(1);
  });
});

// ─── updateOnboardingProgress ───────────────────────────────────

describe('updateOnboardingProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns state unchanged for non-new user', () => {
    const stored: OnboardingState = {
      isNewUser: false,
      firstLoginDate: 1000,
      daysActive: 99,
      unlockedFeatures: ALL_FEATURES,
      completedSteps: [],
      hasSeenWelcome: true,
    };
    mockStorage[SK.ONBOARDING_STATE] = stored;
    const result = updateOnboardingProgress();
    expect(result).toEqual(stored);
  });

  it('unlocks time-based features (tasks, challenges) on day 4', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(new Date('2025-06-10T12:00:00Z'));

    // Start on day 1 with only mood+habits unlocked
    const stored: OnboardingState = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 1,
      unlockedFeatures: ['mood', 'habits'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    mockStorage[SK.ONBOARDING_STATE] = stored;

    // Advance to day 4 (3 days later)
    vi.setSystemTime(firstLogin + 3 * 24 * 60 * 60 * 1000);
    const result = updateOnboardingProgress();

    // tasks and challenges have no `requires`, so they should be unlocked
    expect(result.unlockedFeatures).toContain('tasks');
    expect(result.unlockedFeatures).toContain('challenges');
    expect(result.daysActive).toBe(4);
  });

  it('does not unlock features requiring progress (focusTimer, xp, quests, companion)', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(new Date('2025-06-10T12:00:00Z'));

    const stored: OnboardingState = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 1,
      unlockedFeatures: ['mood', 'habits'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    mockStorage[SK.ONBOARDING_STATE] = stored;

    // Advance to day 3
    vi.setSystemTime(firstLogin + 2 * 24 * 60 * 60 * 1000);
    const result = updateOnboardingProgress();

    // focusTimer requires habit-completed, xp/quests/companion require focus-sessions
    expect(result.unlockedFeatures).not.toContain('focusTimer');
    expect(result.unlockedFeatures).not.toContain('xp');
    expect(result.unlockedFeatures).not.toContain('quests');
    expect(result.unlockedFeatures).not.toContain('companion');
  });

  it('returns unchanged state if day has not advanced', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(new Date('2025-06-10T12:00:00Z'));

    const stored: OnboardingState = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 1,
      unlockedFeatures: ['mood', 'habits'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    mockStorage[SK.ONBOARDING_STATE] = stored;

    // Same day — no advance
    const result = updateOnboardingProgress();
    expect(result).toEqual(stored);
  });
});

// ─── checkFeatureUnlock ─────────────────────────────────────────

describe('checkFeatureUnlock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns false for already-unlocked feature', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin);
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 1,
      unlockedFeatures: ['mood', 'habits', 'focusTimer'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    const result = checkFeatureUnlock({
      feature: 'focusTimer',
      stats: { habitsCompleted: 5, focusSessionsCompleted: 0, moodEntriesCount: 0 },
    });
    expect(result.shouldUnlock).toBe(false);
  });

  it('returns false for non-new user', () => {
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: false,
      firstLoginDate: 1000,
      daysActive: 99,
      unlockedFeatures: [],
      completedSteps: [],
      hasSeenWelcome: true,
    };
    const result = checkFeatureUnlock({
      feature: 'focusTimer',
      stats: { habitsCompleted: 5, focusSessionsCompleted: 0, moodEntriesCount: 0 },
    });
    expect(result.shouldUnlock).toBe(false);
  });

  it('unlocks focusTimer on day 2+ with 1 habit completed', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin + 24 * 60 * 60 * 1000); // day 2
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 1,
      unlockedFeatures: ['mood', 'habits'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    const result = checkFeatureUnlock({
      feature: 'focusTimer',
      stats: { habitsCompleted: 1, focusSessionsCompleted: 0, moodEntriesCount: 0 },
    });
    expect(result.shouldUnlock).toBe(true);
    expect(result.reason).toBeDefined();
  });

  it('does not unlock focusTimer on day 1', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin);
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 1,
      unlockedFeatures: ['mood', 'habits'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    const result = checkFeatureUnlock({
      feature: 'focusTimer',
      stats: { habitsCompleted: 5, focusSessionsCompleted: 0, moodEntriesCount: 0 },
    });
    expect(result.shouldUnlock).toBe(false);
  });

  it('unlocks xp on day 3+ with 2 focus sessions', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin + 2 * 24 * 60 * 60 * 1000); // day 3
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 2,
      unlockedFeatures: ['mood', 'habits', 'focusTimer'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    const result = checkFeatureUnlock({
      feature: 'xp',
      stats: { habitsCompleted: 3, focusSessionsCompleted: 2, moodEntriesCount: 0 },
    });
    expect(result.shouldUnlock).toBe(true);
  });

  it('does not unlock xp with insufficient focus sessions', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin + 2 * 24 * 60 * 60 * 1000); // day 3
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 2,
      unlockedFeatures: ['mood', 'habits', 'focusTimer'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    const result = checkFeatureUnlock({
      feature: 'xp',
      stats: { habitsCompleted: 3, focusSessionsCompleted: 1, moodEntriesCount: 0 },
    });
    expect(result.shouldUnlock).toBe(false);
  });

  it('unlocks tasks on day 4+ with no additional requirements', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin + 3 * 24 * 60 * 60 * 1000); // day 4
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 3,
      unlockedFeatures: ['mood', 'habits', 'focusTimer', 'xp', 'quests', 'companion'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    const result = checkFeatureUnlock({
      feature: 'tasks',
      stats: { habitsCompleted: 0, focusSessionsCompleted: 0, moodEntriesCount: 0 },
    });
    expect(result.shouldUnlock).toBe(true);
  });
});

// ─── unlockFeature ──────────────────────────────────────────────

describe('unlockFeature', () => {
  it('adds feature to unlockedFeatures if not present', () => {
    const stored: OnboardingState = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: ['mood', 'habits'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    mockStorage[SK.ONBOARDING_STATE] = stored;

    const result = unlockFeature('focusTimer');
    expect(result.unlockedFeatures).toContain('focusTimer');
    expect(result.unlockedFeatures).toContain('mood');
    expect(result.unlockedFeatures).toContain('habits');
  });

  it('does not duplicate already-unlocked feature', () => {
    const stored: OnboardingState = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: ['mood', 'habits', 'focusTimer'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    mockStorage[SK.ONBOARDING_STATE] = stored;

    const result = unlockFeature('focusTimer');
    expect(result.unlockedFeatures.filter((f) => f === 'focusTimer')).toHaveLength(1);
  });

  it('saves state after unlocking', () => {
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: ['mood'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    unlockFeature('habits');
    expect(safeLocalStorageSet).toHaveBeenCalled();
  });
});

// ─── completeTutorialStep ───────────────────────────────────────

describe('completeTutorialStep', () => {
  it('adds step to completedSteps', () => {
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: ALL_FEATURES,
      completedSteps: [],
      hasSeenWelcome: false,
    };
    completeTutorialStep('welcome');
    const saved = mockStorage[SK.ONBOARDING_STATE] as OnboardingState;
    expect(saved.completedSteps).toContain('welcome');
  });

  it('does not duplicate already-completed step', () => {
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: ALL_FEATURES,
      completedSteps: ['welcome'],
      hasSeenWelcome: false,
    };
    completeTutorialStep('welcome');
    const saved = mockStorage[SK.ONBOARDING_STATE] as OnboardingState;
    expect(saved.completedSteps.filter((s) => s === 'welcome')).toHaveLength(1);
  });

  it('saves state after completing a new step', () => {
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: ALL_FEATURES,
      completedSteps: [],
      hasSeenWelcome: false,
    };
    vi.clearAllMocks();
    completeTutorialStep('mood-first');
    expect(safeLocalStorageSet).toHaveBeenCalled();
  });
});

// ─── isFeatureUnlocked ──────────────────────────────────────────

describe('isFeatureUnlocked', () => {
  it('returns true for non-new user regardless of unlockedFeatures', () => {
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: false,
      firstLoginDate: 1000,
      daysActive: 99,
      unlockedFeatures: [],
      completedSteps: [],
      hasSeenWelcome: true,
    };
    expect(isFeatureUnlocked('focusTimer')).toBe(true);
    expect(isFeatureUnlocked('tasks')).toBe(true);
  });

  it('returns true for new user if feature is in unlockedFeatures', () => {
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: ['mood', 'habits'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    expect(isFeatureUnlocked('mood')).toBe(true);
    expect(isFeatureUnlocked('habits')).toBe(true);
  });

  it('returns false for new user if feature is not unlocked', () => {
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: ['mood', 'habits'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    expect(isFeatureUnlocked('focusTimer')).toBe(false);
    expect(isFeatureUnlocked('tasks')).toBe(false);
  });
});

// ─── getUnlockProgress ──────────────────────────────────────────

describe('getUnlockProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns correct counts for fully unlocked state', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin);
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 1,
      unlockedFeatures: ALL_FEATURES,
      completedSteps: [],
      hasSeenWelcome: false,
    };
    const progress = getUnlockProgress();
    expect(progress.unlockedCount).toBe(8);
    expect(progress.totalCount).toBe(8);
    expect(progress.maxDay).toBe(4);
    expect(progress.nextUnlock).toBeUndefined();
  });

  it('identifies next unlock when features are missing', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin);
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 1,
      unlockedFeatures: ['mood', 'habits'],
      completedSteps: [],
      hasSeenWelcome: false,
    };
    const progress = getUnlockProgress();
    expect(progress.unlockedCount).toBe(2);
    expect(progress.nextUnlock).toBeDefined();
    expect(progress.nextUnlock?.feature).toBe('focusTimer');
  });

  it('returns current day based on firstLoginDate', () => {
    const firstLogin = new Date('2025-06-10T12:00:00Z').getTime();
    vi.setSystemTime(firstLogin + 2 * 24 * 60 * 60 * 1000); // day 3
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: firstLogin,
      daysActive: 1,
      unlockedFeatures: ALL_FEATURES,
      completedSteps: [],
      hasSeenWelcome: false,
    };
    const progress = getUnlockProgress();
    expect(progress.day).toBe(3);
  });
});

// ─── resetOnboarding ────────────────────────────────────────────

describe('resetOnboarding', () => {
  it('calls storageRemove with the correct key', () => {
    resetOnboarding();
    expect(storageRemove).toHaveBeenCalledWith(SK.ONBOARDING_STATE);
  });

  it('clears stored onboarding state', () => {
    mockStorage[SK.ONBOARDING_STATE] = { isNewUser: true };
    resetOnboarding();
    expect(mockStorage[SK.ONBOARDING_STATE]).toBeUndefined();
  });
});

// ─── shouldShowWelcome ──────────────────────────────────────────

describe('shouldShowWelcome', () => {
  it('returns true for new user who has not seen welcome', () => {
    // default state from getOnboardingState is isNewUser=true, hasSeenWelcome=false
    expect(shouldShowWelcome()).toBe(true);
  });

  it('returns false for new user who has seen welcome', () => {
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: ALL_FEATURES,
      completedSteps: [],
      hasSeenWelcome: true,
    };
    expect(shouldShowWelcome()).toBe(false);
  });

  it('returns false for non-new user', () => {
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: false,
      firstLoginDate: 1000,
      daysActive: 99,
      unlockedFeatures: ALL_FEATURES,
      completedSteps: [],
      hasSeenWelcome: false,
    };
    expect(shouldShowWelcome()).toBe(false);
  });
});

// ─── markWelcomeSeen ────────────────────────────────────────────

describe('markWelcomeSeen', () => {
  it('sets hasSeenWelcome to true', () => {
    mockStorage[SK.ONBOARDING_STATE] = {
      isNewUser: true,
      firstLoginDate: 1000,
      daysActive: 1,
      unlockedFeatures: ALL_FEATURES,
      completedSteps: [],
      hasSeenWelcome: false,
    };
    markWelcomeSeen();
    const saved = mockStorage[SK.ONBOARDING_STATE] as OnboardingState;
    expect(saved.hasSeenWelcome).toBe(true);
  });

  it('saves state after marking welcome seen', () => {
    vi.clearAllMocks();
    markWelcomeSeen();
    expect(safeLocalStorageSet).toHaveBeenCalled();
  });
});
