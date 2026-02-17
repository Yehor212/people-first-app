/**
 * FeatureFlagsContext Tests
 *
 * Tests for the feature flags provider, including toggle behavior,
 * onboarding-gated visibility, and default flag values.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';

// --- Mocks ---

let mockFlags: any;
let mockSetFlags: any;

vi.mock('@/hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn(() => [mockFlags, mockSetFlags]),
}));

vi.mock('@/lib/onboardingFlow', () => ({
  isFeatureUnlocked: vi.fn(() => true),
}));

vi.mock('@/lib/storageKeys', () => ({
  SK: { FEATURE_FLAGS: 'zenflow-feature-flags' },
}));

import {
  FeatureFlagsProvider,
  useFeatureFlags,
  useFeatureVisible,
} from '../FeatureFlagsContext';
import { isFeatureUnlocked } from '@/lib/onboardingFlow';

// --- Helpers ---

const wrapper = ({ children }: { children: ReactNode }) => (
  <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
);

const DEFAULT_FLAGS = {
  focusTimer: true,
  breathingExercise: true,
  gratitudeJournal: true,
  quests: true,
  tasks: true,
  challenges: true,
  aiCoach: false,
  innerWorld: true,
};

// --- Tests ---

describe('FeatureFlagsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlags = { ...DEFAULT_FLAGS };
    mockSetFlags = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        mockFlags = updater(mockFlags);
      } else {
        mockFlags = updater;
      }
    });
  });

  // 1. Default flags
  it('provides default flags with all features enabled except aiCoach', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.flags.focusTimer).toBe(true);
    expect(result.current.flags.breathingExercise).toBe(true);
    expect(result.current.flags.gratitudeJournal).toBe(true);
    expect(result.current.flags.quests).toBe(true);
    expect(result.current.flags.tasks).toBe(true);
    expect(result.current.flags.challenges).toBe(true);
    expect(result.current.flags.aiCoach).toBe(false);
    expect(result.current.flags.innerWorld).toBe(true);
  });

  // 2. isFeatureEnabled returns true for enabled feature
  it('isFeatureEnabled returns true for an enabled feature', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.isFeatureEnabled('focusTimer')).toBe(true);
    expect(result.current.isFeatureEnabled('breathingExercise')).toBe(true);
  });

  // 3. isFeatureEnabled returns false for disabled feature (aiCoach)
  it('isFeatureEnabled returns false for aiCoach (disabled by default)', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.isFeatureEnabled('aiCoach')).toBe(false);
  });

  // 4. setFlag toggles a single flag without affecting others
  it('setFlag toggles a single flag without affecting others', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    act(() => {
      result.current.setFlag('focusTimer', false);
    });

    expect(mockSetFlags).toHaveBeenCalledTimes(1);
    // The updater should produce new flags with focusTimer=false
    expect(mockFlags.focusTimer).toBe(false);
    // Other flags remain unchanged
    expect(mockFlags.breathingExercise).toBe(true);
    expect(mockFlags.quests).toBe(true);
    expect(mockFlags.aiCoach).toBe(false);
  });

  // 5. setFlag can enable aiCoach
  it('setFlag can enable aiCoach', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    act(() => {
      result.current.setFlag('aiCoach', true);
    });

    expect(mockFlags.aiCoach).toBe(true);
  });

  // 6. isFeatureVisible returns true when enabled AND unlocked
  it('isFeatureVisible returns true when feature is enabled and unlocked', () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(true);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.isFeatureVisible('focusTimer')).toBe(true);
  });

  // 7. isFeatureVisible returns false when disabled (even if unlocked)
  it('isFeatureVisible returns false when feature is disabled even if unlocked', () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(true);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    // aiCoach is disabled by default
    expect(result.current.isFeatureVisible('aiCoach')).toBe(false);
  });

  // 8. isFeatureVisible returns false when enabled but NOT unlocked (onboarding requirement)
  it('isFeatureVisible returns false when enabled but not unlocked via onboarding', () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(false);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    // focusTimer is enabled but onboarding says not unlocked
    expect(result.current.isFeatureVisible('focusTimer')).toBe(false);
  });

  // 9. isFeatureVisible returns true for features WITHOUT onboarding requirement
  it('isFeatureVisible returns true for features without onboarding requirement even when isFeatureUnlocked returns false', () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(false);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    // breathingExercise has no onboarding mapping, so isFeatureUnlocked is never checked
    expect(result.current.isFeatureVisible('breathingExercise')).toBe(true);
    expect(result.current.isFeatureVisible('gratitudeJournal')).toBe(true);
    expect(result.current.isFeatureVisible('innerWorld')).toBe(true);
  });

  // 10. resetFlags restores all defaults
  it('resetFlags restores all flags to defaults', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    // First modify some flags
    act(() => {
      result.current.setFlag('focusTimer', false);
      result.current.setFlag('aiCoach', true);
    });

    // Then reset
    act(() => {
      result.current.resetFlags();
    });

    // mockSetFlags should have been called with DEFAULT_FLAGS object
    const lastCall = mockSetFlags.mock.calls[mockSetFlags.mock.calls.length - 1];
    expect(lastCall[0]).toEqual(DEFAULT_FLAGS);
  });

  // 11. useFeatureFlags throws when used outside provider
  it('useFeatureFlags throws when used outside FeatureFlagsProvider', () => {
    // Suppress console.error for the expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useFeatureFlags());
    }).toThrow('useFeatureFlags must be used within a FeatureFlagsProvider');

    consoleSpy.mockRestore();
  });

  // 12. useFeatureVisible convenience hook returns correct value
  it('useFeatureVisible returns correct visibility for a feature', () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(true);

    const { result } = renderHook(() => useFeatureVisible('focusTimer'), { wrapper });

    expect(result.current).toBe(true);
  });

  // 13. isFeatureEnabled returns true for unknown feature flag (defaults via nullish coalescing)
  it('isFeatureEnabled defaults to true for a feature not in flags via nullish coalescing', () => {
    // Simulate a flag key that is missing from the flags object
    mockFlags = { ...DEFAULT_FLAGS };
    const mutable: Record<string, unknown> = mockFlags;
    delete mutable.innerWorld;

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    // flags[feature] is undefined, so ?? true returns true
    expect(result.current.isFeatureEnabled('innerWorld')).toBe(true);
  });
});
