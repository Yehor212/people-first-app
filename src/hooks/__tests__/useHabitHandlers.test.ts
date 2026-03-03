/**
 * useHabitHandlers Hook Tests
 * Tests habit CRUD, toggle, adjust, double-click guard, and sync triggers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ENTRY } from '@/types';
import { makeTestHabit, datesToEntries } from '@/test/habitFixtures';

// --- mocks ---

const mockSetHabits = vi.fn();
const mockSetScheduleEvents = vi.fn();
const mockSetReminders = vi.fn((updater: unknown) => {
  if (typeof updater === 'function') updater({ habitIds: [], enabled: false, time: '08:00' });
});
const mockSetConfettiBurst = vi.fn();
const mockTriggerSync = vi.fn();
const mockHabits = [
  makeTestHabit({
    id: 'h1', name: 'Meditate', icon: '🧘',
    entries: {},
  }),
  makeTestHabit({
    id: 'h2', name: 'Water', icon: '💧',
    habitType: 'numerical',
    targetValue: 3,
    entries: {},
  }),
  makeTestHabit({
    id: 'h3', name: 'Less Sugar', icon: '🍬',
    habitType: 'numerical',
    targetValue: 2,
    targetType: 'atMost',
    entries: {},
  }),
];

vi.mock('@/stores', () => ({
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      habits: mockHabits,
      setHabits: mockSetHabits,
      setScheduleEvents: mockSetScheduleEvents,
      setReminders: mockSetReminders,
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

vi.mock('@/lib/habits', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/habits')>();
  return {
    ...actual,
    normalizeHabit: vi.fn((h: unknown) => h),
  };
});

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

vi.mock('@/lib/challengeStorage', () => ({
  getChallenges: vi.fn(() => []),
  saveChallenges: vi.fn(),
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
import { useUserDataStore } from '@/stores';
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

    const newHabit = makeTestHabit({
      id: 'h-new', name: 'Read', icon: '📖',
      entries: {},
    });

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

    const updated = lastSetHabitsUpdater()(mockHabits );
    expect(updated[0].name).toBe('Yoga');
    expect(updated[1].id).toBe('h2'); // unchanged
  });

  it('handleDeleteHabit filters by id', () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleDeleteHabit('h1');
    });

    const updated = lastSetHabitsUpdater()(mockHabits );
    expect(updated).toHaveLength(2);
    expect(updated.find(h => h.id === 'h1')).toBeUndefined();
  });

  it('handleToggleHabit toggles daily completion on', () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleToggleHabit('h1', '2026-02-19');
    });

    const updated = lastSetHabitsUpdater()(mockHabits );
    const habit = updated.find(h => h.id === 'h1');
    expect(habit?.entries['2026-02-19']?.value).toBe(ENTRY.YES_MANUAL);
    expect(mockAwardXp).toHaveBeenCalledWith('habit');
  });

  it('handleToggleHabit toggles daily completion off when already completed', () => {
    const habitsWithCompleted = mockHabits.map(h =>
      h.id === 'h1' ? { ...h, entries: datesToEntries(['2026-02-19']) } : h,
    );

    // Override store to return completed habits — handleToggleHabit reads
    // current value from the store closure, not from the updater's `prev`.
    vi.mocked(useUserDataStore).mockImplementation(
      ((sel: (s: Record<string, unknown>) => unknown) =>
        sel({ habits: habitsWithCompleted, setHabits: mockSetHabits, setScheduleEvents: mockSetScheduleEvents, setReminders: mockSetReminders })) as typeof useUserDataStore,
    );

    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleToggleHabit('h1', '2026-02-19');
    });

    const updated = lastSetHabitsUpdater()(habitsWithCompleted);
    const habit = updated.find(h => h.id === 'h1');
    // After toggle off, entry should not be YES_MANUAL
    const entryVal = habit?.entries['2026-02-19']?.value;
    expect(entryVal === undefined || entryVal === ENTRY.UNKNOWN || entryVal === ENTRY.SKIP || entryVal === ENTRY.NO).toBe(true);

    // Restore original store mock (must include all selectors used by the hook)
    vi.mocked(useUserDataStore).mockImplementation(
      ((sel: (s: Record<string, unknown>) => unknown) =>
        sel({ habits: mockHabits, setHabits: mockSetHabits, setScheduleEvents: mockSetScheduleEvents, setReminders: mockSetReminders })) as typeof useUserDataStore,
    );
  });

  it('handleToggleHabit increments numerical type completions', () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleToggleHabit('h2', '2026-02-19');
    });

    const updated = lastSetHabitsUpdater()(mockHabits );
    const habit = updated.find(h => h.id === 'h2');
    // Numerical habit should have an entry value set
    expect(habit?.entries['2026-02-19']).toBeDefined();
    expect(mockAwardXp).toHaveBeenCalledWith('habit');
  });

  it('handleAdjustHabit adjusts numerical habit value', () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleAdjustHabit('h3', '2026-02-19', 1);
    });

    const updated = lastSetHabitsUpdater()(mockHabits );
    const habit = updated.find(h => h.id === 'h3');
    expect(habit?.entries['2026-02-19']).toBeDefined();
  });

  it('handleAdjustHabit adjusts numerical completions with delta', () => {
    const habitsWithNumericalProgress = mockHabits.map(h =>
      h.id === 'h2' ? { ...h, entries: { '2026-02-19': { value: 2000 } } } : h,
    );

    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleAdjustHabit('h2', '2026-02-19', -1);
    });

    const updated = lastSetHabitsUpdater()(habitsWithNumericalProgress );
    const habit = updated.find(h => h.id === 'h2');
    expect(habit?.entries['2026-02-19']).toBeDefined();
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
      result.current.handleAddHabit(makeTestHabit({
        id: 'hx', name: 'X', icon: 'x',
        entries: {},
      }));
    });

    expect(mockTriggerSync).toHaveBeenCalled();

    mockTriggerSync.mockClear();

    act(() => {
      result.current.handleDeleteHabit('h1');
    });

    expect(mockTriggerSync).toHaveBeenCalled();
  });
});
