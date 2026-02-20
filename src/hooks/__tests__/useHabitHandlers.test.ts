/**
 * useHabitHandlers Hook Tests
 * Tests habit CRUD, toggle, adjust, double-click guard, and sync triggers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- mocks ---

const mockSetHabits = vi.fn();
const mockSetConfettiBurst = vi.fn();
const mockTriggerSync = vi.fn();
const mockHabits = [
  {
    id: 'h1', name: 'Meditate', icon: '🧘', color: '#00ff00',
    completedDates: [] as string[], createdAt: 1, type: 'daily' as const,
    frequency: 'daily' as const, reminders: [],
  },
  {
    id: 'h2', name: 'Water', icon: '💧', color: '#0000ff',
    completedDates: [] as string[], createdAt: 1, type: 'multiple' as const,
    frequency: 'daily' as const, reminders: [], dailyTarget: 3,
    completionsByDate: {} as Record<string, number>,
  },
  {
    id: 'h3', name: 'Less Sugar', icon: '🍬', color: '#ff0000',
    completedDates: [] as string[], createdAt: 1, type: 'reduce' as const,
    frequency: 'daily' as const, reminders: [], targetCount: 2,
    progressByDate: {} as Record<string, number>,
  },
];

vi.mock('@/stores', () => ({
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      habits: mockHabits,
      setHabits: mockSetHabits,
    }),
  ),
  useUIStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      setConfettiBurst: mockSetConfettiBurst,
    }),
  ),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ language: 'en', t: {} })),
}));

vi.mock('@/components/XpPopup', () => ({
  triggerXpPopup: vi.fn(),
}));

vi.mock('@/storage/cloudSync', () => ({
  triggerSync: (...args: unknown[]) => mockTriggerSync(...args),
}));

vi.mock('@/lib/haptics', () => ({
  haptics: {
    habitToggled: vi.fn(() => Promise.resolve()),
    habitCompleted: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@/lib/habits', () => ({
  normalizeHabit: vi.fn((h: unknown) => h),
}));

vi.mock('@/lib/habitTemplates', () => ({
  findTemplateIdByName: vi.fn(() => null),
  getHabitTemplateName: vi.fn((id: string) => id),
}));

vi.mock('@/storage/friendsSync', () => ({
  addFriendActivity: vi.fn(),
  loadMyProfile: vi.fn(() => null),
}));

vi.mock('@/lib/comebackChallenge', () => ({
  recordHabitForChallenge: vi.fn(() => ({ challengeComplete: false, bonusXp: 0 })),
}));

vi.mock('@/lib/randomQuests', () => ({
  updateAllQuestsProgress: vi.fn(() => []),
}));

vi.mock('@/lib/storageKeys', () => ({
  SK: { SPECIAL_BADGES: 'zenflow-special-badges' },
}));

vi.mock('@/lib/safeJson', () => ({
  safeLocalStorageGet: vi.fn(() => ({})),
  safeLocalStorageSet: vi.fn(),
}));

// --- import under test after mocks ---

import { useHabitHandlers } from '../useHabitHandlers';
import type { Habit } from '@/types';

describe('useHabitHandlers', () => {
  const mockAwardXp = vi.fn();
  const mockEarnTreats = vi.fn(() => ({ earned: 10 }));
  const mockPlantSeed = vi.fn();
  const mockWaterPlants = vi.fn();
  const mockUpdateChallengeProgress = vi.fn();
  const mockCheckForFeatureUnlocks = vi.fn();

  const defaultParams = {
    awardXp: mockAwardXp,
    earnTreats: mockEarnTreats,
    plantSeed: mockPlantSeed,
    waterPlants: mockWaterPlants,
    updateChallengeProgress: mockUpdateChallengeProgress,
    checkForFeatureUnlocks: mockCheckForFeatureUnlocks,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /** Helper: render and clear mocks that fire from the language useEffect on mount */
  function renderAndClearEffects() {
    const hook = renderHook(() => useHabitHandlers(defaultParams));
    // The language-localization useEffect fires setHabits on mount,
    // so clear mock call history before testing individual handlers.
    mockSetHabits.mockClear();
    mockTriggerSync.mockClear();
    return hook;
  }

  /** Helper: get the last updater function passed to setHabits */
  function lastSetHabitsUpdater(): (prev: Habit[]) => Habit[] {
    const calls = mockSetHabits.mock.calls;
    return calls[calls.length - 1][0] as (prev: Habit[]) => Habit[];
  }

  it('handleAddHabit adds habit to array', () => {
    const { result } = renderAndClearEffects();

    const newHabit = {
      id: 'h-new', name: 'Read', icon: '📖', color: '#ff00ff',
      completedDates: [], createdAt: Date.now(), type: 'daily' as const,
      frequency: 'daily' as const, reminders: [],
    } as Habit;

    act(() => {
      result.current.handleAddHabit(newHabit);
    });

    expect(mockSetHabits).toHaveBeenCalledWith(expect.any(Function));
    const updated = lastSetHabitsUpdater()([]);
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('h-new');
  });

  it('handleUpdateHabit replaces habit by id', () => {
    const { result } = renderAndClearEffects();

    const updatedHabit = { ...mockHabits[0], name: 'Yoga' } as Habit;

    act(() => {
      result.current.handleUpdateHabit(updatedHabit);
    });

    const updated = lastSetHabitsUpdater()(mockHabits as Habit[]);
    expect(updated[0].name).toBe('Yoga');
    expect(updated[1].id).toBe('h2'); // unchanged
  });

  it('handleDeleteHabit filters by id', () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleDeleteHabit('h1');
    });

    const updated = lastSetHabitsUpdater()(mockHabits as Habit[]);
    expect(updated).toHaveLength(2);
    expect(updated.find(h => h.id === 'h1')).toBeUndefined();
  });

  it('handleToggleHabit toggles daily completion on', () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleToggleHabit('h1', '2026-02-19');
    });

    const updated = lastSetHabitsUpdater()(mockHabits as Habit[]);
    const habit = updated.find(h => h.id === 'h1');
    expect(habit.completedDates).toContain('2026-02-19');
    expect(mockAwardXp).toHaveBeenCalledWith('habit');
  });

  it('handleToggleHabit toggles daily completion off when already completed', () => {
    const habitsWithCompleted = mockHabits.map(h =>
      h.id === 'h1' ? { ...h, completedDates: ['2026-02-19'] } : h,
    );

    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleToggleHabit('h1', '2026-02-19');
    });

    const updated = lastSetHabitsUpdater()(habitsWithCompleted as Habit[]);
    const habit = updated.find(h => h.id === 'h1');
    expect(habit.completedDates).not.toContain('2026-02-19');
  });

  it('handleToggleHabit increments multiple type completions', () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleToggleHabit('h2', '2026-02-19');
    });

    const updated = lastSetHabitsUpdater()(mockHabits as Habit[]);
    const habit = updated.find(h => h.id === 'h2');
    expect(habit.completionsByDate?.['2026-02-19']).toBe(1);
    expect(mockAwardXp).toHaveBeenCalledWith('habit');
  });

  it('handleAdjustHabit adjusts reduce type progress', () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleAdjustHabit('h3', '2026-02-19', 1);
    });

    const updated = lastSetHabitsUpdater()(mockHabits as Habit[]);
    const habit = updated.find(h => h.id === 'h3');
    expect(habit.progressByDate?.['2026-02-19']).toBe(1);
  });

  it('handleAdjustHabit adjusts multiple type completions with delta', () => {
    const habitsWithMultipleProgress = mockHabits.map(h =>
      h.id === 'h2' ? { ...h, completionsByDate: { '2026-02-19': 2 } } : h,
    );

    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleAdjustHabit('h2', '2026-02-19', -1);
    });

    const updated = lastSetHabitsUpdater()(habitsWithMultipleProgress as Habit[]);
    const habit = updated.find(h => h.id === 'h2');
    expect(habit.completionsByDate?.['2026-02-19']).toBe(1);
  });

  it('double-click guard prevents rapid duplicate toggles', () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleToggleHabit('h1', '2026-02-19');
    });

    // Second call with same habitId+date should be blocked by processingHabitsRef
    act(() => {
      result.current.handleToggleHabit('h1', '2026-02-19');
    });

    // setHabits should only be called once (the second toggle is a no-op)
    expect(mockSetHabits).toHaveBeenCalledTimes(1);

    // After timeout clears the processing guard, should work again
    act(() => {
      vi.advanceTimersByTime(600);
    });

    act(() => {
      result.current.handleToggleHabit('h1', '2026-02-19');
    });

    expect(mockSetHabits).toHaveBeenCalledTimes(2);
  });

  it('triggerSync is called after mutations', () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleAddHabit({
        id: 'hx', name: 'X', icon: 'x', color: '#000',
        completedDates: [], createdAt: 1, type: 'daily' as const,
        frequency: 'daily' as const, reminders: [],
      } as Habit);
    });

    expect(mockTriggerSync).toHaveBeenCalled();

    mockTriggerSync.mockClear();

    act(() => {
      result.current.handleDeleteHabit('h1');
    });

    expect(mockTriggerSync).toHaveBeenCalled();
  });
});
