/**
 * useDerivedData Hook Tests
 * Tests schedule event merging, CTA priority, widget data, and badge names.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// --- mocks ---

const mockMoods = [
  { id: 'm1', mood: 'good' as const, date: '2026-02-19', timestamp: 1 },
];
const mockHabits = [
  {
    id: 'h1', name: 'Meditate', icon: '🧘', color: '#00ff00',
    completedDates: ['2026-02-19'], createdAt: Date.now(), type: 'daily' as const,
    frequency: 'daily' as const, reminders: [],
  },
];
const mockFocusSessions = [
  { id: 'f1', duration: 25, completedAt: 1, date: '2026-02-19' },
];
const mockGratitudeEntries = [
  { id: 'g1', text: 'grateful', date: '2026-02-19', timestamp: 1 },
];
const mockScheduleEvents = [
  { id: 'se1', title: 'Meeting', date: '2026-02-19', startHour: 9, startMinute: 0, endHour: 10, endMinute: 0, color: '#ff0000' },
  { id: 'se2', title: 'Tomorrow', date: '2026-02-20', startHour: 9, startMinute: 0, endHour: 10, endMinute: 0, color: '#0000ff' },
];

vi.mock('@/stores', () => ({
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      moods: mockMoods,
      habits: mockHabits,
      focusSessions: mockFocusSessions,
      gratitudeEntries: mockGratitudeEntries,
      scheduleEvents: mockScheduleEvents,
    }),
  ),
  useAppStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ currentDate: '2026-02-19' }),
  ),
}));

vi.mock('@/lib/habitScheduleSync', () => ({
  generateHabitScheduleEvents: vi.fn(() => []),
  mergeScheduleEvents: vi.fn((events: unknown[]) => events),
}));

vi.mock('@/lib/utils', () => ({
  calculateStreak: vi.fn(() => 5),
}));

// --- import under test after mocks ---

import { useDerivedData } from '../useDerivedData';
import { useUserDataStore } from '@/stores';

describe('useDerivedData', () => {
  const defaultInnerWorld = { restDays: [] as string[] };
  const defaultBadges: Array<{ id: string; unlocked?: boolean; unlockedDate?: string; title?: Record<string, string> }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default store mock
    (useUserDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (sel: (s: Record<string, unknown>) => unknown) =>
        sel({
          moods: mockMoods,
          habits: mockHabits,
          focusSessions: mockFocusSessions,
          gratitudeEntries: mockGratitudeEntries,
          scheduleEvents: mockScheduleEvents,
        }),
    );
  });

  it('returns allScheduleEvents from merged events', () => {
    const { result } = renderHook(() => useDerivedData(defaultInnerWorld, defaultBadges));

    expect(result.current.allScheduleEvents).toEqual(mockScheduleEvents);
  });

  it('todayAllEvents filters by currentDate', () => {
    const { result } = renderHook(() => useDerivedData(defaultInnerWorld, defaultBadges));

    // Only se1 has date '2026-02-19'
    expect(result.current.todayAllEvents).toHaveLength(1);
    expect(result.current.todayAllEvents[0].id).toBe('se1');
  });

  it('hasMoodToday is true when mood exists for currentDate', () => {
    const { result } = renderHook(() => useDerivedData(defaultInnerWorld, defaultBadges));

    // currentPrimaryCTA reflects hasMoodToday: when mood exists, CTA is not 'mood'
    // Since all activities are done for today, CTA should be 'complete'
    expect(result.current.currentPrimaryCTA).toBe('complete');
  });

  it('currentPrimaryCTA returns mood first when no mood today', () => {
    (useUserDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (sel: (s: Record<string, unknown>) => unknown) =>
        sel({
          moods: [], // no mood today
          habits: mockHabits,
          focusSessions: mockFocusSessions,
          gratitudeEntries: mockGratitudeEntries,
          scheduleEvents: mockScheduleEvents,
        }),
    );

    const { result } = renderHook(() => useDerivedData(defaultInnerWorld, defaultBadges));

    expect(result.current.currentPrimaryCTA).toBe('mood');
  });

  it('currentPrimaryCTA returns focus when mood and habits done but no focus', () => {
    (useUserDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (sel: (s: Record<string, unknown>) => unknown) =>
        sel({
          moods: mockMoods,
          habits: mockHabits, // completed today
          focusSessions: [], // no focus today
          gratitudeEntries: mockGratitudeEntries,
          scheduleEvents: mockScheduleEvents,
        }),
    );

    const { result } = renderHook(() => useDerivedData(defaultInnerWorld, defaultBadges));

    expect(result.current.currentPrimaryCTA).toBe('focus');
  });

  it('completedTodayCount counts correctly for daily habits', () => {
    const { result } = renderHook(() => useDerivedData(defaultInnerWorld, defaultBadges));

    // h1 has '2026-02-19' in completedDates → 1 completed
    expect(result.current.completedTodayCount).toBe(1);
  });

  it('todayFocusMinutes sums duration of today focus sessions', () => {
    const { result } = renderHook(() => useDerivedData(defaultInnerWorld, defaultBadges));

    // f1 has duration: 25 and date: '2026-02-19'
    expect(result.current.todayFocusMinutes).toBe(25);
  });

  it('lastBadgeName returns latest unlocked badge name', () => {
    const badges = [
      { id: 'b1', unlocked: true, unlockedDate: '2026-02-18', title: { en: 'First Badge' } },
      { id: 'b2', unlocked: true, unlockedDate: '2026-02-19', title: { en: 'Latest Badge' } },
      { id: 'b3', unlocked: false, title: { en: 'Locked Badge' } },
    ];

    const { result } = renderHook(() => useDerivedData(defaultInnerWorld, badges));

    expect(result.current.lastBadgeName).toBe('Latest Badge');
  });
});
